/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA OFFICIAL GEMINI PROVIDER (PROMPT 07 & GEMINI-API SKILL)
 * Implementação nativa do provedor Gemini utilizando o SDK oficial @google/genai.
 * 
 * Diretrizes Mandatórias (@google/genai):
 * - Inicialização estritamente no servidor via new GoogleGenAI({ apiKey, httpOptions: { headers: { 'User-Agent': 'aistudio-build' } } }).
 * - Modelos válidos: 'gemini-3.8-flash', 'gemini-3.1-pro-preview', 'gemini-3.8-flash-lite-tts'.
 * - Não expõe o SDK ou chaves de API para o restante da aplicação.
 * - Converte chamadas de funções para AIToolCall normalizados (sem executar ferramentas).
 */

import { GoogleGenAI, GenerateContentResponse } from '@google/genai';
import { IAIProvider } from './types.js';
import {
  AIRequest,
  AIResponse,
  AIChunk,
  ProviderCapabilities,
  ProviderHealth,
  AIToolCall,
  FinishReason
} from '../types.js';
import { calculateTokenCost } from '../models.js';
import {
  AIAuthError,
  AIRateLimitError,
  AITimeoutError,
  AIProviderUnavailableError,
  AIContentError
} from '../errors.js';
import { randomUUID } from 'crypto';

export class GeminiProvider implements IAIProvider {
  public readonly id = 'gemini';
  public readonly name = 'Google Gemini Native';

  private defaultAi: GoogleGenAI | null = null;

  constructor() {
    this.initDefaultClient();
  }

  private initDefaultClient(): GoogleGenAI | null {
    const key = process.env.GEMINI_API_KEY;
    if (key && key !== 'SUA_CHAVE_GEMINI_API_AQUI' && key.length > 10) {
      if (!this.defaultAi) {
        this.defaultAi = new GoogleGenAI({
          apiKey: key,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build'
            }
          }
        });
      }
      return this.defaultAi;
    }
    return null;
  }

  private getClient(customApiKey?: string): GoogleGenAI | null {
    if (customApiKey && customApiKey.length > 10) {
      return new GoogleGenAI({
        apiKey: customApiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build'
          }
        }
      });
    }
    return this.initDefaultClient();
  }

  public async capabilities(): Promise<ProviderCapabilities> {
    return {
      supportedTasks: [
        'conversation',
        'reasoning',
        'classification',
        'summarization',
        'extraction',
        'planning',
        'tool_selection',
        'memory_summarization',
        'translation',
        'tts',
        'transcription',
        'realtime_voice'
      ],
      supportedModels: [
        'gemini-3.8-flash',
        'gemini-3.1-pro-preview',
        'gemini-3.8-flash-lite-tts',
        'gemini-3.5-transcribe',
        'gemini-3.8-live'
      ],
      supportsStreaming: true,
      supportsTools: true,
      supportsVision: true
    };
  }

  public async checkHealth(): Promise<ProviderHealth> {
    const client = this.getClient();
    if (!client) {
      return {
        status: 'disabled',
        lastChecked: new Date().toISOString(),
        error: 'Chave GEMINI_API_KEY não configurada no ambiente.'
      };
    }

    const start = Date.now();
    try {
      // Ping rápido de verificação
      const res = await client.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: 'ping',
        config: {
          maxOutputTokens: 5
        }
      });
      return {
        status: 'healthy',
        latencyMs: Date.now() - start,
        lastChecked: new Date().toISOString()
      };
    } catch (err: any) {
      return {
        status: 'degraded',
        latencyMs: Date.now() - start,
        lastChecked: new Date().toISOString(),
        error: err?.message || String(err)
      };
    }
  }

  /**
   * Converte mensagens universais para o formato aceito pelo @google/genai
   */
  private formatContents(messages: AIRequest['messages']) {
    return messages.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));
  }

  /**
   * Converte tools universais da MaIA para o formato de FunctionDeclarations do Gemini
   */
  private formatTools(tools?: any[]) {
    if (!tools || tools.length === 0) return undefined;
    const declarations = tools.map(t => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters
    }));
    return [{ functionDeclarations: declarations }];
  }

  private normalizeError(err: any, tenantId?: string, model?: string): never {
    const msg = err?.message || String(err);
    if (/quota|exhausted|429|resource_exhausted/i.test(msg)) {
      throw new AIRateLimitError(msg, 20, { tenantId, provider: this.id });
    }
    if (/api[_-]?key|unauthorized|401|403|auth/i.test(msg)) {
      throw new AIAuthError(msg, { tenantId, provider: this.id });
    }
    if (/timeout|deadline/i.test(msg)) {
      throw new AITimeoutError(10000, { tenantId, provider: this.id });
    }
    if (/safety|blocked/i.test(msg)) {
      throw new AIContentError(msg, { tenantId, provider: this.id });
    }
    throw new AIProviderUnavailableError(this.name, msg, { tenantId });
  }

  public async generate(request: AIRequest, modelId: string, apiKey?: string): Promise<AIResponse> {
    const client = this.getClient(apiKey);
    if (!client) {
      throw new AIAuthError('Chave da API Gemini não disponível para executar a inferência.', {
        tenantId: request.tenantId,
        provider: this.id
      });
    }

    const startTime = Date.now();
    const requestId = 'req-gemini-' + Date.now() + '-' + randomUUID().substring(0, 8);

    try {
      const contents = this.formatContents(request.messages);
      const toolsConfig = this.formatTools(request.tools);

      const timeoutMs = request.timeoutMs || 10000;
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new AITimeoutError(timeoutMs, { tenantId: request.tenantId, provider: this.id })), timeoutMs)
      );

      const generatePromise = client.models.generateContent({
        model: modelId,
        contents,
        config: {
          systemInstruction: request.systemInstruction,
          temperature: request.temperature,
          maxOutputTokens: request.maxTokens,
          topP: request.topP,
          tools: toolsConfig
        }
      });

      const response: GenerateContentResponse = await Promise.race([generatePromise, timeoutPromise]);

      const text = response.text || '';
      const latencyMs = Date.now() - startTime;

      // Extrai eventuais chamadas de ferramentas propostas pelo modelo
      const toolCalls: AIToolCall[] = [];
      const functionCalls = response.functionCalls;
      if (functionCalls && Array.isArray(functionCalls)) {
        for (const call of functionCalls) {
          toolCalls.push({
            id: 'tc-' + randomUUID().substring(0, 8),
            name: call.name || 'unnamed_tool',
            args: (call.args as Record<string, unknown>) || {}
          });
        }
      }

      // Estimativa/Cálculo de tokens
      const promptChars = request.messages.reduce((acc, m) => acc + m.content.length, 0) + (request.systemInstruction?.length || 0);
      const inputTokens = response.usageMetadata?.promptTokenCount || Math.ceil(promptChars / 4);
      const outputTokens = response.usageMetadata?.candidatesTokenCount || Math.ceil(text.length / 4);
      const totalTokens = inputTokens + outputTokens;
      const estimatedCost = calculateTokenCost(modelId, inputTokens, outputTokens);

      return {
        provider: this.id,
        model: modelId,
        content: text,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        usage: {
          inputTokens,
          outputTokens,
          totalTokens,
          estimatedCost,
          currency: 'USD'
        },
        finishReason: (response.candidates?.[0]?.finishReason as FinishReason) || 'STOP',
        latencyMs,
        requestId,
        fromFallback: false
      };
    } catch (err: any) {
      if (err instanceof AITimeoutError) throw err;
      this.normalizeError(err, request.tenantId, modelId);
    }
  }

  public async *stream(request: AIRequest, modelId: string, apiKey?: string): AsyncIterable<AIChunk> {
    const client = this.getClient(apiKey);
    if (!client) {
      throw new AIAuthError('Chave da API Gemini não disponível para streaming.', {
        tenantId: request.tenantId,
        provider: this.id
      });
    }

    try {
      const contents = this.formatContents(request.messages);
      const toolsConfig = this.formatTools(request.tools);

      const streamResponse = await client.models.generateContentStream({
        model: modelId,
        contents,
        config: {
          systemInstruction: request.systemInstruction,
          temperature: request.temperature,
          maxOutputTokens: request.maxTokens,
          tools: toolsConfig
        }
      });

      for await (const chunk of streamResponse) {
        const text = chunk.text || '';
        yield {
          text,
          isLast: false
        };
      }

      yield {
        isLast: true,
        finishReason: 'STOP'
      };
    } catch (err: any) {
      this.normalizeError(err, request.tenantId, modelId);
    }
  }
}

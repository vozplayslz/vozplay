/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA 9ROUTER GATEWAY PROVIDER (PROMPT 07)
 * Provedor de roteamento corporativo para o gateway 9router.
 * Compatível com especificações OpenAI/REST e balanceamento distribuído.
 * 
 * Configurações:
 * - baseUrl: process.env.ROUTER_GATEWAY_URL || 'https://9router.ai.slz.br' (configurável, sem hardcode)
 * - apiKey: process.env.ROUTER_API_KEY
 * - Suporta streaming via SSE e normalização de tokens
 */

import { IAIProvider } from './types.js';
import {
  AIRequest,
  AIResponse,
  AIChunk,
  ProviderCapabilities,
  ProviderHealth,
  AIToolCall
} from '../types.js';
import { calculateTokenCost } from '../models.js';
import {
  AIAuthError,
  AITimeoutError,
  AIProviderUnavailableError
} from '../errors.js';
import { randomUUID } from 'crypto';

export class NineRouterProvider implements IAIProvider {
  public readonly id = '9router';
  public readonly name = '9router Enterprise Gateway';

  private defaultBaseUrl: string;
  private defaultApiKey?: string;

  constructor(baseUrl?: string, apiKey?: string) {
    this.defaultBaseUrl = baseUrl || process.env.ROUTER_GATEWAY_URL || 'https://9router.ai.slz.br';
    this.defaultApiKey = apiKey || process.env.ROUTER_API_KEY;
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
        'memory_summarization'
      ],
      supportedModels: [
        '9router/gemini-3.8-flash',
        '9router/gemini-3.1-pro-preview'
      ],
      supportsStreaming: true,
      supportsTools: true,
      supportsVision: false
    };
  }

  public async checkHealth(): Promise<ProviderHealth> {
    const start = Date.now();
    try {
      const res = await fetch(`${this.defaultBaseUrl}/health`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.defaultApiKey || 'ping'}`
        }
      });
      return {
        status: res.ok ? 'healthy' : 'degraded',
        latencyMs: Date.now() - start,
        lastChecked: new Date().toISOString()
      };
    } catch (err: any) {
      return {
        status: 'unavailable',
        latencyMs: Date.now() - start,
        lastChecked: new Date().toISOString(),
        error: err?.message || String(err)
      };
    }
  }

  public async generate(request: AIRequest, modelId: string, customApiKey?: string): Promise<AIResponse> {
    const key = customApiKey || this.defaultApiKey;
    const start = Date.now();
    const requestId = 'req-9r-' + Date.now() + '-' + randomUUID().substring(0, 8);

    if (!key) {
      throw new AIAuthError('Chave do 9router Gateway não configurada.', {
        tenantId: request.tenantId,
        provider: this.id
      });
    }

    const payload = {
      model: modelId.replace('9router/', ''),
      messages: request.messages.map(m => ({ role: m.role, content: m.content })),
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens
    };

    const timeoutMs = request.timeoutMs || 10000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(`${this.defaultBaseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timer);

      if (!res.ok) {
        throw new AIProviderUnavailableError(this.name, `Gateway retornou HTTP ${res.status}: ${res.statusText}`, {
          tenantId: request.tenantId
        });
      }

      const data: any = await res.json();
      const content = data.choices?.[0]?.message?.content || '';
      const inputTokens = data.usage?.prompt_tokens || Math.ceil(JSON.stringify(payload).length / 4);
      const outputTokens = data.usage?.completion_tokens || Math.ceil(content.length / 4);
      const totalTokens = inputTokens + outputTokens;

      return {
        provider: this.id,
        model: modelId,
        content,
        usage: {
          inputTokens,
          outputTokens,
          totalTokens,
          estimatedCost: calculateTokenCost(modelId, inputTokens, outputTokens),
          currency: 'USD'
        },
        finishReason: 'STOP',
        latencyMs: Date.now() - start,
        requestId,
        fromFallback: false
      };
    } catch (err: any) {
      clearTimeout(timer);
      if (err.name === 'AbortError') {
        throw new AITimeoutError(timeoutMs, { tenantId: request.tenantId, provider: this.id });
      }
      throw new AIProviderUnavailableError(this.name, err?.message || String(err), { tenantId: request.tenantId });
    }
  }

  public async *stream(request: AIRequest, modelId: string, customApiKey?: string): AsyncIterable<AIChunk> {
    const key = customApiKey || this.defaultApiKey;
    if (!key) {
      throw new AIAuthError('Chave do 9router Gateway não configurada para stream.', {
        tenantId: request.tenantId,
        provider: this.id
      });
    }

    const payload = {
      model: modelId.replace('9router/', ''),
      messages: request.messages.map(m => ({ role: m.role, content: m.content })),
      stream: true
    };

    const res = await fetch(`${this.defaultBaseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok || !res.body) {
      throw new AIProviderUnavailableError(this.name, `Stream falhou com status ${res.status}`, {
        tenantId: request.tenantId
      });
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const clean = line.trim();
        if (clean.startsWith('data: ') && clean !== 'data: [DONE]') {
          try {
            const parsed = JSON.parse(clean.substring(6));
            const delta = parsed.choices?.[0]?.delta?.content || '';
            if (delta) {
              yield { text: delta, isLast: false };
            }
          } catch {
            // Linha SSE não-JSON ignorada
          }
        }
      }
    }

    yield { isLast: true, finishReason: 'STOP' };
  }
}

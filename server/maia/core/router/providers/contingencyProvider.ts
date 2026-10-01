/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA LOCAL CONTINGENCY PROVIDER (PROMPT 07)
 * Provedor de contingência local determinístico.
 * Garante resiliência absoluta em caso de blackout de rede ou indisponibilidade de todos os LLMs externos.
 * 
 * Princípio Mandatório (Seção 54):
 * A indisponibilidade de IA JAMAIS pode derrubar a fila, a TV ou o karaokê do VozPlay.
 */

import { IAIProvider } from './types.js';
import {
  AIRequest,
  AIResponse,
  AIChunk,
  ProviderCapabilities,
  ProviderHealth
} from '../types.js';
import { randomUUID } from 'crypto';

export class ContingencyProvider implements IAIProvider {
  public readonly id = 'contingency';
  public readonly name = 'Local Deterministic Contingency';

  public async capabilities(): Promise<ProviderCapabilities> {
    return {
      supportedTasks: [
        'conversation',
        'classification',
        'summarization',
        'extraction',
        'memory_summarization',
        'tool_selection'
      ],
      supportedModels: ['contingency-local'],
      supportsStreaming: false,
      supportsTools: true,
      supportsVision: false
    };
  }

  public async checkHealth(): Promise<ProviderHealth> {
    return {
      status: 'healthy',
      latencyMs: 1,
      lastChecked: new Date().toISOString()
    };
  }

  public async generate(request: AIRequest, modelId: string): Promise<AIResponse> {
    const start = Date.now();
    const requestId = 'req-cont-' + Date.now() + '-' + randomUUID().substring(0, 8);

    let content = 'Estou operando em modo de resiliência local. O palco do VozPlay está pronto para o seu show!';

    if (request.task === 'classification') {
      content = JSON.stringify({ category: 'STANDARD_INTERACTION', confidence: 1.0 });
    } else if (request.task === 'memory_summarization') {
      content = 'Resumo de sessão gerado por contingência local: atividades concluídas com sucesso.';
    } else if (request.task === 'summarization') {
      content = 'Resumo operacional de contingência concluído.';
    } else if (request.messages.length > 0) {
      const lastMsg = request.messages[request.messages.length - 1].content.toLowerCase();
      if (lastMsg.includes('música') || lastMsg.includes('cantar') || lastMsg.includes('fila')) {
        content = 'A fila de karaokê está aberta e ativa! Escolha sua música no catálogo e arrase no palco.';
      }
    }

    return {
      provider: this.id,
      model: 'contingency-local',
      content,
      usage: {
        inputTokens: 10,
        outputTokens: 20,
        totalTokens: 30,
        estimatedCost: 0,
        currency: 'BRL'
      },
      finishReason: 'STOP',
      latencyMs: Date.now() - start,
      requestId,
      fromFallback: true,
      fallbackChain: ['contingency']
    };
  }

  public async *stream(request: AIRequest, modelId: string): AsyncIterable<AIChunk> {
    const response = await this.generate(request, modelId);
    yield {
      text: response.content,
      isLast: true,
      finishReason: 'STOP'
    };
  }
}

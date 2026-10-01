/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA MEMORY CONTEXT SOURCE
 * Fonte de contexto para o Context Engine consultar a Memory de forma desacoplada.
 * 
 * Princípios Fundamentais:
 * - A Memory NÃO fica dentro do Context Engine.
 * - O Context Engine consulta a Memory quando necessário.
 * - Se a Memory estiver indisponível, retorna lista vazia (Resiliência Total).
 * - Aplica rigorosamente o Memory Budget (teto de memórias e tokens).
 */

import { IContextSource, ContextPriorityLevel, ContextSourceResolutionContext, ContextMemoryItem } from '../context/types.js';
import { maiaMemoryService } from './memoryService.js';
import { estimateMemoryTokens } from './relevance/memoryRanker.js';

export class MemoryContextSource implements IContextSource<ContextMemoryItem[]> {
  public readonly name = 'memory';
  public readonly priority: ContextPriorityLevel = 'P5_COMPLEMENTARY';

  public async resolve(context: ContextSourceResolutionContext): Promise<ContextMemoryItem[]> {
    try {
      if (!maiaMemoryService.isEnabled()) {
        return [];
      }

      // Consulta memórias relevantes respeitando o orçamento do perfil
      const maxMemories = context.profile === 'supervisor' || context.profile === 'operator' ? 8 : 4;

      const result = await maiaMemoryService.retrieve({
        tenantId: context.tenantId,
        userId: context.userId,
        sessionId: context.sessionId,
        limit: maxMemories,
        maxEstimatedTokens: 800
      });

      // Mapeia para o DTO de contexto limpo
      return result.items.map(item => ({
        id: item.id,
        type: item.type,
        scope: item.scope,
        summary: item.summary,
        content: item.content,
        confidence: item.confidence,
        importance: item.importance,
        source: item.source,
        relevanceScore: item.confidence * 0.5 + (item.importance / 5) * 0.5
      }));
    } catch {
      // Resiliência Total: se houver qualquer erro na camada de memória, o Context Engine continua
      return [];
    }
  }
}

export const memoryContextSource = new MemoryContextSource();

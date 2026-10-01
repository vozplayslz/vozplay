/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA SESSION MEMORY LIFECYCLE & PROMOTION ENGINE
 * Gerencia a avaliação, sumarização seletiva e promoção da Session Memory no encerramento da sessão.
 * 
 * Princípio Fundamental (Seções 7 e 43 do Briefing):
 * Ao terminar a sessão:
 * Session Memory -> avaliar -> descartar temporárias OU promover memórias de alto valor para memória persistente.
 * NÃO persistir tudo automaticamente.
 * Não transformar todo histórico em memória.
 */

import { MaiaMemoryService } from './memoryService.js';
import { MemoryItem } from './types.js';
import { logger } from '../../../logger.js';

export interface SessionEndEvaluationResult {
  sessionId: string;
  tenantId: string;
  totalSessionItems: number;
  promotedCount: number;
  discardedCount: number;
  promotedMemories: MemoryItem[];
}

export class SessionMemoryLifecycleManager {
  private memoryService: MaiaMemoryService;

  constructor(memoryService: MaiaMemoryService) {
    this.memoryService = memoryService;
  }

  /**
   * Avalia e processa a memória de uma sessão encerrada
   * - Itens com importância >= 4 ou preferências declaradas são promovidos para EPISODIC ou OPERATIONAL
   * - Itens transitórios de trabalho (WORKING) ou de baixa relevância são descartados
   */
  public async handleSessionEnded(
    tenantId: string,
    sessionId: string,
    sessionSummary?: {
      totalSongsSung?: number;
      sessionDurationMinutes?: number;
      topGenre?: string;
    }
  ): Promise<SessionEndEvaluationResult> {
    const rawResult = await this.memoryService.retrieve({
      tenantId,
      sessionId,
      scope: 'session',
      limit: 50
    });

    const sessionItems = rawResult.items;
    const promotedMemories: MemoryItem[] = [];
    let promotedCount = 0;
    let discardedCount = 0;

    for (const item of sessionItems) {
      // Regra de Promoção: Apenas memórias de importância alta (>= 4) ou PREFERENCE / OPERATIONAL são promovidas
      const isHighValue = item.importance >= 4 || item.type === 'PREFERENCE' || item.type === 'OPERATIONAL';

      if (isHighValue) {
        // Promove para memória episódica permanente ou operacional
        const targetType = item.type === 'PREFERENCE' ? 'PREFERENCE' : 'EPISODIC';
        const promoted = await this.memoryService.store({
          type: targetType,
          scope: 'establishment',
          tenantId,
          establishmentId: item.establishmentId,
          userId: item.userId,
          sessionId, // preserva a referência da sessão de origem
          content: item.content,
          summary: item.summary ? `[Promovido da Sessão ${sessionId}] ${item.summary}` : undefined,
          source: item.source,
          confidence: item.confidence,
          importance: item.importance,
          tags: [...(item.tags || []), 'promoted_from_session', `session_${sessionId}`],
          metadata: {
            promotedAt: new Date().toISOString(),
            originalMemoryId: item.id
          },
          createdBy: 'session_lifecycle'
        });
        promotedMemories.push(promoted);
        promotedCount++;
      } else {
        discardedCount++;
      }
    }

    // Se houver sumário consolidado da sessão fornecido pelo sistema operacional, cria uma memória episódica consolidada
    if (sessionSummary && (sessionSummary.totalSongsSung || 0) > 0) {
      const summaryMem = await this.memoryService.store({
        type: 'EPISODIC',
        scope: 'establishment',
        tenantId,
        sessionId,
        content: {
          totalSongsSung: sessionSummary.totalSongsSung,
          durationMinutes: sessionSummary.sessionDurationMinutes,
          topGenre: sessionSummary.topGenre,
          closedAt: new Date().toISOString()
        },
        summary: `Sessão concluída com ${sessionSummary.totalSongsSung} músicas cantadas ao longo de ${sessionSummary.sessionDurationMinutes || 0} minutos.`,
        source: 'system',
        confidence: 1.0,
        importance: 4,
        tags: ['session_recap', 'metrics'],
        createdBy: 'session_lifecycle'
      });
      promotedMemories.push(summaryMem);
    }

    // Limpa a memória volátil da sessão encerrada (descarte de dados temporários)
    await this.memoryService.forget(tenantId, 'session', sessionId, 'session_lifecycle');

    logger.info(`[SessionMemoryLifecycle] Sessão ${sessionId} processada: ${promotedMemories.length} promovidas, ${discardedCount} descartadas.`);

    return {
      sessionId,
      tenantId,
      totalSessionItems: sessionItems.length,
      promotedCount,
      discardedCount,
      promotedMemories
    };
  }
}

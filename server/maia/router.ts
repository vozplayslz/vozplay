/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA AI MODEL ROUTER (ADAPTER CONSOLIDADO)
 * Adaptador de compatibilidade que delega 100% das decisões de roteamento,
 * modelos, circuit breaker e cotas ao MaiaAIRouter oficial (server/maia/core/router).
 * 
 * Regra Arquitetural (Prompt 14 - Seção 5):
 * Única autoridade arquitetural: MaIA -> MaIA Core -> AI Router -> Provider Abstraction.
 */

import { MaIATaskType, AIProvider, MaIAProviderType } from './types.js';
import { maiaConfigManager } from './config.js';
import { getAIProvider } from './providers/index.js';
import { maiaAIRouter } from './core/router/aiRouter.js';
import { AITask } from './core/router/types.js';
import { maiaQuotaManager } from './quota/quotaManager.js';
import { maiaFallbackManager } from './fallback/fallbackManager.js';
import { logger } from '../logger.js';

class AIModelRouter {
  /**
   * Mapeia tarefa legada para AITask do Core
   */
  private mapTaskType(taskType: MaIATaskType): AITask {
    switch (taskType) {
      case 'CHAT':
      case 'MUSIC_ASSISTANCE':
      case 'EVENT_RESPONSE':
        return 'conversation';
      case 'LIVE_VOICE':
      case 'TTS':
      case 'REASONING':
        return 'reasoning';
      case 'TRANSCRIPTION':
      case 'QUEUE_ANNOUNCEMENT':
        return 'extraction';
      default:
        return 'conversation';
    }
  }

  /**
   * Resolve o provedor e modelo ideais para uma tarefa delegando ao MaiaAIRouter
   */
  public resolveRoute(
    establishmentId: string,
    taskType: MaIATaskType
  ): { provider: AIProvider; model: string; providerName: string; providerType: MaIAProviderType } {
    const config = maiaConfigManager.getConfig(establishmentId);
    let providerType: MaIAProviderType = config.active_provider || 'gemini_enlace';
    if (providerType === ('gemini' as any)) {
      providerType = 'gemini_enlace';
    }

    // Consulta resolução no AI Router oficial
    const coreTask = this.mapTaskType(taskType);
    const resolution = maiaAIRouter.resolveRoute({
      tenantId: establishmentId,
      task: coreTask,
      messages: [{ role: 'user', content: 'health_check' }]
    });

    const model = (config.models as any)[taskType] || resolution.modelId || 'gemini-3.8-flash';
    const provider = getAIProvider(providerType, establishmentId);

    return {
      provider,
      model,
      providerName: providerType,
      providerType
    };
  }

  /**
   * Executa uma tarefa com o provedor resolvido, monitoramento de quota e chaveamento por fallback resiliente
   */
  public async executeTask<T>(params: {
    establishmentId: string;
    task: MaIATaskType;
    action: (provider: AIProvider, model: string) => Promise<T>;
    localContingency: () => T;
  }): Promise<{ result: T; usedProvider: string; fallbackOccurred: boolean }> {
    const route = this.resolveRoute(params.establishmentId, params.task);
    const startTime = Date.now();

    return maiaFallbackManager.executeWithFallback({
      establishmentId: params.establishmentId,
      task: params.task,
      preferredProvider: route.providerType,
      model: route.model,
      action: async (providerType) => {
        const providerInstance = getAIProvider(providerType, params.establishmentId);
        const res = await params.action(providerInstance, route.model);

        // Registra uso no quota manager e telemetria
        const latency = Date.now() - startTime;
        maiaQuotaManager.recordUsage({
          establishmentId: params.establishmentId,
          provider: providerType,
          task: params.task,
          model: route.model,
          latencyMs: latency
        });

        return res;
      },
      localContingency: params.localContingency
    });
  }

  /**
   * Valida se os limites operacionais de custo e frequência foram atingidos via QuotaTracker
   */
  public checkLimits(establishmentId: string): { allowed: boolean; reason?: string } {
    const config = maiaConfigManager.getConfig(establishmentId);

    if (!config.enabled) {
      return { allowed: false, reason: 'MaIA está desativada para este estabelecimento.' };
    }

    // Valida no QuotaTracker oficial do AI Router
    const trackerCheck = maiaAIRouter.quotaTracker.canExecute(establishmentId);
    if (!trackerCheck.allowed) {
      return { allowed: false, reason: trackerCheck.reason };
    }

    const quotaCheck = maiaQuotaManager.canExecute(establishmentId, 'CHAT', config.active_provider);
    if (!quotaCheck.allowed) {
      return { allowed: false, reason: quotaCheck.reason };
    }

    return { allowed: true };
  }
}

export const aiModelRouter = new AIModelRouter();

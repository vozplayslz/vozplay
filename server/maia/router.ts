/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA AI MODEL ROUTER
 * Roteador central de inteligência artificial do VozPlay.
 * Decide qual modelo e provider utilizar com base na tarefa, quotas, tolerância a falhas e custo-benefício.
 */

import { MaIATaskType, AIProvider, MaIAProviderType } from './types.js';
import { maiaConfigManager } from './config.js';
import { getAIProvider } from './providers/index.js';
import { maiaQuotaManager } from './quota/quotaManager.js';
import { maiaFallbackManager } from './fallback/fallbackManager.js';
import { logger } from '../logger.js';

class AIModelRouter {
  /**
   * Resolve o provedor e modelo ideais para uma tarefa específica
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

    const provider = getAIProvider(providerType, establishmentId);
    const model = config.models[taskType] || 'gemini-3.8-flash';

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

        // Registra uso no quota manager
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
   * Valida se os limites operacionais de custo e frequência foram atingidos
   */
  public checkLimits(establishmentId: string): { allowed: boolean; reason?: string } {
    const config = maiaConfigManager.getConfig(establishmentId);

    if (!config.enabled) {
      return { allowed: false, reason: 'MaIA está desativada para este estabelecimento.' };
    }

    const quotaCheck = maiaQuotaManager.canExecute(establishmentId, 'CHAT', config.active_provider);
    if (!quotaCheck.allowed) {
      return { allowed: false, reason: quotaCheck.reason };
    }

    return { allowed: true };
  }
}

export const aiModelRouter = new AIModelRouter();

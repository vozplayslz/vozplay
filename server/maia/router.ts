/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA AI MODEL ROUTER
 * Roteador central de inteligência artificial do VozPlay.
 * Decide qual modelo e provider utilizar com base na tarefa e no perfil de custo-benefício.
 */

import { MaIATaskType, AIProvider } from './types.js';
import { maiaConfigManager } from './config.js';
import { getAIProvider } from './providers/index.js';
import { logger } from '../logger.js';

class AIModelRouter {
  /**
   * Resolve o provedor e modelo ideais para uma tarefa específica
   */
  public resolveRoute(
    establishmentId: string,
    taskType: MaIATaskType
  ): { provider: AIProvider; model: string; providerName: string } {
    const config = maiaConfigManager.getConfig(establishmentId);
    const providerName = config.active_provider || 'gemini';
    const provider = getAIProvider(providerName);

    // Obtém o modelo configurado para esta tarefa no perfil do estabelecimento
    const model = config.models[taskType] || 'gemini-3.8-flash';

    return {
      provider,
      model,
      providerName
    };
  }

  /**
   * Valida se os limites operacionais de custo e frequência foram atingidos
   */
  public checkLimits(establishmentId: string): { allowed: boolean; reason?: string } {
    const config = maiaConfigManager.getConfig(establishmentId);
    const metrics = maiaConfigManager.getMetrics(establishmentId);

    if (!config.enabled) {
      return { allowed: false, reason: 'MaIA está desativada para este estabelecimento.' };
    }

    if (metrics.estimatedCostUsd >= config.limits.daily_limit_usd) {
      logger.warn('[AIModelRouter] Limite diário de custo da MaIA atingido:', {
        establishmentId,
        spent: metrics.estimatedCostUsd,
        limit: config.limits.daily_limit_usd
      });
      return { allowed: false, reason: 'Limite diário de consumo da MaIA atingido. Operando em modo de contingência local.' };
    }

    if (metrics.ttsCalls >= config.limits.max_tts_requests_per_day) {
      return { allowed: false, reason: 'Limite diário de síntese de voz (TTS) atingido.' };
    }

    return { allowed: true };
  }
}

export const aiModelRouter = new AIModelRouter();

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA FALLBACK & RESILIENCE MANAGER
 * Orquestração tolerante a falhas, chaveamento transparente entre provedores e contingência local.
 * Garante que a festa e o karaokê NUNCA parem por indisponibilidade de rede ou quotas de IA.
 */

import crypto from 'node:crypto';
import {
  MaIAProviderType,
  MaIATaskType,
  FallbackConfig,
  FallbackEvent,
  AIProvider
} from '../types.js';
import { aiAudit } from '../audit/aiAudit.js';
import { logger } from '../../logger.js';
import { maiaQuotaManager } from '../quota/quotaManager.js';

export class MaiaFallbackManager {
  private config: FallbackConfig = {
    enabled: true,
    provider_chain: ['gemini_customer', 'gemini_enlace', '9router']
  };

  private fallbackHistory: FallbackEvent[] = [];
  private readonly maxHistory = 50;

  /**
   * Obtém configuração atual da cadeia de fallback
   */
  public getConfig(): FallbackConfig {
    return {
      enabled: this.config.enabled,
      provider_chain: [...this.config.provider_chain]
    };
  }

  /**
   * Atualiza a configuração da cadeia de fallback
   */
  public updateConfig(newConfig: Partial<FallbackConfig>) {
    if (typeof newConfig.enabled === 'boolean') {
      this.config.enabled = newConfig.enabled;
    }
    if (Array.isArray(newConfig.provider_chain)) {
      this.config.provider_chain = newConfig.provider_chain;
    }
    logger.info('[FallbackManager] Cadeia de fallback atualizada:', this.config);
  }

  /**
   * Obtém o último evento de fallback registrado
   */
  public getLastFallback(): FallbackEvent | undefined {
    return this.fallbackHistory[0];
  }

  /**
   * Obtém histórico completo de fallbacks
   */
  public getHistory(limit = 20): FallbackEvent[] {
    return this.fallbackHistory.slice(0, limit);
  }

  /**
   * Registra um evento de fallback
   */
  public recordFallback(event: Omit<FallbackEvent, 'id' | 'timestamp'>): FallbackEvent {
    const fullEvent: FallbackEvent = {
      ...event,
      id: `fb-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      timestamp: new Date().toISOString()
    };

    this.fallbackHistory.unshift(fullEvent);
    if (this.fallbackHistory.length > this.maxHistory) {
      this.fallbackHistory.length = this.maxHistory;
    }

    aiAudit.record({
      actor: 'FallbackManager',
      tenant_id: event.tenant_id,
      establishment_id: event.establishment_id,
      event_type: 'AI_FALLBACK',
      provider: event.provider_to,
      model: event.model,
      reason: `Fallback de ${event.provider_from} para ${event.provider_to}: ${event.reason}`
    });

    return fullEvent;
  }

  /**
   * Determina a ordem de provedores a tentar para uma execução
   */
  public getExecutionChain(preferredProvider: MaIAProviderType): MaIAProviderType[] {
    if (!this.config.enabled) {
      return [preferredProvider];
    }

    const chain: MaIAProviderType[] = [preferredProvider];
    for (const p of this.config.provider_chain) {
      if (!chain.includes(p)) {
        chain.push(p);
      }
    }
    return chain;
  }

  /**
   * Executa uma tarefa com chaveamento resiliente automático e fallback local garantido
   */
  public async executeWithFallback<T>(params: {
    establishmentId: string;
    task: MaIATaskType;
    preferredProvider: MaIAProviderType;
    model: string;
    action: (providerType: MaIAProviderType) => Promise<T>;
    localContingency: () => T;
  }): Promise<{ result: T; usedProvider: string; fallbackOccurred: boolean }> {
    const chain = this.getExecutionChain(params.preferredProvider);
    let lastError: any = null;

    for (let i = 0; i < chain.length; i++) {
      const currentProvider = chain[i];

      // Verifica quota antes de tentar
      const quotaCheck = maiaQuotaManager.canExecute(params.establishmentId, params.task, currentProvider);
      if (!quotaCheck.allowed && quotaCheck.needsFallback && i < chain.length - 1) {
        logger.warn(`[FallbackManager] Quota esgotada para ${currentProvider}. Pulando para o próximo.`);
        this.recordFallback({
          tenant_id: params.establishmentId,
          establishment_id: params.establishmentId,
          provider_from: currentProvider,
          provider_to: chain[i + 1],
          reason: quotaCheck.reason || 'Quota esgotada',
          model: params.model,
          task: params.task,
          result: 'SUCCESS'
        });
        continue;
      }

      try {
        const result = await params.action(currentProvider);
        if (i > 0) {
          // Houve fallback bem-sucedido
          this.recordFallback({
            tenant_id: params.establishmentId,
            establishment_id: params.establishmentId,
            provider_from: chain[0],
            provider_to: currentProvider,
            reason: lastError?.message || 'Provedor primário indisponível',
            model: params.model,
            task: params.task,
            result: 'SUCCESS'
          });
        }
        return {
          result,
          usedProvider: currentProvider,
          fallbackOccurred: i > 0
        };
      } catch (err: any) {
        lastError = err;
        const errMsg = String(err?.message || err);
        logger.warn(`[FallbackManager] Provedor ${currentProvider} falhou na tarefa ${params.task}: ${errMsg}`);

        // Se for erro 429, notifica o quota manager
        if (errMsg.includes('429') || errMsg.toLowerCase().includes('quota') || errMsg.toLowerCase().includes('rate limit')) {
          maiaQuotaManager.recordRateLimitHit(params.establishmentId, currentProvider);
        }

        if (i < chain.length - 1) {
          this.recordFallback({
            tenant_id: params.establishmentId,
            establishment_id: params.establishmentId,
            provider_from: currentProvider,
            provider_to: chain[i + 1],
            reason: errMsg,
            model: params.model,
            task: params.task,
            result: 'SUCCESS'
          });
        }
      }
    }

    // Todos os provedores remotos falharam: aciona a Contingência Local
    logger.warn(`[FallbackManager] Todos os provedores remotos falharam. Acionando Contingência Local Segura.`);
    this.recordFallback({
      tenant_id: params.establishmentId,
      establishment_id: params.establishmentId,
      provider_from: chain[chain.length - 1] || 'remote',
      provider_to: 'local_contingency',
      reason: lastError?.message || 'Todos os provedores indisponíveis',
      model: params.model,
      task: params.task,
      result: 'SUCCESS'
    });

    return {
      result: params.localContingency(),
      usedProvider: 'local_contingency',
      fallbackOccurred: true
    };
  }
}

export const maiaFallbackManager = new MaiaFallbackManager();

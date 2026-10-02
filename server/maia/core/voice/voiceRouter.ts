/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA VOICE ROUTER (PROMPT 09 - Seções 2, 4, 5, 26, 27)
 * Roteador especializado da camada de voz integrado ao MaiaAIRouter.
 * 
 * Orquestra a resolução do provedor adequado e a cascata de fallback:
 * Nível 1: Gemini Live (Realtime Voice nativo)
 * Nível 2: 9router Gateway Realtime (se habilitado)
 * Nível 3: Cascade Fallback (STT -> LLM -> TTS)
 * Nível 4 & 5: Contingency Local (Modo sem IA / Offline)
 */

import { IVoiceProvider, VoiceSessionConfig } from './types.js';
import { geminiLiveVoiceProvider, GeminiLiveVoiceProvider } from './providers/geminiLiveProvider.js';
import { nineRouterVoiceProvider, NineRouterVoiceProvider } from './providers/nineRouterVoiceProvider.js';
import { cascadeFallbackVoiceProvider, CascadeFallbackVoiceProvider } from './providers/cascadeFallbackVoiceProvider.js';
import { contingencyVoiceProvider, ContingencyVoiceProvider } from './providers/contingencyVoiceProvider.js';
import { maiaAIRouter, MaiaAIRouter } from '../router/aiRouter.js';

export interface VoiceRouteResolution {
  provider: IVoiceProvider;
  fromFallback: boolean;
  reason?: string;
}

export class MaiaVoiceRouter {
  private providers = new Map<string, IVoiceProvider>();
  private aiRouter: MaiaAIRouter;

  constructor(deps?: { aiRouter?: MaiaAIRouter }) {
    this.aiRouter = deps?.aiRouter || maiaAIRouter;

    // Registra provedores canônicos
    this.registerProvider(geminiLiveVoiceProvider);
    this.registerProvider(nineRouterVoiceProvider);
    this.registerProvider(cascadeFallbackVoiceProvider);
    this.registerProvider(contingencyVoiceProvider);
  }

  public registerProvider(provider: IVoiceProvider): void {
    this.providers.set(provider.id, provider);
  }

  public getProvider(id: string): IVoiceProvider | undefined {
    return this.providers.get(id);
  }

  /**
   * Resolve o melhor provedor para a sessão de voz com base em políticas, gateways e resiliência
   */
  public async resolveVoiceRoute(config: VoiceSessionConfig): Promise<VoiceRouteResolution> {
    const tenantId = config.tenantId;

    // 1. Verificação de desativação global ou por tenant de IA (Seção 27)
    const isAiDisabled = process.env.AI_ENABLED === 'false' || process.env.MAIA_ENABLED === 'false';
    const tenantPolicy = this.aiRouter.getTenantPolicy(tenantId);

    if (isAiDisabled || (tenantPolicy && !tenantPolicy.aiEnabled)) {
      return {
        provider: contingencyVoiceProvider,
        fromFallback: true,
        reason: 'IA desativada no ambiente ou política do locatário (Modo Contingência Local).'
      };
    }

    // 2. Avaliação de Quotas e Circuit Breaker
    try {
      this.aiRouter.quotaTracker.assertCanExecute(tenantId);
    } catch {
      return {
        provider: contingencyVoiceProvider,
        fromFallback: true,
        reason: 'Quota de IA excedida para o locatário.'
      };
    }

    // 3. Preferência de Gateway corporativo 9router (Seção 6)
    if (nineRouterVoiceProvider.isEnabled) {
      const health = await nineRouterVoiceProvider.checkHealth();
      if (health.ok) {
        return {
          provider: nineRouterVoiceProvider,
          fromFallback: false
        };
      }
    }

    // 4. Provedor Primário Realtime: Gemini Live (Seção 4)
    const geminiHealth = await geminiLiveVoiceProvider.checkHealth();
    const isGeminiBlockedByCircuit = this.aiRouter.circuitBreaker.isOpen('gemini');

    if (geminiHealth.ok && !isGeminiBlockedByCircuit) {
      return {
        provider: geminiLiveVoiceProvider,
        fromFallback: false
      };
    }

    // 5. Nível 3: Fallback em Cascata (STT -> AI Router -> TTS) (Seções 9 e 26)
    return {
      provider: cascadeFallbackVoiceProvider,
      fromFallback: true,
      reason: 'Gemini Live primário offline; ativado fallback em cascata (STT -> LLM -> TTS).'
    };
  }
}

export const maiaVoiceRouter = new MaiaVoiceRouter();

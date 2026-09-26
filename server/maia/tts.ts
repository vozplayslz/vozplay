/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA TEXT-TO-SPEECH (TTS) SERVICE
 * Síntese vocal de anúncios, chamadas de fila e vinhetas com fallback resiliente.
 */

import { TTSRequest, TTSResponse } from './types.js';
import { aiModelRouter } from './router.js';
import { maiaVoiceManager } from './voice.js';
import { maiaConfigManager } from './config.js';
import { logger } from '../logger.js';

class MaiaTTSService {
  /**
   * Sintetiza fala a partir de texto com fallback estruturado
   */
  public async synthesize(
    establishmentId: string,
    request: TTSRequest
  ): Promise<TTSResponse> {
    const startTime = Date.now();
    const voiceId = request.voiceId || maiaVoiceManager.getActiveVoiceId(establishmentId);

    // Valida limites orçamentários antes da requisição
    const limitCheck = aiModelRouter.checkLimits(establishmentId);
    if (!limitCheck.allowed) {
      logger.info('[MaiaTTS] Limite de TTS atingido, ativando contingência textual/visual:', {
        reason: limitCheck.reason
      });
      return {
        audioBase64: null,
        mimeType: 'audio/wav',
        sampleRate: 24000,
        durationEstimateSec: Math.ceil(request.text.length / 15),
        fallbackUsed: true,
        textualFallback: request.text,
        provider: 'contingency_limit',
        model: 'local',
        latencyMs: 1
      };
    }

    const { provider, model, providerName } = aiModelRouter.resolveRoute(establishmentId, 'TTS');

    try {
      const response = await provider.generateSpeech(
        { ...request, voiceId },
        { model }
      );

      const latencyMs = Date.now() - startTime;
      maiaConfigManager.recordUsage(
        establishmentId,
        'TTS',
        model,
        latencyMs,
        true,
        response.fallbackUsed,
        request.text.length,
        response.audioBase64 ? 1000 : 0
      );

      return response;
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      logger.error('[MaiaTTS] Erro inesperado na síntese TTS, retornando fallback seguro:', {
        error: err?.message || String(err)
      });

      maiaConfigManager.recordUsage(
        establishmentId,
        'TTS',
        model,
        latencyMs,
        false,
        true
      );

      return {
        audioBase64: null,
        mimeType: 'audio/wav',
        sampleRate: 24000,
        durationEstimateSec: Math.ceil(request.text.length / 15),
        fallbackUsed: true,
        textualFallback: request.text,
        provider: providerName,
        model,
        latencyMs
      };
    }
  }
}

export const maiaTTSService = new MaiaTTSService();

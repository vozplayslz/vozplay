/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA VOICE SERVICE
 * Responsável pela orquestração de áudio e fala da MaIA para TV, Operador e Participantes.
 */

import { QueueCallVoicePayload } from '../types.js';
import { maiaTTSService } from '../tts.js';
import {
  buildQueueCallText,
  buildFirstAbsenceText,
  buildSecondAbsenceText
} from '../prompts.js';
import { maiaConfigManager } from '../config.js';
import { logger } from '../../logger.js';

class MaiaVoiceService {
  /**
   * Sintetiza o áudio da chamada do próximo participante para a TV e sistema
   */
  public async generateQueueCallAnnouncement(
    establishmentId: string,
    params: {
      queueItemId: string;
      participantDisplayName: string;
      musicTitle: string;
      musicArtist: string;
      isDuet?: boolean;
      partnerDisplayName?: string;
    }
  ): Promise<QueueCallVoicePayload> {
    const { speechText, visualText } = buildQueueCallText(
      params.participantDisplayName,
      params.musicTitle,
      params.musicArtist,
      params.isDuet,
      params.partnerDisplayName
    );

    const config = maiaConfigManager.getConfig(establishmentId);
    let audioBase64: string | null = null;
    let mimeType = 'audio/wav';

    if (config.enabled && config.announce_queue_calls) {
      try {
        const ttsRes = await maiaTTSService.synthesize(establishmentId, {
          text: speechText,
          style: 'animada'
        });
        audioBase64 = ttsRes.audioBase64;
        mimeType = ttsRes.mimeType;
      } catch (err) {
        logger.warn('[MaiaVoiceService] Falha na síntese de chamada de fila, mantendo fallback visual:', { error: String(err) });
      }
    }

    return {
      queueItemId: params.queueItemId,
      participantDisplayName: params.participantDisplayName,
      partnerDisplayName: params.partnerDisplayName,
      isDuet: params.isDuet,
      musicTitle: params.musicTitle,
      musicArtist: params.musicArtist,
      speechText,
      visualText,
      audioBase64,
      mimeType,
      callType: 'INITIAL',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Sintetiza o áudio da 1ª ausência do participante
   */
  public async generateFirstAbsenceAnnouncement(
    establishmentId: string,
    queueItemId: string,
    participantDisplayName: string,
    musicTitle: string,
    musicArtist: string
  ): Promise<QueueCallVoicePayload> {
    const { speechText, visualText } = buildFirstAbsenceText(participantDisplayName);

    let audioBase64: string | null = null;
    let mimeType = 'audio/wav';

    try {
      const ttsRes = await maiaTTSService.synthesize(establishmentId, {
        text: speechText,
        style: 'acolhedora_profissional'
      });
      audioBase64 = ttsRes.audioBase64;
      mimeType = ttsRes.mimeType;
    } catch (err) {
      logger.warn('[MaiaVoiceService] Falha na síntese de 1ª ausência, mantendo fallback visual:', { error: String(err) });
    }

    return {
      queueItemId,
      participantDisplayName,
      musicTitle,
      musicArtist,
      speechText,
      visualText,
      audioBase64,
      mimeType,
      callType: 'FIRST_ABSENCE',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Sintetiza o áudio da 2ª ausência consecutiva (música movida para o fim da fila)
   */
  public async generateSecondAbsenceAnnouncement(
    establishmentId: string,
    queueItemId: string,
    participantDisplayName: string,
    musicTitle: string,
    musicArtist: string,
    nextSingerName?: string
  ): Promise<QueueCallVoicePayload> {
    const { speechText, visualText } = buildSecondAbsenceText(participantDisplayName, nextSingerName);

    let audioBase64: string | null = null;
    let mimeType = 'audio/wav';

    try {
      const ttsRes = await maiaTTSService.synthesize(establishmentId, {
        text: speechText,
        style: 'cerimoniosa'
      });
      audioBase64 = ttsRes.audioBase64;
      mimeType = ttsRes.mimeType;
    } catch (err) {
      logger.warn('[MaiaVoiceService] Falha na síntese de 2ª ausência, mantendo fallback visual:', { error: String(err) });
    }

    return {
      queueItemId,
      participantDisplayName,
      musicTitle,
      musicArtist,
      speechText,
      visualText,
      audioBase64,
      mimeType,
      callType: 'SECOND_ABSENCE',
      timestamp: new Date().toISOString()
    };
  }
}

export const maiaVoiceService = new MaiaVoiceService();

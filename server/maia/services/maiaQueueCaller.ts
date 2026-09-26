/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA QUEUE CALLER SERVICE
 * Integração idempotente da MaIA com o ciclo de vida da fila do VozPlay.
 * Ao chamar participante ou detectar ausência, gera anúncio de voz e transmite via WebSocket.
 */

import { maiaVoiceService } from './maiaVoiceService.js';
import { wsServer } from '../../wsServer.js';
import { CallingParticipantState } from '../../../src/types.js';
import { logger } from '../../logger.js';

class MaiaQueueCaller {
  // Controle de idempotência para evitar anúncios duplicados simultâneos
  private activeAnnouncements = new Set<string>();

  /**
   * Processa a chamada inicial do próximo participante
   */
  public async handleParticipantCalled(
    establishmentId: string,
    callingState: CallingParticipantState
  ): Promise<void> {
    const key = `call-${callingState.queueItemId}`;
    if (this.activeAnnouncements.has(key)) {
      return; // Idempotência: chamada já em processamento
    }
    this.activeAnnouncements.add(key);

    try {
      // 1. Notifica início do processamento de voz da MaIA
      wsServer.broadcast('maia.voice.started' as any, {
        queueItemId: callingState.queueItemId,
        participantDisplayName: callingState.participantDisplayName,
        timestamp: new Date().toISOString()
      });

      // 2. Gera síntese vocal humanizada (ou fallback seguro)
      const announcement = await maiaVoiceService.generateQueueCallAnnouncement(
        establishmentId,
        {
          queueItemId: callingState.queueItemId,
          participantDisplayName: callingState.participantDisplayName,
          musicTitle: callingState.musicTitle,
          musicArtist: callingState.musicArtist,
          isDuet: callingState.isDuet,
          partnerDisplayName: callingState.partnerDisplayName
        }
      );

      // 3. Emite evento autorizado para TV, Mesa de Som e Participante
      wsServer.broadcast('participant.turn_called', {
        callingState: {
          queueItemId: callingState.queueItemId,
          participantDisplayName: callingState.participantDisplayName,
          partnerDisplayName: callingState.partnerDisplayName,
          isDuet: callingState.isDuet,
          musicTitle: callingState.musicTitle,
          musicArtist: callingState.musicArtist,
          remainingSeconds: callingState.remainingSeconds,
          calledAt: callingState.calledAt
        },
        maiaAnnouncement: announcement
      });

      wsServer.broadcast('maia.voice.completed' as any, {
        queueItemId: callingState.queueItemId,
        success: true,
        fallbackUsed: !announcement.audioBase64,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      logger.error('[MaiaQueueCaller] Erro ao processar anúncio vocal de chamada:', err);
      wsServer.broadcast('maia.voice.failed' as any, {
        queueItemId: callingState.queueItemId,
        error: 'Falha no processamento vocal. Mantendo aviso visual.',
        timestamp: new Date().toISOString()
      });
    } finally {
      setTimeout(() => {
        this.activeAnnouncements.delete(key);
      }, 5000);
    }
  }

  /**
   * Processa anúncio de 1ª ausência do participante (tempo esgotado)
   */
  public async handleFirstAbsence(
    establishmentId: string,
    queueItemId: string,
    participantDisplayName: string,
    musicTitle: string,
    musicArtist: string,
    queueItem?: any
  ): Promise<void> {
    try {
      const announcement = await maiaVoiceService.generateFirstAbsenceAnnouncement(
        establishmentId,
        queueItemId,
        participantDisplayName,
        musicTitle,
        musicArtist
      );

      wsServer.broadcast('participant.turn_missed', {
        item: queueItem,
        queueItemId,
        participantDisplayName,
        missedTurnCount: 1,
        message: 'O tempo de 30 segundos expirou. O participante foi mantido na fila para a próxima oportunidade.',
        maiaAnnouncement: announcement,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      logger.error('[MaiaQueueCaller] Erro ao anunciar 1ª ausência:', err);
    }
  }

  /**
   * Processa anúncio de 2ª ausência consecutiva (música movida para o fim da fila)
   */
  public async handleSecondAbsence(
    establishmentId: string,
    queueItemId: string,
    participantDisplayName: string,
    musicTitle: string,
    musicArtist: string,
    nextSingerName?: string,
    queueItem?: any
  ): Promise<void> {
    try {
      const announcement = await maiaVoiceService.generateSecondAbsenceAnnouncement(
        establishmentId,
        queueItemId,
        participantDisplayName,
        musicTitle,
        musicArtist,
        nextSingerName
      );

      wsServer.broadcast('participant.turn_missed_again', {
        item: queueItem,
        queueItemId,
        participantDisplayName,
        missedTurnCount: 2,
        movedToBack: true,
        message: 'Segunda perda de vez consecutiva. A música foi movida para o final da fila rotativa.',
        maiaAnnouncement: announcement,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      logger.error('[MaiaQueueCaller] Erro ao anunciar 2ª ausência:', err);
    }
  }
}

export const maiaQueueCaller = new MaiaQueueCaller();

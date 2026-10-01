/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA EVENT ENGINE — VOZPLAY NATIVE
 * Motor de eventos de karaokê assíncrono e não-bloqueante.
 * 
 * Princípios Fundamentais:
 * 1. Resiliência: A MaIA NUNCA bloqueia a fila ou a reprodução do VozPlay.
 * 2. Rate-Limiting & Cooldown: Evita poluição sonora e saturação visual do telão.
 * 3. Fallback: Se TTS ou modelo falharem, o VozPlay segue 100% operacional com aviso visual imediato.
 */

import { VozPlayEventName, VozPlaySystemEvent } from '../types.js';
import { maiaConfigManager } from '../config.js';
import { maiaQueueCaller } from '../services/maiaQueueCaller.js';
import { maiaVoiceService } from '../services/maiaVoiceService.js';
import { maiaTTSService } from '../tts.js';
import { maiaEventBus } from '../core/events/eventBus.js';
import { wsServer } from '../../wsServer.js';
import { db } from '../../db.js';
import { logger } from '../../logger.js';

// Mapeamento para namespaces canônicos de eventos de domínio
const CANONICAL_DOMAIN_EVENT_NAMES: Partial<Record<VozPlayEventName, string>> = {
  PARTICIPANT_CALLED: 'karaoke.queue.participant_called',
  PARTICIPANT_MISSED: 'karaoke.queue.participant_missed',
  PARTICIPANT_MOVED_TO_BACK: 'karaoke.queue.moved_to_back',
  SONG_FINISHED: 'karaoke.queue.song_finished',
  SONG_STARTED: 'karaoke.playback.started',
  SONG_ADDED: 'karaoke.queue.song_added',
  SONG_REMOVED: 'karaoke.queue.song_removed',
  SESSION_STARTED: 'karaoke.session.started',
  SESSION_ENDING: 'karaoke.session.ending',
  SESSION_PAUSED: 'karaoke.session.paused',
  SESSION_RESUMED: 'karaoke.session.resumed',
  QUEUE_EMPTY: 'karaoke.queue.empty',
  TV_CONNECTED: 'karaoke.tv.connected',
  TV_DISCONNECTED: 'karaoke.tv.disconnected',
  CONTROLLER_CONNECTED: 'karaoke.controller.connected',
  CONTROLLER_DISCONNECTED: 'karaoke.controller.disconnected'
};

// Cooldown em milissegundos por tipo de evento para evitar spam
const EVENT_COOLDOWNS_MS: Partial<Record<VozPlayEventName, number>> = {
  SESSION_STARTED: 60000,
  SESSION_ENDING: 60000,
  QUEUE_EMPTY: 90000,
  SONG_ADDED: 30000,
  SONG_FINISHED: 15000,
  CONTROLLER_CONNECTED: 30000,
  TV_CONNECTED: 30000
};

export class MaiaEventEngine {
  private lastEventTimestamps = new Map<string, number>();

  /**
   * Ponto de entrada assíncrono para os eventos do VozPlay Core
   */
  public async handleEvent(event: VozPlaySystemEvent): Promise<void> {
    const establishmentId = event.establishmentId || db.session.establishmentId || 'est-slz-lounge';
    const config = maiaConfigManager.getConfig(establishmentId);

    // Se a MaIA estiver globalmente desativada para o estabelecimento, não processa
    if (!config.enabled) {
      return;
    }

    // Verificação de Cooldown / Anti-Spam
    const cooldownDuration = EVENT_COOLDOWNS_MS[event.eventName] || 0;
    if (cooldownDuration > 0) {
      const cooldownKey = `${establishmentId}:${event.eventName}`;
      const lastTime = this.lastEventTimestamps.get(cooldownKey) || 0;
      const now = Date.now();
      if (now - lastTime < cooldownDuration) {
        return; // Evento em período de resfriamento
      }
      this.lastEventTimestamps.set(cooldownKey, now);
    }

    // Execução assíncrona desacoplada da thread principal
    setImmediate(async () => {
      try {
        // Notifica o barramento de eventos universal do MaIA Core com namespace canônico
        const canonicalName = CANONICAL_DOMAIN_EVENT_NAMES[event.eventName] || `karaoke.${event.eventName.toLowerCase()}`;
        maiaEventBus.emit({
          name: canonicalName,
          tenantId: establishmentId,
          source: 'MaiaEventEngine',
          payload: event.payload
        }).catch(() => {});

        // Compatibilidade legada se o nome canônico for diferente
        const legacyName = `karaoke.${event.eventName.toLowerCase()}`;
        if (legacyName !== canonicalName) {
          maiaEventBus.emit({
            name: legacyName,
            tenantId: establishmentId,
            source: 'MaiaEventEngine',
            payload: event.payload
          }).catch(() => {});
        }

        await this.processEventAction(event, establishmentId, config);
      } catch (err) {
        logger.error(`[MaiaEventEngine] Erro não-bloqueante ao processar evento '${event.eventName}':`, err);
      }
    });
  }

  /**
   * Seleciona e dispara a ação apropriada da MaIA Karaokê para o evento
   */
  private async processEventAction(
    event: VozPlaySystemEvent,
    establishmentId: string,
    config: any
  ): Promise<void> {
    switch (event.eventName) {
      case 'PARTICIPANT_CALLED': {
        // Chamada de participante com anúncio na TV e voz humanizada
        if (event.payload && config.announce_queue_calls) {
          await maiaQueueCaller.handleParticipantCalled(establishmentId, event.payload);
        }
        break;
      }

      case 'PARTICIPANT_MISSED': {
        // 1ª Ausência do participante (tempo de 30s esgotado)
        if (event.payload && config.announce_absences) {
          const { queueItemId, participantDisplayName, musicTitle, musicArtist, queueItem } = event.payload;
          await maiaQueueCaller.handleFirstAbsence(
            establishmentId,
            queueItemId,
            participantDisplayName,
            musicTitle,
            musicArtist,
            queueItem
          );
        }
        break;
      }

      case 'PARTICIPANT_MOVED_TO_BACK': {
        // 2ª Ausência consecutiva: música vai pro final da fila
        if (event.payload && config.announce_absences) {
          const { queueItemId, participantDisplayName, musicTitle, musicArtist, nextSingerName, queueItem } = event.payload;
          await maiaQueueCaller.handleSecondAbsence(
            establishmentId,
            queueItemId,
            participantDisplayName,
            musicTitle,
            musicArtist,
            nextSingerName,
            queueItem
          );
        }
        break;
      }

      case 'SONG_FINISHED': {
        // Música concluída: celebra o cantor e esquenta o próximo da fila
        const finishedSinger = event.payload?.participantDisplayName || 'Nosso cantor';
        const nextInQueue = db.queue.find(q => q.status === 'QUEUED');

        const praiseText = `Palmas pra ${finishedSinger}! Mandou muito bem! 👏`;
        const teaserText = nextInQueue 
          ? ` E já vai se preparando ${nextInQueue.participantDisplayName}, que a próxima música é sua! 🎤`
          : ` A fila tá aberta pra quem quiser soltar a voz!`;

        const fullText = `${praiseText}${teaserText}`;

        // Transmissão visual imediata para o telão
        wsServer.broadcast('maia.announcement' as any, {
          title: 'SHOW DE CARISMA!',
          message: fullText,
          speechText: fullText,
          durationSec: 5,
          timestamp: new Date().toISOString()
        });

        // Áudio opcional assíncrono se TV áudio estiver habilitado
        if (config.tv_audio_enabled) {
          this.synthesizeAndBroadcast(establishmentId, fullText);
        }
        break;
      }

      case 'SESSION_STARTED': {
        // Abertura oficial do karaokê
        const welcomeText = 'Boa noite, galera do VozPlay! O palco tá oficialmente aberto! Escolham suas músicas pelo celular e venham brilhar! 🎤✨';
        wsServer.broadcast('maia.announcement' as any, {
          title: 'PALCO ABERTO!',
          message: welcomeText,
          speechText: welcomeText,
          durationSec: 7,
          timestamp: new Date().toISOString()
        });

        if (config.tv_audio_enabled) {
          this.synthesizeAndBroadcast(establishmentId, welcomeText);
        }
        break;
      }

      case 'QUEUE_EMPTY': {
        // Fila vazia: convite animado à plateia
        const emptyText = 'A fila do karaokê tá livre! Escaneia o QR Code na mesa e garante logo a sua música!';
        wsServer.broadcast('maia.announcement' as any, {
          title: 'MICROFONE DISPONÍVEL!',
          message: emptyText,
          speechText: emptyText,
          durationSec: 6,
          timestamp: new Date().toISOString()
        });
        break;
      }

      case 'TV_CONNECTED': {
        logger.info('[MaiaEventEngine] Telão conectado e sincronizado com a MaIA.');
        break;
      }

      case 'CONTROLLER_CONNECTED': {
        logger.info('[MaiaEventEngine] Operador de mesa de som online.');
        break;
      }

      default:
        // Outros eventos são registrados sem intervenção sonora direta
        break;
    }
  }

  /**
   * Síntese vocal assíncrona e envio via WebSocket com proteção total contra falhas
   */
  private async synthesizeAndBroadcast(establishmentId: string, text: string) {
    try {
      const ttsRes = await maiaTTSService.synthesize(establishmentId, {
        text,
        style: 'animada'
      });

      if (ttsRes.audioBase64) {
        wsServer.broadcast('maia.audio.play' as any, {
          audioBase64: ttsRes.audioBase64,
          mimeType: ttsRes.mimeType,
          text,
          timestamp: new Date().toISOString()
        });
      }
    } catch (err) {
      logger.warn('[MaiaEventEngine] Falha silenciosa no TTS da MaIA. Telão manteve aviso visual:', { error: String(err) });
    }
  }
}

export const maiaEventEngine = new MaiaEventEngine();

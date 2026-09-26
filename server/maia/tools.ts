/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA TOOLS LAYER — VOZPLAY NATIVE
 * Camada autoritativa de ferramentas internas para a MaIA.
 * Valida establishment_id, session_id, RBAC e permissões sem acesso direto ao banco SQL.
 */

import { db } from '../db.js';
import { logger } from '../logger.js';
import { MaIAToolContext, MaIAToolDefinition } from './types.js';

export const maiaTools: Record<string, MaIAToolDefinition> = {
  getCurrentQueue: {
    name: 'getCurrentQueue',
    description: 'Retorna a fila ativa de músicas da sessão atual, filtrada e ordenada.',
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Número máximo de itens a retornar (padrão 10)' }
      }
    },
    execute: async (context: MaIAToolContext, params: { limit?: number }) => {
      // Validação de isolamento de estabelecimento
      if (context.establishmentId !== db.session.establishmentId) {
        throw new Error('Acesso negado: estabelecimento divergente da sessão ativa.');
      }

      const limit = Math.min(Math.max(1, Number(params.limit) || 10), 50);
      const activeQueue = db.queue
        .filter(q => q.status === 'QUEUED' || q.status === 'CALLED' || q.status === 'PLAYING')
        .slice(0, limit)
        .map(q => ({
          id: q.id,
          orderIndex: q.orderIndex,
          status: q.status,
          musicTitle: q.musicTitle,
          musicArtist: q.musicArtist,
          versionStyle: q.versionStyle,
          toneOffset: q.toneOffset,
          participantDisplayName: q.participantDisplayName,
          isDuet: q.isDuet,
          partnerDisplayName: q.partnerDisplayName
        }));

      db.logAudit(
        'SYSTEM',
        'MaIA_Tool',
        'AI_RECOMMENDATION',
        `MaIA consultou a fila da sessão (${activeQueue.length} itens retornados)`
      );

      return {
        sessionStatus: db.session.status,
        queueLength: activeQueue.length,
        items: activeQueue
      };
    }
  },

  getParticipantTurn: {
    name: 'getParticipantTurn',
    description: 'Consulta a posição e tempo estimado de espera para um participante específico.',
    parameters: {
      type: 'object',
      properties: {
        participantId: { type: 'string', description: 'Identificador do participante' }
      },
      required: ['participantId']
    },
    execute: async (context: MaIAToolContext, params: { participantId: string }) => {
      if (!params.participantId) {
        throw new Error('Identificador do participante é obrigatório.');
      }

      // Participante só pode consultar a si mesmo se tiver role PARTICIPANT
      if (context.actorRole === 'PARTICIPANT' && context.actorId && context.actorId !== params.participantId) {
        throw new Error('Acesso negado: você só pode consultar sua própria vaga.');
      }

      const item = db.queue.find(
        q => q.participantId === params.participantId && (q.status === 'QUEUED' || q.status === 'CALLED')
      );

      if (!item) {
        return {
          hasTurn: false,
          message: 'Você ainda não possui músicas ativas na fila do karaokê.'
        };
      }

      const queuedBefore = db.queue.filter(
        q => q.status === 'QUEUED' && q.orderIndex < item.orderIndex
      ).length;

      return {
        hasTurn: true,
        queueItemId: item.id,
        status: item.status,
        musicTitle: item.musicTitle,
        musicArtist: item.musicArtist,
        toneOffset: item.toneOffset,
        position: queuedBefore + 1,
        estimatedWaitMinutes: (queuedBefore + 1) * 4
      };
    }
  },

  getSessionStatus: {
    name: 'getSessionStatus',
    description: 'Retorna o status operacional da sessão do estabelecimento (ativa, pausada, horários).',
    parameters: { type: 'object', properties: {} },
    execute: async (context: MaIAToolContext) => {
      if (context.establishmentId !== db.session.establishmentId) {
        throw new Error('Acesso negado: estabelecimento inválido.');
      }

      return {
        sessionId: db.session.id,
        sessionName: db.session.name,
        sessionCode: db.session.code,
        status: db.session.status,
        activeControllerName: db.session.activeControllerName,
        totalSongsPlayed: db.metrics.totalSongsPlayed,
        playbackStatus: db.playbackState.status
      };
    }
  },

  getNextParticipant: {
    name: 'getNextParticipant',
    description: 'Retorna o próximo cantor elegível na fila sem alterar o estado do sistema.',
    parameters: { type: 'object', properties: {} },
    execute: async (context: MaIAToolContext) => {
      if (context.actorRole === 'PARTICIPANT') {
        throw new Error('Acesso restrito: Participantes não possuem acesso a esta ferramenta.');
      }

      const nextItem = db.queue.find(q => q.status === 'QUEUED');
      if (!nextItem) {
        return { hasNext: false, message: 'Fila vazia no momento.' };
      }

      return {
        hasNext: true,
        queueItemId: nextItem.id,
        participantDisplayName: nextItem.participantDisplayName,
        partnerDisplayName: nextItem.partnerDisplayName,
        isDuet: nextItem.isDuet,
        musicTitle: nextItem.musicTitle,
        musicArtist: nextItem.musicArtist,
        toneOffset: nextItem.toneOffset
      };
    }
  },

  getCurrentSong: {
    name: 'getCurrentSong',
    description: 'Retorna a música que está sendo cantada neste instante.',
    parameters: { type: 'object', properties: {} },
    execute: async () => {
      const playingItem = db.queue.find(q => q.status === 'PLAYING');
      if (!playingItem) {
        return { isPlaying: false, message: 'Nenhuma música tocando no momento.' };
      }

      const version = db.catalog.flatMap(m => m.versions).find(v => v.id === playingItem.versionId);

      return {
        isPlaying: true,
        musicTitle: playingItem.musicTitle,
        musicArtist: playingItem.musicArtist,
        participantDisplayName: playingItem.participantDisplayName,
        versionStyle: playingItem.versionStyle,
        toneOffset: playingItem.toneOffset,
        durationSeconds: version?.durationSec || 240
      };
    }
  },

  getTVStatus: {
    name: 'getTVStatus',
    description: 'Consulta se a TV do telão está conectada e ativa na sessão.',
    parameters: { type: 'object', properties: {} },
    execute: async () => {
      return {
        tvConnected: db.tvConnected,
        lastHeartbeat: db.lastTvHeartbeat,
        tvTheme: db.session.branding?.tvTheme || 'DARK'
      };
    }
  },

  getControllerStatus: {
    name: 'getControllerStatus',
    description: 'Consulta o status da mesa de som e do operador conectado.',
    parameters: { type: 'object', properties: {} },
    execute: async (context: MaIAToolContext) => {
      if (context.actorRole === 'PARTICIPANT') {
        throw new Error('Acesso restrito ao operador ou supervisor.');
      }

      return {
        activeControllerId: db.session.activeControllerId,
        activeControllerName: db.session.activeControllerName,
        isEmergencyTakeoverActive: db.session.activeControllerId === db.session.supervisorId
      };
    }
  },

  getSessionMetrics: {
    name: 'getSessionMetrics',
    description: 'Retorna métricas consolidadas da sessão para suporte ao Supervisor.',
    parameters: { type: 'object', properties: {} },
    execute: async (context: MaIAToolContext) => {
      if (context.actorRole !== 'SUPERVISOR' && context.actorRole !== 'SYSTEM_ADMIN') {
        throw new Error('Acesso restrito: Apenas o Supervisor pode consultar métricas gerenciais.');
      }

      return {
        totalSongsPlayed: db.metrics.totalSongsPlayed,
        uniqueParticipants: db.participants.size,
        totalDurationMinutes: Math.round((db.metrics.totalSongsPlayed * 210) / 60),
        currentQueueSize: db.queue.filter(q => q.status === 'QUEUED').length
      };
    }
  }
};

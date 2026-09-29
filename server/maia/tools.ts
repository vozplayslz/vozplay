/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA TOOLS LAYER — VOZPLAY NATIVE V1.0
 * Ferramentas autoritativas da MaIA Karaokê divididas em:
 * READ, ACTION, HIGH_RISK e CRITICAL.
 * 
 * Todas as tools são validadas pelo MaiaAuthorizationEngine antes de executar.
 */

import { db } from '../db.js';
import { wsServer } from '../wsServer.js';
import { authService } from '../auth.js';
import { logger } from '../logger.js';
import { MaIAToolContext, MaIAToolDefinition } from './types.js';

export const maiaTools: Record<string, MaIAToolDefinition> = {
  // ==========================================
  // CATEGORIA 1: READ (CONSULTAS SEGURAS)
  // ==========================================

  getCurrentQueue: {
    name: 'getCurrentQueue',
    category: 'READ',
    allowedRoles: ['PARTICIPANT', 'CONTROLLER', 'SUPERVISOR', 'SYSTEM_ADMIN', 'TV'],
    description: 'Retorna a fila ativa de músicas da sessão atual, filtrada e ordenada.',
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Número máximo de itens a retornar (padrão 10)' }
      }
    },
    execute: async (context: MaIAToolContext, params: { limit?: number }) => {
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

      return {
        sessionStatus: db.session.status,
        queueLength: activeQueue.length,
        items: activeQueue
      };
    }
  },

  getParticipantTurn: {
    name: 'getParticipantTurn',
    category: 'READ',
    allowedRoles: ['PARTICIPANT', 'CONTROLLER', 'SUPERVISOR', 'SYSTEM_ADMIN'],
    description: 'Consulta a posição e tempo estimado de espera para um participante específico.',
    parameters: {
      type: 'object',
      properties: {
        participantId: { type: 'string', description: 'Identificador do participante' }
      },
      required: ['participantId']
    },
    execute: async (context: MaIAToolContext, params: { participantId: string }) => {
      const targetId = params.participantId || context.actorId;
      if (!targetId) {
        throw new Error('Identificador do participante é obrigatório.');
      }

      // Regra de privacidade estrita: Participante só pode consultar a si próprio
      if (context.actorRole === 'PARTICIPANT' && context.actorId && context.actorId !== targetId) {
        throw new Error('Acesso negado: você só tem permissão para consultar sua própria vaga.');
      }

      const item = db.queue.find(
        q => q.participantId === targetId && (q.status === 'QUEUED' || q.status === 'CALLED')
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
        queuedBefore,
        estimatedWaitMinutes: (queuedBefore + 1) * 4
      };
    }
  },

  getSessionStatus: {
    name: 'getSessionStatus',
    category: 'READ',
    allowedRoles: ['PARTICIPANT', 'CONTROLLER', 'SUPERVISOR', 'SYSTEM_ADMIN', 'TV'],
    description: 'Retorna o status operacional da sessão do estabelecimento (ativa, pausada, horários).',
    parameters: { type: 'object', properties: {} },
    execute: async () => {
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
    category: 'READ',
    allowedRoles: ['CONTROLLER', 'SUPERVISOR', 'SYSTEM_ADMIN'],
    description: 'Retorna o próximo cantor elegível na fila sem alterar o estado do sistema.',
    parameters: { type: 'object', properties: {} },
    execute: async () => {
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
    category: 'READ',
    allowedRoles: ['PARTICIPANT', 'CONTROLLER', 'SUPERVISOR', 'SYSTEM_ADMIN', 'TV'],
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
    category: 'READ',
    allowedRoles: ['CONTROLLER', 'SUPERVISOR', 'SYSTEM_ADMIN'],
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
    category: 'READ',
    allowedRoles: ['CONTROLLER', 'SUPERVISOR', 'SYSTEM_ADMIN'],
    description: 'Consulta o status da mesa de som e do operador conectado.',
    parameters: { type: 'object', properties: {} },
    execute: async () => {
      return {
        activeControllerId: db.session.activeControllerId,
        activeControllerName: db.session.activeControllerName,
        isEmergencyTakeoverActive: db.session.activeControllerId === db.session.supervisorId
      };
    }
  },

  getSessionMetrics: {
    name: 'getSessionMetrics',
    category: 'READ',
    allowedRoles: ['SUPERVISOR', 'SYSTEM_ADMIN'],
    description: 'Retorna métricas consolidadas da sessão para suporte ao Supervisor.',
    parameters: { type: 'object', properties: {} },
    execute: async () => {
      return {
        totalSongsPlayed: db.metrics.totalSongsPlayed,
        uniqueParticipants: db.participants.size,
        totalDurationMinutes: Math.round((db.metrics.totalSongsPlayed * 210) / 60),
        currentQueueSize: db.queue.filter(q => q.status === 'QUEUED').length
      };
    }
  },

  getMusicRecommendations: {
    name: 'getMusicRecommendations',
    category: 'READ',
    allowedRoles: ['PARTICIPANT', 'CONTROLLER', 'SUPERVISOR', 'SYSTEM_ADMIN'],
    description: 'Recomenda músicas diretamente do acervo e catálogo oficial do VozPlay com base em gênero ou estilo.',
    parameters: {
      type: 'object',
      properties: {
        genre: { type: 'string', description: 'Gênero desejado (ex: Sertanejo, Pagode, Pop, Rock, MPB)' },
        limit: { type: 'number', description: 'Quantidade de sugestões (padrão 5)' }
      }
    },
    execute: async (_context: MaIAToolContext, params: { genre?: string; limit?: number }) => {
      const limit = Math.min(Math.max(1, Number(params.limit) || 5), 20);
      let catalog = db.catalog;

      if (params.genre && params.genre.trim()) {
        const queryGenre = params.genre.trim().toLowerCase();
        catalog = catalog.filter(m => m.genre.toLowerCase().includes(queryGenre));
      }

      if (catalog.length === 0) {
        catalog = db.catalog; // Fallback para acervo geral se filtro não encontrar
      }

      const suggestions = catalog.slice(0, limit).map(m => ({
        musicId: m.id,
        title: m.title,
        artist: m.artist,
        genre: m.genre,
        availableVersions: m.versions.map(v => v.style)
      }));

      return {
        count: suggestions.length,
        recommendations: suggestions,
        tip: 'Dica da MaIA Karaokê: Você pode escolher a versão (Karaokê, Acústico ou Ao Vivo) e ajustar o tom ao adicionar!'
      };
    }
  },

  // ==========================================
  // CATEGORIA 2: ACTION (AÇÕES OPERACIONAIS)
  // ==========================================

  skipSong: {
    name: 'skipSong',
    category: 'ACTION',
    allowedRoles: ['CONTROLLER', 'SUPERVISOR', 'SYSTEM_ADMIN'],
    description: 'Pula a música atual em reprodução (Requer operador ou supervisor).',
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Motivo do pulo de música' }
      }
    },
    execute: async (context: MaIAToolContext, params: { reason?: string }) => {
      const currentItem = db.queue.find(q => q.status === 'PLAYING');
      if (!currentItem) {
        return { success: false, message: 'Nenhuma música tocando no momento.' };
      }
      currentItem.status = 'COMPLETED';
      currentItem.completedAt = new Date().toISOString();
      db.metrics.totalSkips++;
      await db.persistQueueItem(currentItem);
      db.logAudit(
        context.actorRole === 'SUPERVISOR' ? 'SUPERVISOR' : 'CONTROLLER',
        context.actorName || 'Operador',
        'PLAYER_SKIP',
        `Música pulada via MaIA: ${currentItem.musicTitle}`
      );
      wsServer.broadcast('player.stop', { reason: params.reason || 'Música pulada via comando operacional' });
      wsServer.broadcastAuthoritativeState();
      return { success: true, message: `Música "${currentItem.musicTitle}" pulada com sucesso.` };
    }
  },

  broadcastAlert: {
    name: 'broadcastAlert',
    category: 'ACTION',
    allowedRoles: ['CONTROLLER', 'SUPERVISOR', 'SYSTEM_ADMIN'],
    description: 'Envia um aviso em destaque visual e textual para a TV e participantes.',
    parameters: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'Mensagem do aviso' },
        title: { type: 'string', description: 'Título do aviso' }
      },
      required: ['message']
    },
    execute: async (context: MaIAToolContext, params: { message: string; title?: string }) => {
      const cleanMessage = params.message.slice(0, 200);
      const title = params.title || 'COMUNICADO VOZPLAY';

      wsServer.broadcast('broadcast.alert' as any, {
        title,
        message: cleanMessage,
        author: context.actorName,
        timestamp: new Date().toISOString()
      });

      return { success: true, message: 'Aviso transmitido com sucesso.' };
    }
  },

  // ==========================================
  // CATEGORIA 3: HIGH_RISK (ALTO RISCO)
  // ==========================================

  removeQueueItem: {
    name: 'removeQueueItem',
    category: 'HIGH_RISK',
    allowedRoles: ['CONTROLLER', 'SUPERVISOR', 'SYSTEM_ADMIN'],
    description: 'Remove um item específico da fila de espera (Requer operador ou supervisor).',
    parameters: {
      type: 'object',
      properties: {
        queueItemId: { type: 'string', description: 'Identificador do item da fila' }
      },
      required: ['queueItemId']
    },
    execute: async (context: MaIAToolContext, params: { queueItemId: string }) => {
      const item = db.queue.find(q => q.id === params.queueItemId);
      if (!item) {
        throw new Error('Item não encontrado na fila.');
      }
      if (item.status === 'PLAYING') {
        throw new Error('A música está tocando agora. Use a opção de Pular no player.');
      }
      await db.queueMutex.runExclusive(async () => {
        item.status = 'CANCELLED';
        await db.reindexQueue();
        await db.persistQueueItem(item);
      });
      db.logAudit(
        context.actorRole === 'SUPERVISOR' ? 'SUPERVISOR' : 'CONTROLLER',
        context.actorName || 'Operador',
        'QUEUE_REMOVE',
        `Música removida via MaIA: ${item.musicTitle}`
      );
      wsServer.broadcast('queue.cancelled', { queueItemId: params.queueItemId });
      wsServer.broadcastAuthoritativeState();
      return { success: true, message: `Música "${item.musicTitle}" removida com sucesso.` };
    }
  },

  // ==========================================
  // CATEGORIA 4: CRITICAL (CRÍTICAS / SEGURANÇA)
  // ==========================================

  takeoverController: {
    name: 'takeoverController',
    category: 'CRITICAL',
    allowedRoles: ['SUPERVISOR', 'SYSTEM_ADMIN'],
    description: 'Aciona a Assunção Emergencial (Emergency Takeover) da mesa de som pelo Supervisor.',
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Motivo formal da assunção emergencial' }
      }
    },
    execute: async (context: MaIAToolContext, params: { reason?: string }) => {
      db.session.activeControllerId = 'supervisor-emergency';
      db.session.activeControllerName = `${context.actorName || db.session.supervisorName} (Controle de Emergência)`;
      await authService.revokeRoleTokens('CONTROLLER', db.session.establishmentId);
      wsServer.disconnectClientsByRole('CONTROLLER', 'Controle assumido emergencialmente pelo Supervisor.');
      const newCode = db.generateNewPresenceCode();
      db.logAudit(
        'SUPERVISOR',
        context.actorName || db.session.supervisorName,
        'EMERGENCY_TAKEOVER',
        `Supervisor assumiu o controle emergencial via MaIA. ${params.reason || ''}`
      );
      await db.persistSession(db.session);
      wsServer.broadcastAuthoritativeState();
      return {
        success: true,
        message: 'Assunção emergencial concluída com sucesso.',
        presenceCode: newCode.code
      };
    }
  }
};

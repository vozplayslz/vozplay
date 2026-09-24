/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * VOZPLAY - WebSocket Real-Time Server
 * Section 32 of PRD: Resilient Event-Based Real-Time Hub com RBAC e Multi-Tenant Real
 */

import { Server as HTTPServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { db } from './db.js';
import { WSEventType, WSMessage } from '../src/types.js';
import { authService } from './auth.js';
import { logger } from './logger.js';

interface ClientConnection {
  ws: WebSocket;
  role: 'PARTICIPANT' | 'CONTROLLER' | 'SUPERVISOR' | 'TV';
  establishmentId: string;
  sessionId: string;
  participantId?: string;
  token?: string;
  isAuthenticated: boolean;
  isAlive: boolean;
  ip: string;
}

class VozPlayWSServer {
  private wss: WebSocketServer | null = null;
  private clients: Set<ClientConnection> = new Set();
  private pingInterval: NodeJS.Timeout | null = null;

  public init(server: HTTPServer) {
    this.wss = new WebSocketServer({ server, path: '/ws' });

    this.wss.on('connection', async (ws: WebSocket, req) => {
      const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown-ip';
      
      // Extração de token ou perfil via Query Params
      let tokenFromQuery = '';
      let roleFromQuery: any = 'PARTICIPANT';
      let establishmentId = db.session.establishmentId;
      let sessionId = db.session.id;

      try {
        const url = new URL(req.url || '', 'http://localhost');
        tokenFromQuery = url.searchParams.get('token') || '';
        if (url.searchParams.get('role')) {
          roleFromQuery = url.searchParams.get('role');
        }
        if (url.searchParams.get('establishmentId')) {
          establishmentId = url.searchParams.get('establishmentId')!;
        }
        if (url.searchParams.get('sessionId')) {
          sessionId = url.searchParams.get('sessionId')!;
        }
      } catch {
        // Formato URL seguro
      }

      const conn: ClientConnection = {
        ws,
        role: roleFromQuery,
        establishmentId,
        sessionId,
        isAuthenticated: false,
        isAlive: true,
        ip
      };

      // Se passou token na URL, valida de imediato
      if (tokenFromQuery) {
        const authSession = await authService.verifyToken(tokenFromQuery);
        if (authSession) {
          conn.isAuthenticated = true;
          conn.token = tokenFromQuery;
          conn.role = authSession.role;
          conn.establishmentId = authSession.establishmentId;
          conn.sessionId = authSession.sessionId;
          conn.participantId = authSession.actorId;
          logger.info(`Cliente autenticado via handshake WebSocket: ${conn.role}`, { actorId: authSession.actorId });
        }
      }

      this.clients.add(conn);

      ws.on('pong', () => {
        conn.isAlive = true;
      });

      ws.on('message', async (data: string) => {
        try {
          const parsed = JSON.parse(data.toString());
          await this.handleClientMessage(conn, parsed);
        } catch (err) {
          logger.error('Erro ao processar mensagem do WebSocket:', err);
        }
      });

      ws.on('close', () => {
        if (conn.role === 'TV') {
          db.tvConnected = false;
          this.broadcast('tv.disconnected', { message: 'TV foi desconectada' });
          db.addNotification('tv_disconnected', 'TV Desconectada', 'A TV de reprodução perdeu a conexão com o servidor.', 'warning');
        }
        this.clients.delete(conn);
      });

      ws.on('error', (err) => {
        logger.warn('Alerta de erro no socket cliente:', { error: String(err), ip: conn.ip });
        this.clients.delete(conn);
      });

      // Se conectou como TV de imediato, marca status
      if (conn.role === 'TV') {
        db.tvConnected = true;
        db.lastTvHeartbeat = Date.now();
      }

      // Envia sincronização de estado inicial
      this.sendAuthoritativeState(conn);
    });

    // Heartbeat a cada 25 segundos para limpar conexões inativas/mortas
    this.pingInterval = setInterval(() => {
      this.clients.forEach((conn) => {
        if (!conn.isAlive) {
          conn.ws.terminate();
          this.clients.delete(conn);
          return;
        }
        conn.isAlive = false;
        conn.ws.ping();
      });
    }, 25000);

    // Verificação de expiração do código de presença (60s) e timeout de chamada (30s) a cada 1s
    setInterval(() => {
      const code = db.getPresenceCode();
      if (code.remainingSeconds === 60) {
        this.broadcast('presence.renewed', { code });
      }

      // Verificação autoritativa da janela de 30 segundos da chamada do participante
      const timeoutResult = db.checkCallingTimeout();
      if (timeoutResult && timeoutResult.expired) {
        if (timeoutResult.missedTurnCount === 1) {
          this.broadcast('participant.turn_missed', {
            item: timeoutResult.item,
            missedTurnCount: 1,
            message: 'O tempo de 30 segundos expirou. O participante foi mantido na fila para a próxima oportunidade.'
          });
        } else if (timeoutResult.missedTurnCount === 2) {
          this.broadcast('participant.turn_missed_again', {
            item: timeoutResult.item,
            missedTurnCount: 2,
            message: 'Segunda perda de vez consecutiva. A música foi movida para o final da fila rotativa.'
          });
          this.broadcast('queue.item_requeued', { item: timeoutResult.item });
        }
        this.broadcastAuthoritativeState();
      }
    }, 1000);
  }

  private async handleClientMessage(conn: ClientConnection, msg: any) {
    if (!msg || !msg.type) return;

    switch (msg.type) {
      // Handshake explícito ou re-registro do cliente
      case 'REGISTER_CLIENT':
      case 'auth.identify': {
        const token = msg.token;
        if (token) {
          const authSession = await authService.verifyToken(token);
          if (authSession) {
            conn.isAuthenticated = true;
            conn.token = token;
            conn.role = authSession.role;
            conn.establishmentId = authSession.establishmentId;
            conn.sessionId = authSession.sessionId;
            conn.participantId = authSession.actorId;
          }
        } else {
          // Registro compatível com interface aprovada
          conn.role = msg.role || conn.role || 'PARTICIPANT';
          conn.sessionId = msg.sessionId || db.session.id;
          conn.participantId = msg.participantId || conn.participantId;
        }

        if (conn.role === 'TV') {
          db.tvConnected = true;
          db.lastTvHeartbeat = Date.now();
          this.broadcast('tv.connected', { message: 'TV conectada com sucesso' });
          db.addNotification('tv_connected', 'TV Conectada', 'A TV de reprodução está online e sincronizada.', 'info');
        }

        this.sendAuthoritativeState(conn);
        break;
      }

      case 'REQUEST_SYNC': {
        this.sendAuthoritativeState(conn);
        break;
      }

      case 'PARTICIPANT_START_TURN': {
        const pId = conn.participantId || msg.participantId;
        const result = db.startTurn(pId, msg.queueItemId);
        if (result.success && result.item) {
          this.broadcast('participant.turn_started', { item: result.item });
          this.broadcast('player.play', { item: result.item });
          this.broadcastAuthoritativeState();
        } else {
          conn.ws.send(
            JSON.stringify({
              event: 'player.error',
              sessionId: db.session.id,
              payload: { error: result.error || 'Falha ao iniciar vez.' },
              timestamp: new Date().toISOString()
            })
          );
        }
        break;
      }

      case 'TV_PLAYER_STATE': {
        // Validação estrita de autorização: apenas TV pode enviar estado do player
        if (conn.role !== 'TV') {
          logger.security('Tentativa não autorizada de emitir TV_PLAYER_STATE por cliente que não é TV', {
            clientRole: conn.role,
            ip: conn.ip
          });
          return;
        }

        db.playbackState.status = msg.playbackState;
        db.playbackState.currentTimeSec = msg.currentTimeSec || 0;
        db.playbackState.updatedAt = new Date().toISOString();
        await db.persistPlaybackState();

        if (msg.playbackState === 'COMPLETED') {
          this.handleSongCompleted();
        } else {
          this.broadcast('player.state_changed', {
            playbackState: db.playbackState.status,
            currentQueueItemId: db.playbackState.currentQueueItemId
          });
        }
        break;
      }

      case 'TV_PLAYER_ERROR': {
        if (conn.role !== 'TV') {
          logger.security('Tentativa não autorizada de emitir TV_PLAYER_ERROR por cliente que não é TV', {
            clientRole: conn.role,
            ip: conn.ip
          });
          return;
        }

        const currentItem = db.queue.find(q => q.status === 'PLAYING');
        if (currentItem) {
          currentItem.status = 'ERROR';
          currentItem.errorMessage = msg.error || 'Erro no YouTube Embed (vídeo indisponível ou bloqueado)';
          await db.persistQueueItem(currentItem);
        }
        db.playbackState.status = 'ERROR';
        db.metrics.playbackErrors++;
        await db.persistPlaybackState();

        this.broadcast('player.error', {
          error: msg.error || 'Falha ao reproduzir vídeo no YouTube',
          item: currentItem
        });

        db.addNotification(
          'playback_error',
          'Erro de Reprodução na TV',
          `Não foi possível carregar a música "${currentItem?.musicTitle || ''}". O Controlador foi alertado.`,
          'error'
        );
        break;
      }
    }
  }

  private async handleSongCompleted() {
    const currentItem = db.queue.find(q => q.status === 'PLAYING');
    if (currentItem) {
      currentItem.status = 'COMPLETED';
      currentItem.completedAt = new Date().toISOString();
      db.metrics.totalSongsPlayed++;
      await db.persistQueueItem(currentItem);

      db.logAudit(
        'SYSTEM',
        'AutoPlayer',
        'SONG_COMPLETED',
        `Música concluída: ${currentItem.musicTitle} cantada por ${currentItem.participantDisplayName}`
      );
    }

    db.playbackState.currentQueueItemId = null;
    db.playbackState.status = 'IDLE';
    await db.persistPlaybackState();

    // Disparar chamada de 30 segundos para o próximo participante elegível
    if (db.session.status === 'ACTIVE') {
      const call = db.callNextParticipant('SYSTEM', 'AutoPlayer');
      if (call) {
        this.broadcast('participant.turn_called', { callingState: call });
      } else {
        this.broadcast('queue.completed', { item: currentItem });
      }
    } else {
      this.broadcast('queue.completed', { item: currentItem });
    }

    this.broadcastAuthoritativeState();
  }

  public sendAuthoritativeState(conn: ClientConnection) {
    if (conn.ws.readyState !== WebSocket.OPEN) return;

    if (conn.role === 'TV') {
      // Send strict TVSessionDTO (no private user data, WhatsApp or internal tokens)
      const tvDto = db.getTVSessionDTO();
      conn.ws.send(
        JSON.stringify({
          event: 'state.sync',
          sessionId: db.session.id,
          payload: { tv: tvDto },
          timestamp: new Date().toISOString()
        })
      );
    } else {
      // Send full state for participant/controller/supervisor
      conn.ws.send(
        JSON.stringify({
          event: 'state.sync',
          sessionId: db.session.id,
          payload: {
            session: db.session,
            queue: db.queue,
            playbackState: db.playbackState,
            callingState: db.callingState,
            presenceCode: conn.role === 'CONTROLLER' || conn.role === 'SUPERVISOR' ? db.getPresenceCode() : undefined,
            participantsCount: db.participants.size,
            tvConnected: db.tvConnected,
            metrics: conn.role === 'SUPERVISOR' ? db.metrics : undefined,
            notifications: conn.role === 'SUPERVISOR' ? db.notifications : undefined
          },
          timestamp: new Date().toISOString()
        })
      );
    }
  }

  public broadcast<T>(event: WSEventType, payload: T) {
    const msg: WSMessage<T> = {
      event,
      sessionId: db.session.id,
      payload,
      timestamp: new Date().toISOString()
    };
    const serialized = JSON.stringify(msg);

    this.clients.forEach((conn) => {
      if (conn.ws.readyState === WebSocket.OPEN) {
        // If event is state sync or affects TV, ensure TV gets sanitized payload
        if (conn.role === 'TV') {
          const tvDto = db.getTVSessionDTO();
          conn.ws.send(
            JSON.stringify({
              event,
              sessionId: db.session.id,
              payload: { ...payload, tv: tvDto },
              timestamp: new Date().toISOString()
            })
          );
        } else {
          conn.ws.send(serialized);
        }
      }
    });
  }

  public broadcastAuthoritativeState() {
    this.clients.forEach((conn) => {
      this.sendAuthoritativeState(conn);
    });
  }
}

export const wsServer = new VozPlayWSServer();

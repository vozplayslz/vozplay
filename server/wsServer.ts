/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * VOZPLAY - WebSocket Real-Time Server
 * Section 32 of PRD: Resilient Event-Based Real-Time Hub
 */

import { Server as HTTPServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { db } from './db.js';
import { WSEventType, WSMessage } from '../src/types.js';

interface ClientConnection {
  ws: WebSocket;
  role: 'PARTICIPANT' | 'CONTROLLER' | 'SUPERVISOR' | 'TV';
  sessionId: string;
  participantId?: string;
  isAlive: boolean;
}

class VozPlayWSServer {
  private wss: WebSocketServer | null = null;
  private clients: Set<ClientConnection> = new Set();
  private pingInterval: NodeJS.Timeout | null = null;

  public init(server: HTTPServer) {
    this.wss = new WebSocketServer({ server, path: '/ws' });

    this.wss.on('connection', (ws: WebSocket, req) => {
      const conn: ClientConnection = {
        ws,
        role: 'PARTICIPANT',
        sessionId: db.session.id,
        isAlive: true
      };
      this.clients.add(conn);

      ws.on('pong', () => {
        conn.isAlive = true;
      });

      ws.on('message', (data: string) => {
        try {
          const parsed = JSON.parse(data.toString());
          this.handleClientMessage(conn, parsed);
        } catch (err) {
          console.error('[WS] Erro no parsing de mensagem:', err);
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
        console.error('[WS] Erro no socket cliente:', err);
        this.clients.delete(conn);
      });

      // Send initial state synchronization to new client
      this.sendAuthoritativeState(conn);
    });

    // Heartbeat every 25 seconds
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

    // Auto-renew presence code timer every 1 second check
    setInterval(() => {
      const code = db.getPresenceCode();
      if (code.remainingSeconds === 60) {
        // Just renewed!
        this.broadcast('presence.renewed', { code });
      }
    }, 1000);
  }

  private handleClientMessage(conn: ClientConnection, msg: any) {
    if (!msg || !msg.type) return;

    switch (msg.type) {
      case 'REGISTER_CLIENT': {
        conn.role = msg.role || 'PARTICIPANT';
        conn.sessionId = msg.sessionId || db.session.id;
        conn.participantId = msg.participantId;

        if (conn.role === 'TV') {
          db.tvConnected = true;
          db.lastTvHeartbeat = Date.now();
          this.broadcast('tv.connected', { message: 'TV conectada com sucesso' });
          db.addNotification('tv_connected', 'TV Conectada', 'A TV de reprodução está online e sincronizada.', 'info');
        }

        // Reply with role-specific sync
        this.sendAuthoritativeState(conn);
        break;
      }

      case 'REQUEST_SYNC': {
        this.sendAuthoritativeState(conn);
        break;
      }

      case 'TV_PLAYER_STATE': {
        if (conn.role === 'TV') {
          db.playbackState.status = msg.playbackState;
          db.playbackState.currentTimeSec = msg.currentTimeSec || 0;
          db.playbackState.updatedAt = new Date().toISOString();

          // If current song finished playing
          if (msg.playbackState === 'COMPLETED') {
            this.handleSongCompleted();
          } else {
            this.broadcast('player.state_changed', {
              playbackState: db.playbackState.status,
              currentQueueItemId: db.playbackState.currentQueueItemId
            });
          }
        }
        break;
      }

      case 'TV_PLAYER_ERROR': {
        if (conn.role === 'TV') {
          const currentItem = db.queue.find(q => q.status === 'PLAYING');
          if (currentItem) {
            currentItem.status = 'ERROR';
            currentItem.errorMessage = msg.error || 'Erro no YouTube Embed (vídeo indisponível ou bloqueado)';
          }
          db.playbackState.status = 'ERROR';
          db.metrics.playbackErrors++;

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
        }
        break;
      }
    }
  }

  private handleSongCompleted() {
    const currentItem = db.queue.find(q => q.status === 'PLAYING');
    if (currentItem) {
      currentItem.status = 'COMPLETED';
      currentItem.completedAt = new Date().toISOString();
      db.metrics.totalSongsPlayed++;

      db.logAudit(
        'SYSTEM',
        'AutoPlayer',
        'SONG_COMPLETED',
        `Música concluída: ${currentItem.musicTitle} cantada por ${currentItem.participantDisplayName}`
      );
    }

    db.playbackState.currentQueueItemId = null;
    db.playbackState.status = 'IDLE';

    // Auto-advance to next queued item if available
    const nextItem = db.queue.find(q => q.status === 'QUEUED');
    if (nextItem && db.session.status === 'ACTIVE') {
      nextItem.status = 'PLAYING';
      nextItem.startedAt = new Date().toISOString();
      db.playbackState.currentQueueItemId = nextItem.id;
      db.playbackState.status = 'PLAYING';

      this.broadcast('queue.playing', { item: nextItem });
      this.broadcast('player.play', { item: nextItem });
    } else {
      this.broadcast('queue.completed', { item: currentItem });
    }

    this.broadcastAuthoritativeState();
  }

  public sendAuthoritativeState(conn: ClientConnection) {
    if (conn.ws.readyState !== WebSocket.OPEN) return;

    if (conn.role === 'TV') {
      // Send strict TVSessionDTO (no private user data)
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

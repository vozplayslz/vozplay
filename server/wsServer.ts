/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * VOZPLAY - Hardened Authoritative WebSocket Server
 * - Autenticação obrigatória via Bearer Token
 * - Role, actorId, sessionId e establishmentId derivados 100% do token validado
 * - Proibido elevar privilégio via payload não autenticado
 * - Tratamento de reconexões, heartbeat ativo (ping-pong) e prevenção de conexões duplicadas
 */

import { Server as HTTPServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { db } from './db.js';
import { WSEventType, WSMessage } from '../src/types.js';
import { authService, UserRole } from './auth.js';
import { logger } from './logger.js';

interface ClientConnection {
  id: string;
  ws: WebSocket;
  role: UserRole;
  actorId?: string;
  actorName?: string;
  establishmentId: string;
  sessionId: string;
  participantId?: string;
  token?: string;
  isAuthenticated: boolean;
  isAlive: boolean;
  ip: string;
  connectedAt: string;
}

class VozPlayWSServer {
  private wss: WebSocketServer | null = null;
  private clients: Set<ClientConnection> = new Set();
  private pingInterval: NodeJS.Timeout | null = null;
  private presenceInterval: NodeJS.Timeout | null = null;

  public init(server: HTTPServer) {
    this.wss = new WebSocketServer({ server, path: '/ws' });

    this.wss.on('connection', async (ws: WebSocket, req) => {
      const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown-ip';
      const connId = 'conn-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);

      let tokenFromQuery = '';
      try {
        const url = new URL(req.url || '', 'http://localhost');
        tokenFromQuery = url.searchParams.get('token') || '';
      } catch {
        // Safe URL parse
      }

      const conn: ClientConnection = {
        id: connId,
        ws,
        role: 'PARTICIPANT',
        establishmentId: db.session.establishmentId,
        sessionId: db.session.id,
        isAuthenticated: false,
        isAlive: true,
        ip,
        connectedAt: new Date().toISOString()
      };

      // Se passou token na URL do handshake, autentica imediatamente
      if (tokenFromQuery) {
        const authSession = await authService.verifyToken(tokenFromQuery);
        if (authSession) {
          this.applyAuthenticatedSession(conn, authSession, tokenFromQuery);
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
          logger.warn('Mensagem WebSocket malformada recebida:', { error: String(err), ip: conn.ip });
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

      // Se conectou como TV autenticada, atualiza status
      if (conn.isAuthenticated && conn.role === 'TV') {
        db.tvConnected = true;
        db.lastTvHeartbeat = Date.now();
      }

      // Envia sincronização de estado inicial
      this.sendAuthoritativeState(conn);
    });

    // Heartbeat ativo a cada 25 segundos para limpar conexões zumbis
    this.pingInterval = setInterval(() => {
      this.clients.forEach((conn) => {
        if (!conn.isAlive) {
          try {
            conn.ws.terminate();
          } catch {}
          this.clients.delete(conn);
          return;
        }
        conn.isAlive = false;
        try {
          conn.ws.ping();
        } catch {
          this.clients.delete(conn);
        }
      });
    }, 25000);

    // Verificação de expiração do código de presença (60s) e timeout de chamada (30s) a cada 1s
    this.presenceInterval = setInterval(async () => {
      const code = db.getPresenceCode();
      if (code.remainingSeconds === 60) {
        this.broadcast('presence.renewed', { code });
      }

      // Verificação autoritativa da janela de 30 segundos da chamada do participante
      const timeoutResult = await db.checkCallingTimeout();
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

  /**
   * Vincula sessão autenticada a uma conexão WebSocket e previne conexões duplicadas
   */
  private applyAuthenticatedSession(conn: ClientConnection, authSession: any, token: string) {
    // Encerra qualquer conexão anterior existente para o mesmo ator
    for (const existing of this.clients) {
      if (
        existing.id !== conn.id &&
        existing.isAuthenticated &&
        existing.actorId === authSession.actorId &&
        existing.role === authSession.role
      ) {
        try {
          existing.ws.close(4001, 'Sessão substituída por nova conexão autenticada.');
        } catch {}
        this.clients.delete(existing);
      }
    }

    conn.isAuthenticated = true;
    conn.token = token;
    conn.role = authSession.role;
    conn.actorId = authSession.actorId;
    conn.actorName = authSession.actorName;
    conn.establishmentId = authSession.establishmentId;
    conn.sessionId = authSession.sessionId;
    if (authSession.role === 'PARTICIPANT') {
      conn.participantId = authSession.actorId;
    }

    if (conn.role === 'TV') {
      db.tvConnected = true;
      db.lastTvHeartbeat = Date.now();
      this.broadcast('tv.connected', { message: 'TV conectada com sucesso' });
      db.addNotification('tv_connected', 'TV Conectada', 'A TV de reprodução está online e sincronizada.', 'info');
    }

    logger.info(`WebSocket: Cliente autenticado com sucesso [${conn.role}] ${authSession.actorName}`, {
      actorId: authSession.actorId,
      establishmentId: authSession.establishmentId,
      sessionId: authSession.sessionId
    });
  }

  private async handleClientMessage(conn: ClientConnection, msg: any) {
    if (!msg || !msg.type) return;

    switch (msg.type) {
      // Handshake explícito ou re-registro do cliente com token
      case 'REGISTER_CLIENT':
      case 'auth.identify': {
        const token = msg.token;
        if (token && typeof token === 'string') {
          const authSession = await authService.verifyToken(token);
          if (authSession) {
            this.applyAuthenticatedSession(conn, authSession, token);
          } else {
            conn.ws.send(
              JSON.stringify({
                event: 'auth.error',
                payload: { message: 'Token de autenticação inválido ou expirado.' },
                timestamp: new Date().toISOString()
              })
            );
          }
        } else {
          // Cliente sem token permanece no perfil padrão de espectador/convidado não-privilegiado
          // NUNCA conceder role de CONTROLLER ou SUPERVISOR sem token válido
          if (msg.role && ['CONTROLLER', 'SUPERVISOR', 'SYSTEM_ADMIN'].includes(msg.role)) {
            logger.security(`Tentativa de elevação de privilégio não autorizada via WebSocket bloqueada`, {
              requestedRole: msg.role,
              ip: conn.ip
            });
            conn.ws.send(
              JSON.stringify({
                event: 'auth.forbidden',
                payload: { message: `Acesso negado. O perfil ${msg.role} exige token Bearer de autenticação.` },
                timestamp: new Date().toISOString()
              })
            );
            return;
          }
        }

        this.sendAuthoritativeState(conn);
        break;
      }

      case 'REQUEST_SYNC': {
        this.sendAuthoritativeState(conn);
        break;
      }

      case 'PARTICIPANT_START_TURN': {
        // Apenas o participante dono da vez ou operador autenticado pode iniciar
        const pId = conn.participantId || (conn.isAuthenticated ? conn.actorId : undefined);
        if (!pId) {
          conn.ws.send(
            JSON.stringify({
              event: 'player.error',
              sessionId: db.session.id,
              payload: { error: 'Participante não autenticado para iniciar a vez.' },
              timestamp: new Date().toISOString()
            })
          );
          return;
        }

        const result = await db.startTurn(pId, msg.queueItemId);
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

      case 'TV_HEARTBEAT': {
        if (conn.role === 'TV') {
          db.tvConnected = true;
          db.lastTvHeartbeat = Date.now();
        }
        break;
      }

      case 'REACTION': {
        // Reações da plateia para o telão
        if (msg.emoji && typeof msg.emoji === 'string') {
          const emoji = msg.emoji.slice(0, 10);
          db.recordTvReaction(conn.participantId, emoji, msg.label);
          this.broadcast('reaction.received', {
            emoji,
            label: msg.label,
            participantId: conn.participantId,
            timestamp: new Date().toISOString()
          });
        }
        break;
      }

      default: {
        logger.info(`Evento WebSocket recebido: ${msg.type}`, { role: conn.role, actorId: conn.actorId });
        break;
      }
    }
  }

  /**
   * Envia o estado autoritativo completo para uma conexão específica
   */
  public sendAuthoritativeState(conn: ClientConnection) {
    if (conn.ws.readyState !== WebSocket.OPEN) return;

    if (conn.role === 'TV') {
      const tvDTO = db.getTVSessionDTO();
      conn.ws.send(
        JSON.stringify({
          event: 'state.tv_sync',
          sessionId: db.session.id,
          payload: tvDTO,
          timestamp: new Date().toISOString()
        })
      );
    } else {
      const statePayload = {
        session: db.session,
        queue: db.queue,
        playbackState: db.playbackState,
        callingState: db.callingState,
        tvConnected: db.tvConnected,
        presenceCode: ['CONTROLLER', 'SUPERVISOR', 'SYSTEM_ADMIN'].includes(conn.role) ? db.getPresenceCode() : undefined,
        branding: db.session.branding,
        metrics: ['CONTROLLER', 'SUPERVISOR', 'SYSTEM_ADMIN'].includes(conn.role) ? db.metrics : undefined
      };

      conn.ws.send(
        JSON.stringify({
          event: 'state.full_sync',
          sessionId: db.session.id,
          payload: statePayload,
          timestamp: new Date().toISOString()
        })
      );
    }
  }

  /**
   * Propaga evento para todos os clientes conectados
   */
  public broadcast(event: WSEventType | string, payload: any = {}) {
    const msg = JSON.stringify({
      event,
      sessionId: db.session.id,
      payload,
      timestamp: new Date().toISOString()
    });

    this.clients.forEach((conn) => {
      if (conn.ws.readyState === WebSocket.OPEN) {
        // Garantia de privacidade: TV NUNCA recebe payloads com telefones ou tokens
        if (conn.role === 'TV' && (event.startsWith('participant.') || event.startsWith('queue.'))) {
          const sanitizedPayload = { ...payload };
          delete sanitizedPayload.whatsapp;
          delete sanitizedPayload.token;
          delete sanitizedPayload.phone;
          conn.ws.send(
            JSON.stringify({
              event,
              sessionId: db.session.id,
              payload: sanitizedPayload,
              timestamp: new Date().toISOString()
            })
          );
        } else {
          conn.ws.send(msg);
        }
      }
    });
  }

  /**
   * Transmite o estado autoritativo para toda a rede
   */
  public broadcastAuthoritativeState() {
    this.clients.forEach((conn) => {
      this.sendAuthoritativeState(conn);
    });
  }

  /**
   * Revoga e desconecta conexões ativas de um papel específico (ex: Takeover emergencial do Supervisor - Requisito 18)
   */
  public disconnectClientsByRole(role: UserRole, reason = 'Acesso revogado pelo Supervisor') {
    for (const conn of this.clients) {
      if (conn.role === role) {
        try {
          conn.ws.close(4003, reason);
        } catch {}
        this.clients.delete(conn);
      }
    }
  }
}

export const wsServer = new VozPlayWSServer();

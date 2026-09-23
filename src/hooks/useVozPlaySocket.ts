/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * VOZPLAY - WebSocket Client Hook
 * Resilient reconnection and real-time state synchronization
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { WSEventType, WSMessage } from '../types.js';

interface UseVozPlaySocketOptions {
  role: 'PARTICIPANT' | 'CONTROLLER' | 'SUPERVISOR' | 'TV';
  sessionId?: string;
  participantId?: string;
  onEvent?: (event: WSEventType, payload: any) => void;
}

export function useVozPlaySocket({
  role,
  sessionId,
  participantId,
  onEvent
}: UseVozPlaySocketOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [lastMessage, setLastMessage] = useState<WSMessage | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptRef = useRef(0);
  const onEventRef = useRef(onEvent);
  const roleRef = useRef(role);
  const sessionIdRef = useRef(sessionId);
  const participantIdRef = useRef(participantId);

  // Manter refs sincronizadas
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    roleRef.current = role;
    sessionIdRef.current = sessionId;
    participantIdRef.current = participantId;

    // Se o socket já estiver aberto e o perfil mudar (ex: troca de abas), re-registra imediatamente sem derrubar a conexão
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: 'REGISTER_CLIENT',
          role,
          sessionId: sessionId || 'sess-slz-01',
          participantId
        })
      );
    }
  }, [role, sessionId, participantId]);

  const connect = useCallback(() => {
    if (
      socketRef.current &&
      (socketRef.current.readyState === WebSocket.OPEN ||
        socketRef.current.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    try {
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        reconnectAttemptRef.current = 0;
        setReconnectAttempt(0);

        // Registra papel e sessão atuais
        ws.send(
          JSON.stringify({
            type: 'REGISTER_CLIENT',
            role: roleRef.current,
            sessionId: sessionIdRef.current || 'sess-slz-01',
            participantId: participantIdRef.current
          })
        );
      };

      ws.onmessage = (event) => {
        try {
          const data: WSMessage = JSON.parse(event.data);
          setLastMessage(data);
          if (onEventRef.current) {
            onEventRef.current(data.event, data.payload);
          }
        } catch (err) {
          console.error('[VozPlay Socket] Erro ao processar mensagem:', err);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        socketRef.current = null;

        // Reconexão resiliente com backoff exponencial
        const attempt = reconnectAttemptRef.current;
        const delay = Math.min(1000 * Math.pow(1.5, attempt), 10000);
        reconnectAttemptRef.current += 1;
        setReconnectAttempt(reconnectAttemptRef.current);

        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, delay);
      };

      ws.onerror = (err) => {
        console.warn('[VozPlay Socket] Alerta de conexão:', err);
        ws.close();
      };
    } catch (err) {
      console.error('[VozPlay Socket] Falha ao criar WebSocket:', err);
    }
  }, []);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [connect]);

  const send = useCallback((type: string, payload: any = {}) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type, ...payload }));
    }
  }, []);

  return {
    isConnected,
    reconnectAttempt,
    lastMessage,
    send
  };
}

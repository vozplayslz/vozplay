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

  const connect = useCallback(() => {
    if (socketRef.current && (socketRef.current.readyState === WebSocket.OPEN || socketRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    try {
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setReconnectAttempt(0);

        // Register client role and identity with the server
        ws.send(
          JSON.stringify({
            type: 'REGISTER_CLIENT',
            role,
            sessionId: sessionId || 'sess-slz-01',
            participantId
          })
        );
      };

      ws.onmessage = (event) => {
        try {
          const data: WSMessage = JSON.parse(event.data);
          setLastMessage(data);
          if (onEvent) {
            onEvent(data.event, data.payload);
          }
        } catch (err) {
          console.error('[VozPlay Socket] Erro ao processar mensagem:', err);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        socketRef.current = null;

        // Schedule resilient reconnection
        const delay = Math.min(1000 * Math.pow(1.5, reconnectAttempt), 10000);
        reconnectTimeoutRef.current = setTimeout(() => {
          setReconnectAttempt((prev) => prev + 1);
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
  }, [role, sessionId, participantId, reconnectAttempt, onEvent]);

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

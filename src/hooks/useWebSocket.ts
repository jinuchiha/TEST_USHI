import { useEffect, useRef, useCallback, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

type EventHandler = (data: any) => void;

/**
 * WebSocket hook for real-time features.
 * Auto-connects when in API mode and authenticated.
 */
export function useWebSocket() {
  const { currentUser, useApi } = useAuth();
  const wsRef = useRef<WebSocket | null>(null);
  const handlersRef = useRef<Map<string, EventHandler[]>>(new Map());
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!useApi || !currentUser) return;

    const wsUrl = (import.meta.env.VITE_WS_URL || 'ws://localhost:3000') + '/ws';

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        // Authenticate
        ws.send(JSON.stringify({ event: 'auth', data: { userId: currentUser.id } }));
      };

      ws.onmessage = (event) => {
        try {
          const { event: eventName, data } = JSON.parse(event.data);
          const handlers = handlersRef.current.get(eventName) || [];
          handlers.forEach(h => h(data));
        } catch {}
      };

      ws.onclose = () => {
        setIsConnected(false);
      };

      ws.onerror = () => {
        setIsConnected(false);
      };

      return () => {
        ws.close();
        wsRef.current = null;
        setIsConnected(false);
      };
    } catch {
      // WebSocket not available
      return;
    }
  }, [useApi, currentUser?.id]);

  const on = useCallback((event: string, handler: EventHandler) => {
    const existing = handlersRef.current.get(event) || [];
    handlersRef.current.set(event, [...existing, handler]);

    return () => {
      const handlers = handlersRef.current.get(event) || [];
      handlersRef.current.set(event, handlers.filter(h => h !== handler));
    };
  }, []);

  return { isConnected, on };
}

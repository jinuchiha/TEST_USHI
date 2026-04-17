import { useEffect, useRef, useCallback, useState } from 'react';

/**
 * useRealtimeSync
 *
 * Demo mode  → BroadcastChannel API (cross-tab sync, no server needed)
 * API mode   → Socket.io connection to /ws namespace
 *
 * Events emitted/received:
 *   case:updated       { caseId, crmStatus, subStatus, officerId, officerName }
 *   notification:new   { id, senderId, senderName, recipientId, message, priority }
 *   ptp:reminder       { caseId, debtorName, promisedAmount, promisedDate }
 *   workflow:triggered { ruleName, casesAffected }
 *   user:online        { userId }
 *   user:offline       { userId }
 *   payment:logged     { caseId, amount, currency, officerName }
 */

const BROADCAST_CHANNEL = 'rv_realtime';

export type RealtimeEvent =
  | { type: 'case:updated'; caseId: string; crmStatus: string; subStatus: string; officerId: string; officerName: string }
  | { type: 'notification:new'; id: string; senderId: string; senderName: string; recipientId: string; message: string; priority: string }
  | { type: 'ptp:reminder'; caseId: string; debtorName: string; promisedAmount: number; promisedDate: string }
  | { type: 'workflow:triggered'; ruleName: string; casesAffected: number }
  | { type: 'user:online'; userId: string }
  | { type: 'user:offline'; userId: string }
  | { type: 'payment:logged'; caseId: string; amount: number; currency: string; officerName: string };

interface UseRealtimeSyncOptions {
  useApi: boolean;
  userId?: string;
  onEvent?: (event: RealtimeEvent) => void;
}

interface RealtimeSyncState {
  isConnected: boolean;
  onlineUsers: string[];
  lastEvent: RealtimeEvent | null;
}

interface UseRealtimeSyncReturn extends RealtimeSyncState {
  broadcast: (event: RealtimeEvent) => void;
}

export function useRealtimeSync({ useApi, userId, onEvent }: UseRealtimeSyncOptions): UseRealtimeSyncReturn {
  const [state, setState] = useState<RealtimeSyncState>({
    isConnected: false,
    onlineUsers: [],
    lastEvent: null,
  });

  const channelRef = useRef<BroadcastChannel | null>(null);
  const socketRef = useRef<any>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  // ─── Demo Mode: BroadcastChannel ─────────────────────────────────────────

  useEffect(() => {
    if (useApi) return;

    let channel: BroadcastChannel;
    try {
      channel = new BroadcastChannel(BROADCAST_CHANNEL);
      channelRef.current = channel;

      channel.onmessage = (e: MessageEvent) => {
        const event = e.data as RealtimeEvent;
        setState(prev => ({ ...prev, lastEvent: event }));
        onEventRef.current?.(event);
      };

      // Mark as connected after short delay (mimics socket handshake)
      const t = setTimeout(() => {
        setState(prev => ({ ...prev, isConnected: true }));
      }, 200);

      // Announce self as online
      if (userId) {
        channel.postMessage({ type: 'user:online', userId } as RealtimeEvent);
      }

      return () => {
        clearTimeout(t);
        if (userId) {
          channel.postMessage({ type: 'user:offline', userId } as RealtimeEvent);
        }
        channel.close();
        channelRef.current = null;
        setState(prev => ({ ...prev, isConnected: false }));
      };
    } catch {
      // BroadcastChannel not supported (old browser) — stay disconnected silently
    }
  }, [useApi, userId]);

  // ─── API Mode: Socket.io ──────────────────────────────────────────────────

  useEffect(() => {
    if (!useApi) return;

    let socket: any;

    const connectSocket = async () => {
      try {
        // Socket.io-client must be loaded via <script> tag or installed as dependency.
        // Check globalThis for the `io` function provided by socket.io-client.
        const io = (globalThis as any).io as ((url: string, opts?: any) => any) | undefined;
        if (!io) {
          console.info('[RealtimeSync] socket.io-client not loaded — install it or add <script> tag for API mode');
          setState(prev => ({ ...prev, isConnected: true })); // Still mark as "connected" for UI
          return;
        }
        socket = io(`${window.location.origin}/ws`, {
          transports: ['websocket'],
          withCredentials: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 2000,
        });
        socketRef.current = socket;

        socket.on('connect', () => {
          setState(prev => ({ ...prev, isConnected: true }));
          if (userId) {
            socket.emit('auth', { userId });
          }
        });

        socket.on('disconnect', () => {
          setState(prev => ({ ...prev, isConnected: false }));
        });

        const eventTypes: RealtimeEvent['type'][] = [
          'case:updated',
          'notification:new',
          'ptp:reminder',
          'workflow:triggered',
          'user:online',
          'user:offline',
          'payment:logged',
        ];

        eventTypes.forEach(eventType => {
          socket.on(eventType, (data: any) => {
            const event = { type: eventType, ...data } as RealtimeEvent;
            setState(prev => {
              const onlineUsers = event.type === 'user:online'
                ? [...new Set([...prev.onlineUsers, event.userId])]
                : event.type === 'user:offline'
                ? prev.onlineUsers.filter(id => id !== event.userId)
                : prev.onlineUsers;
              return { ...prev, lastEvent: event, onlineUsers };
            });
            onEventRef.current?.(event);
          });
        });
      } catch (err) {
        console.warn('[RealtimeSync] Socket.io connection failed:', err);
      }
    };

    connectSocket();

    return () => {
      if (socket) {
        socket.disconnect();
        socketRef.current = null;
        setState(prev => ({ ...prev, isConnected: false }));
      }
    };
  }, [useApi, userId]);

  // ─── Broadcast helper ─────────────────────────────────────────────────────

  const broadcast = useCallback((event: RealtimeEvent) => {
    if (useApi) {
      // In API mode, emit via socket
      socketRef.current?.emit(event.type, event);
    } else {
      // Demo mode: broadcast to all other tabs
      channelRef.current?.postMessage(event);
      // Also fire locally so the sender's tab updates
      setState(prev => ({ ...prev, lastEvent: event }));
      onEventRef.current?.(event);
    }
  }, [useApi]);

  return { ...state, broadcast };
}

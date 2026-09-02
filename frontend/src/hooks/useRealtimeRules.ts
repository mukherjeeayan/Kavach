import { useEffect, useState, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { getAccessToken } from '../services/session';

/**
 * Generate a random delay with full jitter for reconnection.
 * Full jitter: random(0, min(cap, base * 2^attempt))
 * This prevents thundering herd when multiple clients reconnect
 * simultaneously after a server restart.
 */
function jitterDelay(attempt: number, base = 1000, cap = 30000): number {
  const exponential = Math.min(cap, base * Math.pow(2, attempt));
  return Math.floor(Math.random() * exponential);
}

/**
 * Subscribes to the backend's real-time `rule:changed` broadcast for a
 * child and invokes `onRuleChanged` whenever a rule changes.
 *
 * The socket URL is configurable via VITE_SOCKET_URL (defaults to the
 * same origin, which the Vite dev server proxies to the backend).
 * Returns `isConnected` so callers can fall back to polling when the
 * socket is down (offline dev server, blocked websockets, etc.).
 *
 * Reconnection uses exponential backoff with full jitter to prevent
 * thundering herd problems when the backend restarts.
 */
export const useRealtimeRules = (
  childId: string | null,
  onRuleChanged: () => void
): { isConnected: boolean } => {
  const [isConnected, setIsConnected] = useState(false);
  const onRuleChangedRef = useRef(onRuleChanged);
  const reconnectAttemptRef = useRef(0);
  const socketRef = useRef<Socket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Keep the ref up to date without re-creating the socket
  onRuleChangedRef.current = onRuleChanged;

  const cleanupReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const scheduleReconnect = useCallback(() => {
    cleanupReconnectTimer();
    const delay = jitterDelay(reconnectAttemptRef.current);
    reconnectTimerRef.current = setTimeout(() => {
      if (socketRef.current && !socketRef.current.connected) {
        socketRef.current.connect();
      }
    }, delay);
  }, [cleanupReconnectTimer]);

  useEffect(() => {
    if (!childId) return;

    const url = import.meta.env.VITE_SOCKET_URL as string | undefined;
    const token = getAccessToken() ?? undefined;
    // The backend requires an authenticated parent token during the
    // socket handshake; unauthenticated connections are rejected.
    const socket: Socket = url
      ? io(url, {
          auth: { token },
          reconnection: false, // We handle reconnection manually with jitter
          timeout: 10000,
        })
      : io({
          auth: { token },
          reconnection: false,
          timeout: 10000,
        });
    
    socketRef.current = socket;
    let disposed = false;

    const subscribe = () => {
      socket.emit('subscribe:child', childId);
    };

    socket.on('connect', () => {
      if (disposed) return;
      setIsConnected(true);
      reconnectAttemptRef.current = 0; // Reset on successful connection
      cleanupReconnectTimer();
      // socket.io reconnects automatically, but the room subscription
      // must be re-sent after every (re)connect.
      subscribe();
    });
    socket.on('disconnect', () => {
      if (!disposed) {
        setIsConnected(false);
        // Schedule reconnect with jitter
        scheduleReconnect();
      }
    });
    socket.on('connect_error', () => {
      if (!disposed) {
        setIsConnected(false);
        reconnectAttemptRef.current++;
        // Schedule reconnect with jitter
        scheduleReconnect();
      }
    });
    // Use ref to always call the latest callback without recreating socket
    socket.on('rule:changed', () => onRuleChangedRef.current());

    return () => {
      disposed = true;
      cleanupReconnectTimer();
      socket.off('rule:changed');
      socket.disconnect();
      socketRef.current = null;
    };
  }, [childId]);

  return { isConnected };
};

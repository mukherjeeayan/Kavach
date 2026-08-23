import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { getAccessToken } from '../services/session';

/**
 * Subscribes to the backend's real-time `rule:changed` broadcast for a
 * child and invokes `onRuleChanged` whenever a rule changes.
 *
 * The socket URL is configurable via VITE_SOCKET_URL (defaults to the
 * same origin, which the Vite dev server proxies to the backend).
 * Returns `isConnected` so callers can fall back to polling when the
 * socket is down (offline dev server, blocked websockets, etc.).
 */
export const useRealtimeRules = (
  childId: string | null,
  onRuleChanged: () => void
): { isConnected: boolean } => {
  const [isConnected, setIsConnected] = useState(false);
  const onRuleChangedRef = useRef(onRuleChanged);
  
  // Keep the ref up to date without re-creating the socket
  onRuleChangedRef.current = onRuleChanged;

  useEffect(() => {
    if (!childId) return;

    const url = import.meta.env.VITE_SOCKET_URL as string | undefined;
    const token = getAccessToken() ?? undefined;
    // The backend requires an authenticated parent token during the
    // socket handshake; unauthenticated connections are rejected.
    const socket: Socket = url ? io(url, { auth: { token } }) : io({ auth: { token } });
    let disposed = false;

    const subscribe = () => {
      socket.emit('subscribe:child', childId);
    };

    socket.on('connect', () => {
      if (disposed) return;
      setIsConnected(true);
      // socket.io reconnects automatically, but the room subscription
      // must be re-sent after every (re)connect.
      subscribe();
    });
    socket.on('disconnect', () => {
      if (!disposed) setIsConnected(false);
    });
    socket.on('connect_error', () => {
      if (!disposed) setIsConnected(false);
    });
    // Use ref to always call the latest callback without recreating socket
    socket.on('rule:changed', () => onRuleChangedRef.current());

    return () => {
      disposed = true;
      socket.off('rule:changed');
      socket.disconnect();
    };
  }, [childId]);

  return { isConnected };
};

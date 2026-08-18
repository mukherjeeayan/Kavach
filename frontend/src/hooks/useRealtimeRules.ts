import { useEffect } from 'react';
import { io } from 'socket.io-client';

/**
 * Subscribes to the backend's real-time `rule:changed` broadcast for a
 * child and invokes `onRuleChanged` whenever a rule changes — no polling.
 */
export const useRealtimeRules = (childId: string | null, onRuleChanged: () => void) => {
  useEffect(() => {
    if (!childId) return;
    const socket = io();
    socket.emit('subscribe:child', childId);
    socket.on('rule:changed', onRuleChanged);
    return () => {
      socket.off('rule:changed', onRuleChanged);
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childId]);
};

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useRealtimeRules } from './useRealtimeRules';
import { io } from 'socket.io-client';
import { getAccessToken } from '../services/session';

vi.mock('socket.io-client', () => ({
  io: vi.fn(),
}));

vi.mock('../services/session', () => ({
  getAccessToken: vi.fn(),
}));

const mockSocket = {
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
  disconnect: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(io).mockReturnValue(mockSocket as never);
  vi.mocked(getAccessToken).mockReturnValue('test-token');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useRealtimeRules', () => {
  it('returns isConnected as false initially', () => {
    const { result } = renderHook(() => useRealtimeRules('child-1', vi.fn()));
    expect(result.current.isConnected).toBe(false);
  });

  it('creates socket connection when childId is provided', () => {
    renderHook(() => useRealtimeRules('child-1', vi.fn()));
    expect(io).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ auth: { token: 'test-token' } }));
    expect(mockSocket.on).toHaveBeenCalledWith('connect', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('connect_error', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('rule:changed', expect.any(Function));
  });

  it('does not create socket when childId is null', () => {
    renderHook(() => useRealtimeRules(null, vi.fn()));
    expect(io).not.toHaveBeenCalled();
  });

  it('emits subscribe:child on connect', () => {
    renderHook(() => useRealtimeRules('child-1', vi.fn()));
    const connectCallback = mockSocket.on.mock.calls.find(
      (call: unknown[]) => call[0] === 'connect'
    )?.[1];
    expect(connectCallback).toBeDefined();
    connectCallback!();
    expect(mockSocket.emit).toHaveBeenCalledWith('subscribe:child', 'child-1');
  });

  it('disconnects socket on cleanup', () => {
    const { unmount } = renderHook(() => useRealtimeRules('child-1', vi.fn()));
    unmount();
    expect(mockSocket.off).toHaveBeenCalledWith('rule:changed');
    expect(mockSocket.disconnect).toHaveBeenCalled();
  });

  it('calls onRuleChanged when rule:changed event fires', () => {
    const onRuleChanged = vi.fn();
    renderHook(() => useRealtimeRules('child-1', onRuleChanged));
    const ruleChangedCallback = mockSocket.on.mock.calls.find(
      (call: unknown[]) => call[0] === 'rule:changed'
    )?.[1];
    expect(ruleChangedCallback).toBeDefined();
    ruleChangedCallback!();
    expect(onRuleChanged).toHaveBeenCalled();
  });
});

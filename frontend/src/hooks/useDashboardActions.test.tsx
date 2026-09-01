import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useBlockAppAction, useRespondToUnblockRequest } from './useDashboardActions';
import * as api from '../services/api';
import type { ReactNode } from 'react';
import type { BlockAppInput } from '../services/api';
import type { AppBlockRule } from '../types/api';

vi.mock('../services/api');
vi.mock('../utils/apiError', () => ({
  getErrorMessage: (_err: unknown, fallback: string) => fallback,
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

const mockBlockInput: BlockAppInput = {
  device_id: 'device-1',
  package_name: 'com.example.app',
  block_reason: 'Distraction',
};

const mockBlockRule: AppBlockRule = {
  id: 'rule-1',
  device_id: 'device-1',
  package_name: 'com.example.app',
  app_name: 'Example',
  is_blocked: true,
  block_reason: 'Distraction',
  unblock_requested: false,
  unblock_reason: null,
  daily_limit_minutes: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

describe('useBlockAppAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns mutation helpers', () => {
    const onSuccess = vi.fn();
    const onError = vi.fn();
    const { result } = renderHook(() => useBlockAppAction('child-1', onSuccess, onError), {
      wrapper: createWrapper(),
    });
    expect(typeof result.current.mutate).toBe('function');
    expect(result.current.isIdle).toBe(true);
  });

  it('calls blockApp API on mutate', async () => {
    vi.mocked(api.blockApp).mockResolvedValue(mockBlockRule);
    const onSuccess = vi.fn();
    const onError = vi.fn();
    const { result } = renderHook(() => useBlockAppAction('child-1', onSuccess, onError), {
      wrapper: createWrapper(),
    });

    result.current.mutate(mockBlockInput);

    await waitFor(() => {
      expect(api.blockApp).toHaveBeenCalledWith('child-1', mockBlockInput);
    });
  });

  it('calls onSuccess callback after successful mutation', async () => {
    vi.mocked(api.blockApp).mockResolvedValue(mockBlockRule);
    const onSuccess = vi.fn();
    const onError = vi.fn();
    const { result } = renderHook(() => useBlockAppAction('child-1', onSuccess, onError), {
      wrapper: createWrapper(),
    });

    result.current.mutate(mockBlockInput);

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled();
    });
    expect(onError).not.toHaveBeenCalled();
  });

  it('calls onError callback when blockApp fails', async () => {
    vi.mocked(api.blockApp).mockRejectedValue(new Error('Network error'));
    const onSuccess = vi.fn();
    const onError = vi.fn();
    const { result } = renderHook(() => useBlockAppAction('child-1', onSuccess, onError), {
      wrapper: createWrapper(),
    });

    result.current.mutate(mockBlockInput);

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith('Failed to block app');
    });
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('uses empty string when childId is null', async () => {
    vi.mocked(api.blockApp).mockResolvedValue(mockBlockRule);
    const onSuccess = vi.fn();
    const onError = vi.fn();
    const { result } = renderHook(() => useBlockAppAction(null, onSuccess, onError), {
      wrapper: createWrapper(),
    });

    result.current.mutate(mockBlockInput);

    await waitFor(() => {
      expect(api.blockApp).toHaveBeenCalledWith('', mockBlockInput);
    });
  });
});

describe('useRespondToUnblockRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns mutation helpers', () => {
    const onSuccess = vi.fn();
    const onError = vi.fn();
    const { result } = renderHook(() => useRespondToUnblockRequest('child-1', onSuccess, onError), {
      wrapper: createWrapper(),
    });
    expect(typeof result.current.mutate).toBe('function');
    expect(result.current.isIdle).toBe(true);
  });

  it('calls respondToUnblockRequest API with approve decision', async () => {
    vi.mocked(api.respondToUnblockRequest).mockResolvedValue(mockBlockRule);
    const onSuccess = vi.fn();
    const onError = vi.fn();
    const { result } = renderHook(() => useRespondToUnblockRequest('child-1', onSuccess, onError), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ ruleId: 'rule-1', decision: 'approve' });

    await waitFor(() => {
      expect(api.respondToUnblockRequest).toHaveBeenCalledWith('child-1', 'rule-1', 'approve');
    });
  });

  it('calls respondToUnblockRequest API with reject decision', async () => {
    vi.mocked(api.respondToUnblockRequest).mockResolvedValue(mockBlockRule);
    const onSuccess = vi.fn();
    const onError = vi.fn();
    const { result } = renderHook(() => useRespondToUnblockRequest('child-1', onSuccess, onError), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ ruleId: 'rule-1', decision: 'reject' });

    await waitFor(() => {
      expect(api.respondToUnblockRequest).toHaveBeenCalledWith('child-1', 'rule-1', 'reject');
    });
  });

  it('calls onError when request fails', async () => {
    vi.mocked(api.respondToUnblockRequest).mockRejectedValue(new Error('Server error'));
    const onSuccess = vi.fn();
    const onError = vi.fn();
    const { result } = renderHook(() => useRespondToUnblockRequest('child-1', onSuccess, onError), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ ruleId: 'rule-1', decision: 'approve' });

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith('Failed to update the unblock request. Please retry.');
    });
    expect(onSuccess).not.toHaveBeenCalled();
  });
});

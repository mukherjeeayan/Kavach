import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSosEvents, useAcknowledgeSos, useResolveSos } from './useSos';
import * as api from '../services/api';
import type { ReactNode } from 'react';

vi.mock('../services/api');

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('useSosEvents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns initial state', () => {
    const { result } = renderHook(() => useSosEvents('child-1'), { wrapper: createWrapper() });
    expect(result.current.isPending).toBe(true);
    expect(result.current.data).toBeUndefined();
    expect(result.current.isError).toBe(false);
  });

  it('fetches SOS events when childId is provided', async () => {
    const mockEvents = [
      { id: 'evt-1', child_id: 'child-1', trigger_method: 'button', status: 'ACTIVE', created_at: '2026-08-20T10:00:00Z' },
    ];
    vi.mocked(api.fetchSosEvents).mockResolvedValue(mockEvents);

    const { result } = renderHook(() => useSosEvents('child-1'), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data).toEqual(mockEvents);
    });
  });

  it('does not fetch when childId is null', () => {
    const { result } = renderHook(() => useSosEvents(null), { wrapper: createWrapper() });
    expect(result.current.isPending).toBe(true);
    expect(api.fetchSosEvents).not.toHaveBeenCalled();
  });
});

describe('useAcknowledgeSos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns mutation interface', () => {
    const { result } = renderHook(() => useAcknowledgeSos('child-1'), { wrapper: createWrapper() });
    expect(typeof result.current.mutate).toBe('function');
    expect(result.current.isPending).toBe(false);
  });

  it('calls acknowledgeSos on mutate', async () => {
    const mockEvent = { id: 'evt-1' };
    vi.mocked(api.acknowledgeSos).mockResolvedValue(mockEvent as never);

    const { result } = renderHook(() => useAcknowledgeSos('child-1'), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync(mockEvent.id);
    });

    expect(api.acknowledgeSos).toHaveBeenCalledWith('child-1', mockEvent.id);
  });
});

describe('useResolveSos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns mutation interface', () => {
    const { result } = renderHook(() => useResolveSos('child-1'), { wrapper: createWrapper() });
    expect(typeof result.current.mutate).toBe('function');
    expect(result.current.isPending).toBe(false);
  });

  it('calls resolveSos on mutate with notes', async () => {
    const mockEvent = { id: 'evt-1' };
    vi.mocked(api.resolveSos).mockResolvedValue(mockEvent as never);

    const { result } = renderHook(() => useResolveSos('child-1'), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync({ eventId: mockEvent.id, notes: 'Resolved successfully' });
    });

    expect(api.resolveSos).toHaveBeenCalledWith('child-1', mockEvent.id, 'Resolved successfully');
  });

  it('calls resolveSos on mutate without notes', async () => {
    const mockEvent = { id: 'evt-1' };
    vi.mocked(api.resolveSos).mockResolvedValue(mockEvent as never);

    const { result } = renderHook(() => useResolveSos('child-1'), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync({ eventId: mockEvent.id });
    });

    expect(api.resolveSos).toHaveBeenCalledWith('child-1', mockEvent.id, undefined);
  });
});
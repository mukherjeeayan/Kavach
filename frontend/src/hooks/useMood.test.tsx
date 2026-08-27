import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useMoodLogs, useMoodSummary } from './useMood';
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

const baseMoodLog = {
  id: 'm1',
  child_id: 'child-1',
  mood_score: 3,
  note: null,
  recorded_at: '2026-08-20T10:00:00Z',
};

describe('useMoodLogs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns initial state', () => {
    const { result } = renderHook(() => useMoodLogs('child-1'), { wrapper: createWrapper() });
    expect(result.current.isPending).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it('fetches mood logs when childId is provided', async () => {
    const mockLogs = [baseMoodLog];
    vi.mocked(api.fetchMoodLogs).mockResolvedValue(mockLogs);

    const { result } = renderHook(() => useMoodLogs('child-1'), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data).toEqual(mockLogs);
    });
  });

  it('does not fetch when childId is null', () => {
    const { result } = renderHook(() => useMoodLogs(null), { wrapper: createWrapper() });
    expect(result.current.isPending).toBe(true);
    expect(api.fetchMoodLogs).not.toHaveBeenCalled();
  });
});

describe('useMoodSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns initial state', () => {
    const { result } = renderHook(() => useMoodSummary('child-1'), { wrapper: createWrapper() });
    expect(result.current.isPending).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it('fetches mood summary when childId is provided', async () => {
    const mockSummary = { average: 3.5, count: 10 };
    vi.mocked(api.fetchMoodSummary).mockResolvedValue(mockSummary);

    const { result } = renderHook(() => useMoodSummary('child-1'), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data).toEqual(mockSummary);
    });
  });

  it('does not fetch when childId is null', () => {
    const { result } = renderHook(() => useMoodSummary(null), { wrapper: createWrapper() });
    expect(result.current.isPending).toBe(true);
    expect(api.fetchMoodSummary).not.toHaveBeenCalled();
  });
});
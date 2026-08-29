import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useKeywords, useCreateKeyword, useDeleteKeyword } from './useKeywords';
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

const mockKeywords = {
  data: [
    {
      id: '1',
      category: 'CUSTOM' as const,
      keyword: 'screen time',
      severity: 'LOW' as const,
      language: 'en',
      is_active: true,
      created_at: '2026-01-01T00:00:00Z',
    },
    {
      id: '2',
      category: 'CUSTOM' as const,
      keyword: 'bedtime',
      severity: 'LOW' as const,
      language: 'en',
      is_active: true,
      created_at: '2026-01-01T00:00:00Z',
    },
  ],
  meta: { page: 1, limit: 50, total: 2, total_pages: 1 },
};

describe('useKeywords', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns initial state', () => {
    const { result } = renderHook(() => useKeywords(), { wrapper: createWrapper() });
    expect(result.current.isPending).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it('fetches keywords successfully', async () => {
    vi.mocked(api.fetchKeywords).mockResolvedValue(mockKeywords);

    const { result } = renderHook(() => useKeywords(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data).toEqual(mockKeywords);
    });
  });

  it('fetches keywords with category filter', async () => {
    vi.mocked(api.fetchKeywords).mockResolvedValue(mockKeywords);

    const { result } = renderHook(() => useKeywords('app_usage'), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
      expect(api.fetchKeywords).toHaveBeenCalledWith('app_usage', 1, 50);
    });
  });

  it('does not fetch when category changes', () => {
    const { result } = renderHook(() => useKeywords('productivity'), { wrapper: createWrapper() });
    expect(result.current.isPending).toBe(true);
  });
});

describe('useCreateKeyword', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates keyword and invalidates queries', async () => {
    const mockKeyword = {
      id: '3',
      category: 'CUSTOM' as const,
      keyword: 'new keyword',
      severity: 'LOW' as const,
      language: 'en',
      is_active: true,
      created_at: '2026-01-01T00:00:00Z',
    };
    vi.mocked(api.createKeyword).mockResolvedValue(mockKeyword);

    const { result } = renderHook(() => useCreateKeyword(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync({ category: 'CUSTOM', keyword: 'new keyword' });
    });

    expect(api.createKeyword).toHaveBeenCalled();
  });

  it('invalidates keywords query on success', async () => {
    vi.mocked(api.createKeyword).mockResolvedValue({
      id: '3',
      category: 'CUSTOM',
      keyword: 'Test',
      severity: 'LOW',
      language: 'en',
      is_active: true,
      created_at: '2026-01-01T00:00:00Z',
    });

    const { result } = renderHook(() => useCreateKeyword(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync({ category: 'CUSTOM', keyword: 'Test' });
    });

    expect(api.createKeyword).toHaveBeenCalled();
  });
});

describe('useDeleteKeyword', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes keyword and invalidates queries', async () => {
    vi.mocked(api.deleteKeyword).mockResolvedValue(undefined);

    const { result } = renderHook(() => useDeleteKeyword(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync('1');
    });

    expect(api.deleteKeyword).toHaveBeenCalled();
  });
});
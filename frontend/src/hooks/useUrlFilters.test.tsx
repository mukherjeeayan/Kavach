import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useUrlFilters, useCreateUrlFilter, useUpdateUrlFilter, useDeleteUrlFilter } from './useUrlFilters';
import * as api from '../services/api';
import type { UrlFilterInput } from '../types/api';
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

const baseUrlFilter = {
  id: 'uf-1',
  child_id: 'child-1',
  url_pattern: '*.facebook.com',
  rule_type: 'BLOCK' as const,
  category: 'social_media',
  is_active: true,
  created_at: '2026-08-20T00:00:00Z',
  updated_at: '2026-08-20T00:00:00Z',
};

describe('useUrlFilters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns initial state', () => {
    const { result } = renderHook(() => useUrlFilters('child-1'), { wrapper: createWrapper() });
    expect(result.current.isPending).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it('fetches URL filters when childId is provided', async () => {
    const mockFilters = [baseUrlFilter];
    vi.mocked(api.fetchUrlFilters).mockResolvedValue(mockFilters);

    const { result } = renderHook(() => useUrlFilters('child-1'), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data).toEqual(mockFilters);
    });
  });

  it('does not fetch when childId is null', () => {
    const { result } = renderHook(() => useUrlFilters(null), { wrapper: createWrapper() });
    expect(result.current.isPending).toBe(true);
    expect(api.fetchUrlFilters).not.toHaveBeenCalled();
  });
});

describe('useCreateUrlFilter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns mutation interface', () => {
    const { result } = renderHook(() => useCreateUrlFilter('child-1'), { wrapper: createWrapper() });
    expect(typeof result.current.mutate).toBe('function');
    expect(result.current.isPending).toBe(false);
  });

  it('calls createUrlFilter on mutate', async () => {
    const input: UrlFilterInput = { url_pattern: '*.ads.com', rule_type: 'BLOCK' };
    vi.mocked(api.createUrlFilter).mockResolvedValue({
      id: 'uf-2',
      child_id: 'child-1',
      url_pattern: '*.ads.com',
      rule_type: 'BLOCK',
      category: null,
      is_active: true,
      created_at: '2026-08-20T00:00:00Z',
      updated_at: '2026-08-20T00:00:00Z',
    });

    const { result } = renderHook(() => useCreateUrlFilter('child-1'), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync(input);
    });

    expect(api.createUrlFilter).toHaveBeenCalledWith('child-1', input);
  });
});

describe('useUpdateUrlFilter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns mutation interface', () => {
    const { result } = renderHook(() => useUpdateUrlFilter('child-1'), { wrapper: createWrapper() });
    expect(typeof result.current.mutate).toBe('function');
    expect(result.current.isPending).toBe(false);
  });

  it('calls updateUrlFilter on mutate', async () => {
    const input: Partial<UrlFilterInput> = { rule_type: 'BLOCK' };
    vi.mocked(api.updateUrlFilter).mockResolvedValue({ ...baseUrlFilter, ...input });

    const { result } = renderHook(() => useUpdateUrlFilter('child-1'), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync({ ruleId: 'uf-1', input });
    });

    expect(api.updateUrlFilter).toHaveBeenCalledWith('child-1', 'uf-1', input as Partial<UrlFilterInput>);
  });
});

describe('useDeleteUrlFilter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns mutation interface', () => {
    const { result } = renderHook(() => useDeleteUrlFilter('child-1'), { wrapper: createWrapper() });
    expect(typeof result.current.mutate).toBe('function');
    expect(result.current.isPending).toBe(false);
  });

  it('calls deleteUrlFilter on mutate', async () => {
    vi.mocked(api.deleteUrlFilter).mockResolvedValue(undefined as never);

    const { result } = renderHook(() => useDeleteUrlFilter('child-1'), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync('uf-1');
    });

    expect(api.deleteUrlFilter).toHaveBeenCalledWith('child-1', 'uf-1');
  });
});
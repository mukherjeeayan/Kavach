import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useIntegrations, useCreateIntegration, useUpdateIntegration, useDeleteIntegration, useSyncIntegration } from './useIntegrations';
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

const mockIntegrations = [
  {
    id: '1',
    name: 'Google Calendar',
    config: {},
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: '2',
    name: 'Spotify',
    config: {},
    is_active: false,
    created_at: '2026-01-01T00:00:00Z',
  },
];

describe('useIntegrations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns initial state', () => {
    const { result } = renderHook(() => useIntegrations(), { wrapper: createWrapper() });
    expect(result.current.isPending).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it('fetches integrations successfully', async () => {
    vi.mocked(api.fetchIntegrations).mockResolvedValue(mockIntegrations);

    const { result } = renderHook(() => useIntegrations(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data).toEqual(mockIntegrations);
    });
  });

  it('does not fetch when no query key', () => {
    const { result } = renderHook(() => useIntegrations(), { wrapper: createWrapper() });
    expect(result.current.isPending).toBe(true);
  });
});

describe('useCreateIntegration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates integration and invalidates queries', async () => {
    const mockIntegration = {
      id: '3',
      name: 'Apple Calendar',
      config: {},
      is_active: true,
      created_at: '2026-01-01T00:00:00Z',
    };
    vi.mocked(api.createIntegration).mockResolvedValue(mockIntegration);

    const { result } = renderHook(() => useCreateIntegration(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync({ name: 'Apple Calendar', config: {}, is_active: true });
    });

    expect(api.createIntegration).toHaveBeenCalled();
  });

  it('invalidates integrations query on success', async () => {
    vi.mocked(api.createIntegration).mockResolvedValue({ id: '3', name: 'Test', config: {}, is_active: true, created_at: '2026-01-01T00:00:00Z' });

    const { result } = renderHook(() => useCreateIntegration(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync({ name: 'Test', config: {}, is_active: true });
    });

    expect(api.createIntegration).toHaveBeenCalled();
  });
});

describe('useUpdateIntegration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates integration and invalidates queries', async () => {
    const mockIntegration = {
      id: '1',
      name: 'Updated Google Calendar',
      config: {},
      is_active: true,
      created_at: '2026-01-01T00:00:00Z',
    };
    vi.mocked(api.updateIntegration).mockResolvedValue(mockIntegration);

    const { result } = renderHook(() => useUpdateIntegration(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync({ id: '1', name: 'Updated Google Calendar' });
    });

    expect(api.updateIntegration).toHaveBeenCalled();
  });
});

describe('useDeleteIntegration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes integration and invalidates queries', async () => {
    vi.mocked(api.deleteIntegration).mockResolvedValue(undefined);

    const { result } = renderHook(() => useDeleteIntegration(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync('1');
    });

    expect(api.deleteIntegration).toHaveBeenCalled();
  });
});

describe('useSyncIntegration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('syncs integration and invalidates queries', async () => {
    vi.mocked(api.syncIntegration).mockResolvedValue(undefined);

    const { result } = renderHook(() => useSyncIntegration(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync('1');
    });

    expect(api.syncIntegration).toHaveBeenCalled();
  });
});
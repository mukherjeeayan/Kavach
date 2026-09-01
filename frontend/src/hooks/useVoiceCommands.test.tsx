import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useVoiceCommands } from './useVoiceCommands';
import * as api from '../services/api';
import type { ReactNode } from 'react';
import type { VoiceCommand } from '../services/api';
import type { PaginatedResponse } from '../types/api';

vi.mock('../services/api');

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

const mockVoiceCommands: PaginatedResponse<VoiceCommand> = {
  data: [
    {
      id: 'vc1',
      child_id: 'child-1',
      device_id: 'device-1',
      command_text: 'call mom',
      intent: 'CALL_CONTACT',
      was_executed: true,
      recorded_at: '2026-01-01T00:00:00Z',
    },
  ],
  meta: { page: 1, limit: 50, total: 1, total_pages: 1 },
};

describe('useVoiceCommands', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not fetch when childId is null', () => {
    const { result } = renderHook(() => useVoiceCommands(null), { wrapper: createWrapper() });
    expect(result.current.isPending).toBe(true);
    expect(api.fetchVoiceCommands).not.toHaveBeenCalled();
  });

  it('fetches voice commands successfully', async () => {
    vi.mocked(api.fetchVoiceCommands).mockResolvedValue(mockVoiceCommands);
    const { result } = renderHook(() => useVoiceCommands('child-1'), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data).toEqual(mockVoiceCommands);
    });
    expect(api.fetchVoiceCommands).toHaveBeenCalledWith('child-1', 1, 50);
  });

  it('passes custom page and limit parameters', async () => {
    vi.mocked(api.fetchVoiceCommands).mockResolvedValue(mockVoiceCommands);
    const { result } = renderHook(() => useVoiceCommands('child-1', 2, 25), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(api.fetchVoiceCommands).toHaveBeenCalledWith('child-1', 2, 25);
  });

  it('returns empty data when no voice commands', async () => {
    const emptyResult: PaginatedResponse<VoiceCommand> = {
      data: [],
      meta: { page: 1, limit: 50, total: 0, total_pages: 0 },
    };
    vi.mocked(api.fetchVoiceCommands).mockResolvedValue(emptyResult);
    const { result } = renderHook(() => useVoiceCommands('child-1'), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data).toEqual(emptyResult);
    });
  });

  it('includes correct query key components', async () => {
    vi.mocked(api.fetchVoiceCommands).mockResolvedValue(mockVoiceCommands);
    const { result } = renderHook(() => useVoiceCommands('child-1', 1, 50), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(api.fetchVoiceCommands).toHaveBeenCalledWith('child-1', 1, 50);
  });
});

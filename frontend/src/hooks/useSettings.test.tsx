import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSettings, useUpdateSettings } from './useSettings';
import * as api from '../services/api';
import type { ReactNode } from 'react';
import type { UserSettings, UserSettingsInput } from '../types/api';

vi.mock('../services/api');

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

const mockSettings: UserSettings = {
  id: 's1',
  user_id: 'u1',
  notifications_enabled: true,
  email_digest_enabled: true,
  digest_frequency: 'DAILY',
  screen_time_alerts: true,
  location_alerts: true,
  communication_alerts: true,
  sos_alerts: true,
  self_harm_alerts: true,
  dnd_enabled: false,
  dnd_start_time: '22:00',
  dnd_end_time: '07:00',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

describe('useSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches settings successfully', async () => {
    vi.mocked(api.fetchSettings).mockResolvedValue(mockSettings);
    const { result } = renderHook(() => useSettings(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data).toEqual(mockSettings);
    });
    expect(api.fetchSettings).toHaveBeenCalled();
  });

  it('returns initial state while loading', () => {
    vi.mocked(api.fetchSettings).mockResolvedValue(mockSettings);
    const { result } = renderHook(() => useSettings(), { wrapper: createWrapper() });
    expect(result.current.isPending).toBe(true);
    expect(result.current.data).toBeUndefined();
  });
});

describe('useUpdateSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns mutation helpers', () => {
    const { result } = renderHook(() => useUpdateSettings(), { wrapper: createWrapper() });
    expect(typeof result.current.mutate).toBe('function');
    expect(result.current.isIdle).toBe(true);
  });

  it('calls updateSettings API on mutate', async () => {
    vi.mocked(api.updateSettings).mockResolvedValue(mockSettings);
    const { result } = renderHook(() => useUpdateSettings(), { wrapper: createWrapper() });

    const input: UserSettingsInput = { notifications_enabled: false };
    result.current.mutate(input);

    await waitFor(() => {
      expect(api.updateSettings).toHaveBeenCalledWith(input);
    });
  });

  it('returns updated settings on success', async () => {
    const updatedSettings = { ...mockSettings, notifications_enabled: false };
    vi.mocked(api.updateSettings).mockResolvedValue(updatedSettings);
    const { result } = renderHook(() => useUpdateSettings(), { wrapper: createWrapper() });

    result.current.mutate({ notifications_enabled: false });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data).toEqual(updatedSettings);
    });
  });
});

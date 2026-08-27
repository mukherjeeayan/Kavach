import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useGeofences, useCreateGeofence, useUpdateGeofence, useDeleteGeofence } from './useGeofencing';
import * as api from '../services/api';
import type { GeofenceInput } from '../types/api';
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

const baseGeofence = {
  id: 'gf-1',
  name: 'Home Zone',
  latitude: 13.0827,
  longitude: 80.2707,
  radius_meters: 500,
  zone_type: 'HOME',
  alert_on_entry: true,
  alert_on_exit: true,
  is_active: true,
  created_at: '2026-08-20T00:00:00Z',
  updated_at: '2026-08-20T00:00:00Z',
};

describe('useGeofences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns initial state', () => {
    const { result } = renderHook(() => useGeofences('child-1'), { wrapper: createWrapper() });
    expect(result.current.isPending).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it('fetches geofences when childId is provided', async () => {
    const mockGeofences = [baseGeofence];
    vi.mocked(api.fetchGeofences).mockResolvedValue(mockGeofences);

    const { result } = renderHook(() => useGeofences('child-1'), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data).toEqual(mockGeofences);
    });
  });

  it('does not fetch when childId is null', () => {
    const { result } = renderHook(() => useGeofences(null), { wrapper: createWrapper() });
    expect(result.current.isPending).toBe(true);
    expect(api.fetchGeofences).not.toHaveBeenCalled();
  });
});

describe('useCreateGeofence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns mutation interface', () => {
    const { result } = renderHook(() => useCreateGeofence('child-1'), { wrapper: createWrapper() });
    expect(typeof result.current.mutate).toBe('function');
    expect(result.current.isPending).toBe(false);
  });

  it('calls createGeofence on mutate', async () => {
    const input: GeofenceInput = {
      name: 'School Zone',
      latitude: 13.0827,
      longitude: 80.2707,
      radius_meters: 100,
      zone_type: 'SCHOOL',
      alert_on_entry: true,
      alert_on_exit: true,
    };
    vi.mocked(api.createGeofence).mockResolvedValue({ id: 'gf-2', ...input } as never);

    const { result } = renderHook(() => useCreateGeofence('child-1'), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync(input);
    });

    expect(api.createGeofence).toHaveBeenCalledWith('child-1', input);
  });
});

describe('useUpdateGeofence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns mutation interface', () => {
    const { result } = renderHook(() => useUpdateGeofence('child-1'), { wrapper: createWrapper() });
    expect(typeof result.current.mutate).toBe('function');
    expect(result.current.isPending).toBe(false);
  });

  it('calls updateGeofence on mutate', async () => {
    const input: Partial<GeofenceInput> = { is_active: false };
    vi.mocked(api.updateGeofence).mockResolvedValue({ id: 'gf-1', ...input } as never);

    const { result } = renderHook(() => useUpdateGeofence('child-1'), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync({ geofenceId: 'gf-1', input });
    });

    expect(api.updateGeofence).toHaveBeenCalledWith('child-1', 'gf-1', input);
  });
});

describe('useDeleteGeofence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns mutation interface', () => {
    const { result } = renderHook(() => useDeleteGeofence('child-1'), { wrapper: createWrapper() });
    expect(typeof result.current.mutate).toBe('function');
    expect(result.current.isPending).toBe(false);
  });

  it('calls deleteGeofence on mutate', async () => {
    vi.mocked(api.deleteGeofence).mockResolvedValue(undefined as never);

    const { result } = renderHook(() => useDeleteGeofence('child-1'), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync('gf-1');
    });

    expect(api.deleteGeofence).toHaveBeenCalledWith('child-1', 'gf-1');
  });
});
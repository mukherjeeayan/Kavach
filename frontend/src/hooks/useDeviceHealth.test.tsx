import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useDeviceHealth, useDeviceHealthHistory } from './useDeviceHealth';
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

const mockDeviceHealth = {
  id: '1',
  device_id: 'device-1',
  battery_level: 85,
  is_charging: false,
  storage_total_mb: 64000,
  storage_free_mb: 32000,
  is_rooted: false,
  is_developer_options: false,
  is_usb_debugging: false,
  os_version: '14',
  app_version: '1.0.0',
  recorded_at: '2026-08-20T10:00:00Z',
  created_at: '2026-08-20T10:00:00Z',
};

const mockHistory = [
  {
    id: '1',
    device_id: 'device-1',
    battery_level: 85,
    is_charging: false,
    storage_total_mb: 64000,
    storage_free_mb: 32000,
    is_rooted: false,
    is_developer_options: false,
    is_usb_debugging: false,
    os_version: '14',
    app_version: '1.0.0',
    recorded_at: '2026-08-20T08:00:00Z',
    created_at: '2026-08-20T08:00:00Z',
  },
  {
    id: '2',
    device_id: 'device-1',
    battery_level: 70,
    is_charging: true,
    storage_total_mb: 64000,
    storage_free_mb: 30000,
    is_rooted: false,
    is_developer_options: false,
    is_usb_debugging: false,
    os_version: '14',
    app_version: '1.0.0',
    recorded_at: '2026-08-20T17:00:00Z',
    created_at: '2026-08-20T17:00:00Z',
  },
];

describe('useDeviceHealth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns initial state when childId or deviceId is null', () => {
    const { result } = renderHook(() => useDeviceHealth(null, 'device-1'), { wrapper: createWrapper() });
    expect(result.current.isPending).toBe(true);
    expect(result.current.data).toBeUndefined();

    const { result: result2 } = renderHook(() => useDeviceHealth('child-1', null), { wrapper: createWrapper() });
    expect(result2.current.isPending).toBe(true);
    expect(result2.current.data).toBeUndefined();
  });

  it('fetches device health successfully', async () => {
    vi.mocked(api.fetchDeviceHealth).mockResolvedValue(mockDeviceHealth);

    const { result } = renderHook(() => useDeviceHealth('child-1', 'device-1'), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data).toEqual(mockDeviceHealth);
    });
  });

  it('does not fetch when childId is null', () => {
    const { result } = renderHook(() => useDeviceHealth(null, 'device-1'), { wrapper: createWrapper() });
    expect(result.current.isPending).toBe(true);
    expect(api.fetchDeviceHealth).not.toHaveBeenCalled();
  });

  it('does not fetch when deviceId is null', () => {
    const { result } = renderHook(() => useDeviceHealth('child-1', null), { wrapper: createWrapper() });
    expect(result.current.isPending).toBe(true);
    expect(api.fetchDeviceHealth).not.toHaveBeenCalled();
  });
});

describe('useDeviceHealthHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns initial state when childId or deviceId is null', () => {
    const { result } = renderHook(() => useDeviceHealthHistory(null, 'device-1'), { wrapper: createWrapper() });
    expect(result.current.isPending).toBe(true);
    expect(result.current.data).toBeUndefined();

    const { result: result2 } = renderHook(() => useDeviceHealthHistory('child-1', null), { wrapper: createWrapper() });
    expect(result2.current.isPending).toBe(true);
    expect(result2.current.data).toBeUndefined();
  });

  it('fetches device health history successfully', async () => {
    vi.mocked(api.fetchDeviceHealthHistory).mockResolvedValue(mockHistory);

    const { result } = renderHook(() => useDeviceHealthHistory('child-1', 'device-1'), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data).toEqual(mockHistory);
    });
  });

  it('does not fetch when childId is null', () => {
    const { result } = renderHook(() => useDeviceHealthHistory(null, 'device-1'), { wrapper: createWrapper() });
    expect(result.current.isPending).toBe(true);
    expect(api.fetchDeviceHealthHistory).not.toHaveBeenCalled();
  });
});
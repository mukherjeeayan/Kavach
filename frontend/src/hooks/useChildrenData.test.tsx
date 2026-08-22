import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useChildren, useCreateChild, useDevices, useBlockedApps, useUnblockRequests } from './useChildrenData';
import * as api from '../services/api';
import type { ChildProfile, DeviceProfile, AppBlockRule } from '../types/api';

vi.mock('../services/api');

const baseChild = {
  parent_id: 'parent-1',
  created_at: '2026-08-21T00:00:00Z',
  updated_at: '2026-08-21T00:00:00Z',
};

const baseDevice = {
  child_id: 'child-1',
  os_version: null,
  fcm_token: null,
};

const baseRule = {
  device_id: 'device-1',
  app_name: null,
  is_blocked: true,
  unblock_requested: false,
  unblock_reason: null,
  created_at: '2026-08-21T00:00:00Z',
  updated_at: '2026-08-21T00:00:00Z',
};

function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
}

function createWrapper(queryClient = createQueryClient()) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('useChildren', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches children list', async () => {
    const mockData: ChildProfile[] = [
      { ...baseChild, id: 'c1', name: 'Aarav', birth_date: '2015-06-01', daily_screen_time_limit_minutes: null },
    ];
    vi.mocked(api.fetchChildren).mockResolvedValue(mockData);

    const { result } = renderHook(() => useChildren(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockData);
  });

  it('handles error', async () => {
    vi.mocked(api.fetchChildren).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useChildren(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeDefined();
  });
});

describe('useCreateChild', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns mutation interface', () => {
    const { result } = renderHook(() => useCreateChild(), { wrapper: createWrapper() });
    expect(typeof result.current.mutate).toBe('function');
    expect(result.current.isPending).toBe(false);
  });
});

describe('useDevices', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not fetch when childId is null', () => {
    const { result } = renderHook(() => useDevices(null), { wrapper: createWrapper() });
    expect(result.current.isPending).toBe(true);
    expect(api.fetchChildDevices).not.toHaveBeenCalled();
  });

  it('fetches devices when childId is provided', async () => {
    const mockDevices: DeviceProfile[] = [{ ...baseDevice, device_id: 'd1', device_name: 'Pixel 7', device_type: 'android', admin_active: true, last_active: null }];
    vi.mocked(api.fetchChildDevices).mockResolvedValue(mockDevices);

    const { result } = renderHook(() => useDevices('child-1'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockDevices);
  });
});

describe('useBlockedApps', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not fetch when childId is null', () => {
    const { result } = renderHook(() => useBlockedApps(null), { wrapper: createWrapper() });
    expect(result.current.isPending).toBe(true);
  });

  it('fetches blocked apps when childId provided', async () => {
    const mockApps: AppBlockRule[] = [
      { ...baseRule, id: 'r1', package_name: 'com.game', block_reason: 'distraction', daily_limit_minutes: 30 },
    ];
    vi.mocked(api.fetchBlockedApps).mockResolvedValue(mockApps);

    const { result } = renderHook(() => useBlockedApps('child-1'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockApps);
  });
});

describe('useUnblockRequests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not fetch when childId is null', () => {
    const { result } = renderHook(() => useUnblockRequests(null), { wrapper: createWrapper() });
    expect(result.current.isPending).toBe(true);
  });

  it('fetches unblock requests', async () => {
    const mockRequests: AppBlockRule[] = [
      { ...baseRule, id: 'u1', package_name: 'com.game', unblock_requested: true, unblock_reason: 'pending', block_reason: null, daily_limit_minutes: null },
    ];
    vi.mocked(api.fetchUnblockRequests).mockResolvedValue(mockRequests);

    const { result } = renderHook(() => useUnblockRequests('child-1'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockRequests);
  });
});

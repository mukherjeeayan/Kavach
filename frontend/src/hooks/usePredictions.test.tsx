import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useBehaviorPredictions, useSecurityScans, useWifiLogs } from './usePredictions';
import * as api from '../services/api';
import type { ReactNode } from 'react';
import type { BehaviorPrediction, SecurityScan, WifiLog } from '../types/api';

vi.mock('../services/api');

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

const mockPredictions: BehaviorPrediction[] = [
  {
    id: 'p1',
    child_id: 'child-1',
    prediction_type: 'SOCIAL_RISK',
    confidence: 0.75,
    risk_score: 0.75,
    prediction_data: {},
    valid_from: '2026-01-01T00:00:00Z',
    valid_until: '2026-01-31T23:59:59Z',
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
  },
];

const mockScans: SecurityScan[] = [
  {
    id: 's1',
    device_id: 'device-1',
    scan_type: 'FULL',
    result: {},
    threats_found: 0,
    scanned_at: '2026-01-01T00:00:00Z',
  },
];

const mockWifiLogs: WifiLog[] = [
  {
    id: 'w1',
    device_id: 'device-1',
    ssid: 'HomeWifi',
    bssid: 'AA:BB:CC:DD:EE:FF',
    security_type: 'WPA2',
    is_open: false,
    is_known: true,
    ip_address: '192.168.1.100',
    recorded_at: '2026-01-01T00:00:00Z',
  },
];

describe('useBehaviorPredictions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not fetch when childId is null', () => {
    const { result } = renderHook(() => useBehaviorPredictions(null), { wrapper: createWrapper() });
    expect(result.current.isPending).toBe(true);
    expect(api.fetchBehaviorPredictions).not.toHaveBeenCalled();
  });

  it('fetches predictions successfully', async () => {
    vi.mocked(api.fetchBehaviorPredictions).mockResolvedValue(mockPredictions);
    const { result } = renderHook(() => useBehaviorPredictions('child-1'), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data).toEqual(mockPredictions);
    });
    expect(api.fetchBehaviorPredictions).toHaveBeenCalledWith('child-1');
  });

  it('returns empty array when no predictions', async () => {
    vi.mocked(api.fetchBehaviorPredictions).mockResolvedValue([]);
    const { result } = renderHook(() => useBehaviorPredictions('child-1'), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data).toEqual([]);
    });
  });
});

describe('useSecurityScans', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not fetch when childId is null', () => {
    const { result } = renderHook(() => useSecurityScans(null, 'device-1'), { wrapper: createWrapper() });
    expect(result.current.isPending).toBe(true);
    expect(api.fetchSecurityScans).not.toHaveBeenCalled();
  });

  it('does not fetch when deviceId is null', () => {
    const { result } = renderHook(() => useSecurityScans('child-1', null), { wrapper: createWrapper() });
    expect(result.current.isPending).toBe(true);
    expect(api.fetchSecurityScans).not.toHaveBeenCalled();
  });

  it('fetches security scans successfully', async () => {
    vi.mocked(api.fetchSecurityScans).mockResolvedValue(mockScans);
    const { result } = renderHook(() => useSecurityScans('child-1', 'device-1'), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data).toEqual(mockScans);
    });
    expect(api.fetchSecurityScans).toHaveBeenCalledWith('child-1', 'device-1');
  });
});

describe('useWifiLogs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not fetch when childId is null', () => {
    const { result } = renderHook(() => useWifiLogs(null, 'device-1'), { wrapper: createWrapper() });
    expect(result.current.isPending).toBe(true);
    expect(api.fetchWifiLogs).not.toHaveBeenCalled();
  });

  it('does not fetch when deviceId is null', () => {
    const { result } = renderHook(() => useWifiLogs('child-1', null), { wrapper: createWrapper() });
    expect(result.current.isPending).toBe(true);
    expect(api.fetchWifiLogs).not.toHaveBeenCalled();
  });

  it('fetches wifi logs successfully', async () => {
    vi.mocked(api.fetchWifiLogs).mockResolvedValue(mockWifiLogs);
    const { result } = renderHook(() => useWifiLogs('child-1', 'device-1'), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data).toEqual(mockWifiLogs);
    });
    expect(api.fetchWifiLogs).toHaveBeenCalledWith('child-1', 'device-1');
  });
});

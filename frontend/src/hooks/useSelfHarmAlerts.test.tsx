import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useSelfHarmAlerts,
  useSelfHarmAlertCount,
  useAcknowledgeSelfHarmAlert,
} from './useSelfHarmAlerts';
import * as api from '../services/api';
import type { ReactNode } from 'react';
import type { SelfHarmAlert } from '../types/api';

vi.mock('../services/api');

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

const mockAlerts: SelfHarmAlert[] = [
  {
    id: 'a1',
    child_id: 'child-1',
    device_id: 'device-1',
    source_type: 'APP_TEXT',
    detected_keywords: ['harm'],
    content_snippet: 'some text',
    risk_level: 'HIGH',
    is_acknowledged: false,
    acknowledged_at: null,
    created_at: '2026-01-01T00:00:00Z',
  },
];

describe('useSelfHarmAlerts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not fetch when childId is null', () => {
    const { result } = renderHook(() => useSelfHarmAlerts(null), { wrapper: createWrapper() });
    expect(result.current.isPending).toBe(true);
    expect(api.fetchSelfHarmAlerts).not.toHaveBeenCalled();
  });

  it('fetches alerts successfully', async () => {
    vi.mocked(api.fetchSelfHarmAlerts).mockResolvedValue(mockAlerts);
    const { result } = renderHook(() => useSelfHarmAlerts('child-1'), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data).toEqual(mockAlerts);
    });
    expect(api.fetchSelfHarmAlerts).toHaveBeenCalledWith('child-1', false);
  });

  it('fetches unacknowledged alerts only', async () => {
    vi.mocked(api.fetchSelfHarmAlerts).mockResolvedValue(mockAlerts);
    const { result } = renderHook(() => useSelfHarmAlerts('child-1', true), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(api.fetchSelfHarmAlerts).toHaveBeenCalledWith('child-1', true);
  });

  it('returns empty array when no alerts', async () => {
    vi.mocked(api.fetchSelfHarmAlerts).mockResolvedValue([]);
    const { result } = renderHook(() => useSelfHarmAlerts('child-1'), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data).toEqual([]);
    });
  });
});

describe('useSelfHarmAlertCount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not fetch when childId is null', () => {
    const { result } = renderHook(() => useSelfHarmAlertCount(null), { wrapper: createWrapper() });
    expect(result.current.isPending).toBe(true);
    expect(api.fetchSelfHarmAlertCount).not.toHaveBeenCalled();
  });

  it('fetches alert count successfully', async () => {
    vi.mocked(api.fetchSelfHarmAlertCount).mockResolvedValue(5);
    const { result } = renderHook(() => useSelfHarmAlertCount('child-1'), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data).toBe(5);
    });
    expect(api.fetchSelfHarmAlertCount).toHaveBeenCalledWith('child-1');
  });
});

describe('useAcknowledgeSelfHarmAlert', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns mutation helpers', () => {
    const { result } = renderHook(() => useAcknowledgeSelfHarmAlert('child-1'), {
      wrapper: createWrapper(),
    });
    expect(typeof result.current.mutate).toBe('function');
    expect(result.current.isIdle).toBe(true);
  });

  it('calls acknowledgeSelfHarmAlert API', async () => {
    vi.mocked(api.acknowledgeSelfHarmAlert).mockResolvedValue(mockAlerts[0]);
    const { result } = renderHook(() => useAcknowledgeSelfHarmAlert('child-1'), {
      wrapper: createWrapper(),
    });

    result.current.mutate('a1');

    await waitFor(() => {
      expect(api.acknowledgeSelfHarmAlert).toHaveBeenCalledWith('child-1', 'a1');
    });
  });
});

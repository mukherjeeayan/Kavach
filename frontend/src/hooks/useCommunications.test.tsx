import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCommunicationLogs, useKeywordAlerts, useReviewKeywordAlert } from './useCommunications';
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

const mockCommunicationLogs = [
  {
    id: '1',
    child_id: 'child-1',
    message_type: 'sms',
    content: 'Test message',
    direction: 'incoming',
    created_at: '2026-08-20T10:00:00Z',
  },
];

const mockKeywordAlerts = [
  {
    id: '1',
    child_id: 'child-1',
    keyword: 'stress',
    alert_level: 'MEDIUM',
    is_acknowledged: false,
    created_at: '2026-08-20T10:00:00Z',
  },
];

describe('useCommunicationLogs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns initial state when childId is null', () => {
    const { result } = renderHook(() => useCommunicationLogs(null), { wrapper: createWrapper() });
    expect(result.current.isPending).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it('fetches communication logs successfully', async () => {
    vi.mocked(api.fetchCommunicationLogs).mockResolvedValue(mockCommunicationLogs);

    const { result } = renderHook(() => useCommunicationLogs('child-1'), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data).toEqual(mockCommunicationLogs);
    });
  });

  it('does not fetch when childId is null', () => {
    const { result } = renderHook(() => useCommunicationLogs(null), { wrapper: createWrapper() });
    expect(result.current.isPending).toBe(true);
    expect(api.fetchCommunicationLogs).not.toHaveBeenCalled();
  });
});

describe('useKeywordAlerts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns initial state when childId is null', () => {
    const { result } = renderHook(() => useKeywordAlerts(null), { wrapper: createWrapper() });
    expect(result.current.isPending).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it('fetches keyword alerts successfully', async () => {
    vi.mocked(api.fetchKeywordAlerts).mockResolvedValue(mockKeywordAlerts);

    const { result } = renderHook(() => useKeywordAlerts('child-1'), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data).toEqual(mockKeywordAlerts);
    });
  });

  it('does not fetch when childId is null', () => {
    const { result } = renderHook(() => useKeywordAlerts(null), { wrapper: createWrapper() });
    expect(result.current.isPending).toBe(true);
    expect(api.fetchKeywordAlerts).not.toHaveBeenCalled();
  });
});

describe('useReviewKeywordAlert', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reviews keyword alert and invalidates queries', async () => {
    vi.mocked(api.reviewKeywordAlert).mockResolvedValue(undefined);

    const { result } = renderHook(() => useReviewKeywordAlert('child-1'), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync('alert-1');
    });

    expect(api.reviewKeywordAlert).toHaveBeenCalledWith('child-1', 'alert-1');
    expect(api.reviewKeywordAlert).toHaveBeenCalledTimes(1);
  });
});
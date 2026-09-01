import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from './useNotifications';
import * as api from '../services/api';
import type { ReactNode } from 'react';
import type { Notification } from '../types/api';

vi.mock('../services/api');

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

const mockNotifications: Notification[] = [
  {
    id: 'n1',
    user_id: 'u1',
    title: 'Alert',
    body: 'Test body',
    notification_type: 'ALERT',
    reference_id: null,
    is_read: false,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'n2',
    user_id: 'u1',
    title: 'Info',
    body: 'Another body',
    notification_type: 'INFO',
    reference_id: 'ref-1',
    is_read: true,
    created_at: '2026-01-02T00:00:00Z',
  },
];

describe('useNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches notifications successfully', async () => {
    vi.mocked(api.fetchNotifications).mockResolvedValue(mockNotifications);
    const { result } = renderHook(() => useNotifications(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data).toEqual(mockNotifications);
    });
    expect(api.fetchNotifications).toHaveBeenCalled();
  });

  it('returns empty array when no notifications', async () => {
    vi.mocked(api.fetchNotifications).mockResolvedValue([]);
    const { result } = renderHook(() => useNotifications(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data).toEqual([]);
    });
  });

  it('returns initial state while loading', () => {
    vi.mocked(api.fetchNotifications).mockResolvedValue([]);
    const { result } = renderHook(() => useNotifications(), { wrapper: createWrapper() });
    expect(result.current.isPending).toBe(true);
    expect(result.current.data).toBeUndefined();
  });
});

describe('useMarkNotificationRead', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns mutation helpers', () => {
    const { result } = renderHook(() => useMarkNotificationRead(), { wrapper: createWrapper() });
    expect(typeof result.current.mutate).toBe('function');
    expect(result.current.isIdle).toBe(true);
  });

  it('calls markNotificationAsRead API', async () => {
    vi.mocked(api.markNotificationAsRead).mockResolvedValue(mockNotifications[0]);
    const { result } = renderHook(() => useMarkNotificationRead(), { wrapper: createWrapper() });

    result.current.mutate('n1');

    await waitFor(() => {
      expect(api.markNotificationAsRead).toHaveBeenCalledWith('n1');
    });
  });
});

describe('useMarkAllNotificationsRead', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns mutation helpers', () => {
    const { result } = renderHook(() => useMarkAllNotificationsRead(), { wrapper: createWrapper() });
    expect(typeof result.current.mutate).toBe('function');
    expect(result.current.isIdle).toBe(true);
  });

  it('calls markAllNotificationsAsRead API', async () => {
    vi.mocked(api.markAllNotificationsAsRead).mockResolvedValue(undefined as never);
    const { result } = renderHook(() => useMarkAllNotificationsRead(), { wrapper: createWrapper() });

    result.current.mutate();

    await waitFor(() => {
      expect(api.markAllNotificationsAsRead).toHaveBeenCalled();
    });
  });
});

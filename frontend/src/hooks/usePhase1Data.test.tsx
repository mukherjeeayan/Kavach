import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import {
  useLocks,
  useContacts,
  useLockActions,
  useContactActions,
  useScreenTimeSummary,
  useChildAlerts,
  useCurrentLocations,
  useLocationHistory,
  useActionsError,
  useVerifyParentPin,
  useSetParentPin,
} from './usePhase1Data';
import * as api from '../services/api';
import type {
  ScheduledLock,
  ContactRule,
  LocationPoint,
  ChildAlert,
} from '../types/api';

vi.mock('../services/api');

const baseLock = {
  child_id: 'child-1',
  device_id: null,
  created_at: '2026-08-21T00:00:00Z',
  updated_at: '2026-08-21T00:00:00Z',
};

const baseContact = {
  child_id: 'child-1',
  device_id: null,
  is_active: true,
  created_at: '2026-08-21T00:00:00Z',
  updated_at: '2026-08-21T00:00:00Z',
};

const baseLocation = {
  child_id: 'child-1',
  device_id: 'device-1',
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

describe('useLocks', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('does not fetch when childId is null', () => {
    const { result } = renderHook(() => useLocks(null), { wrapper: createWrapper() });
    expect(result.current.isPending).toBe(true);
  });

  it('fetches locks for a child', async () => {
    const mockLocks: ScheduledLock[] = [
      { ...baseLock, id: 'l1', day_of_week: 1, start_time: '21:00', end_time: '06:00', is_active: true },
    ];
    vi.mocked(api.fetchLocks).mockResolvedValue(mockLocks);

    const { result } = renderHook(() => useLocks('child-1'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockLocks);
  });
});

describe('useContacts', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('does not fetch when childId is null', () => {
    const { result } = renderHook(() => useContacts(null), { wrapper: createWrapper() });
    expect(result.current.isPending).toBe(true);
  });

  it('fetches contacts for a child', async () => {
    const mockContacts: ContactRule[] = [
      { ...baseContact, id: 'c1', contact_name: 'Grandma', phone_number: '+91 98765 43210', rule_type: 'ALLOW' },
    ];
    vi.mocked(api.fetchContacts).mockResolvedValue(mockContacts);

    const { result } = renderHook(() => useContacts('child-1'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockContacts);
  });
});

describe('useLockActions', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns create, update, remove mutations', () => {
    const { result } = renderHook(() => useLockActions('child-1'), { wrapper: createWrapper() });
    expect(typeof result.current.create.mutate).toBe('function');
    expect(typeof result.current.update.mutate).toBe('function');
    expect(typeof result.current.remove.mutate).toBe('function');
  });

  it('calls createLock on create mutation', async () => {
    vi.mocked(api.createLock).mockResolvedValue({ ...baseLock, id: 'l1', day_of_week: null, start_time: '21:00', end_time: '06:00', is_active: true });

    const { result } = renderHook(() => useLockActions('child-1'), { wrapper: createWrapper() });

    act(() => {
      result.current.create.mutate({ day_of_week: null, start_time: '21:00', end_time: '06:00' });
    });

    await waitFor(() => expect(result.current.create.isSuccess).toBe(true));
    expect(api.createLock).toHaveBeenCalledWith('child-1', { day_of_week: null, start_time: '21:00', end_time: '06:00' });
  });
});

describe('useContactActions', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns create, update, remove mutations', () => {
    const { result } = renderHook(() => useContactActions('child-1'), { wrapper: createWrapper() });
    expect(typeof result.current.create.mutate).toBe('function');
    expect(typeof result.current.update.mutate).toBe('function');
    expect(typeof result.current.remove.mutate).toBe('function');
  });
});

describe('useScreenTimeSummary', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('fetches screen time summary', async () => {
    const mockSummary = {
      range: 'week' as const,
      total_seconds: 7200,
      daily: [],
      by_app: [],
    };
    vi.mocked(api.fetchScreenTimeSummary).mockResolvedValue(mockSummary);

    const { result } = renderHook(() => useScreenTimeSummary('child-1', 'week'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockSummary);
  });
});

describe('useChildAlerts', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('fetches alerts for a child', async () => {
    const mockAlerts: ChildAlert[] = [
      {
        id: 'a1',
        action: 'TAMPER_ALERT',
        resource_type: 'devices',
        details: { message: 'Unknown caller' },
        created_at: '2026-08-21T10:00:00Z',
        acknowledged_at: null,
      },
    ];
    vi.mocked(api.fetchChildAlerts).mockResolvedValue(mockAlerts);

    const { result } = renderHook(() => useChildAlerts('child-1'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockAlerts);
  });
});

describe('useCurrentLocations', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('fetches current locations', async () => {
    const mockLocations: LocationPoint[] = [
      { ...baseLocation, id: 'p1', latitude: 28.6139, longitude: 77.2090, accuracy_m: 10, speed_kmh: null, recorded_at: '2026-08-21T10:00:00Z' },
    ];
    vi.mocked(api.fetchCurrentLocations).mockResolvedValue(mockLocations);

    const { result } = renderHook(() => useCurrentLocations('child-1'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockLocations);
  });
});

describe('useLocationHistory', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('fetches location history', async () => {
    const mockHistory: LocationPoint[] = [
      { ...baseLocation, id: 'p1', latitude: 28.6139, longitude: 77.2090, accuracy_m: 10, speed_kmh: null, recorded_at: '2026-08-21T10:00:00Z' },
    ];
    vi.mocked(api.fetchLocationHistory).mockResolvedValue(mockHistory);

    const { result } = renderHook(() => useLocationHistory('child-1'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockHistory);
  });
});

describe('useActionsError', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('calls onError with error message when a mutation has error', () => {
    const onError = vi.fn();
    const mutations = [
      { isError: true, error: new Error('Something failed') },
      { isError: false, error: null },
    ];

    renderHook(() => useActionsError(mutations, onError));
    expect(onError).toHaveBeenCalledWith('Something failed');
  });

  it('calls onError(null) when no mutations have errors', () => {
    const onError = vi.fn();
    const mutations = [
      { isError: false, error: null },
      { isError: false, error: null },
    ];

    renderHook(() => useActionsError(mutations, onError));
    expect(onError).toHaveBeenCalledWith(null);
  });
});

describe('useVerifyParentPin', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns mutation interface', () => {
    const { result } = renderHook(() => useVerifyParentPin(), { wrapper: createWrapper() });
    expect(typeof result.current.mutate).toBe('function');
  });
});

describe('useSetParentPin', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns mutation interface', () => {
    const { result } = renderHook(() => useSetParentPin(), { wrapper: createWrapper() });
    expect(typeof result.current.mutate).toBe('function');
  });
});

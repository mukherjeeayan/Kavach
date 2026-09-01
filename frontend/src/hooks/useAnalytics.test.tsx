import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useGenerateReport, useLatestReport, useReports } from './useAnalytics';
import * as api from '../services/api';
import type { ReactNode } from 'react';
import type { AnalyticsReport } from '../types/api';

vi.mock('../services/api');

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

const mockReport: AnalyticsReport = {
  id: 'r1',
  child_id: 'child-1',
  report_type: 'WEEKLY',
  period_start: '2026-01-01T00:00:00Z',
  period_end: '2026-01-07T23:59:59Z',
  data: {},
  generated_at: '2026-01-08T00:00:00Z',
};
const mockReports: AnalyticsReport[] = [mockReport];

describe('useGenerateReport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns mutation helpers', () => {
    const { result } = renderHook(() => useGenerateReport('child-1'), { wrapper: createWrapper() });
    expect(typeof result.current.mutate).toBe('function');
    expect(typeof result.current.mutateAsync).toBe('function');
    expect(result.current.isIdle).toBe(true);
  });

  it('calls generateReport API on mutate', async () => {
    vi.mocked(api.generateReport).mockResolvedValue({ success: true });
    const { result } = renderHook(() => useGenerateReport('child-1'), { wrapper: createWrapper() });

    result.current.mutate('WEEKLY');

    await waitFor(() => {
      expect(api.generateReport).toHaveBeenCalledWith('child-1', 'WEEKLY');
    });
  });

  it('calls generateReport with MONTHLY type', async () => {
    vi.mocked(api.generateReport).mockResolvedValue({ success: true });
    const { result } = renderHook(() => useGenerateReport('child-1'), { wrapper: createWrapper() });

    result.current.mutate('MONTHLY');

    await waitFor(() => {
      expect(api.generateReport).toHaveBeenCalledWith('child-1', 'MONTHLY');
    });
  });
});

describe('useLatestReport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not fetch when childId is null', () => {
    const { result } = renderHook(() => useLatestReport(null, 'WEEKLY'), { wrapper: createWrapper() });
    expect(result.current.isPending).toBe(true);
    expect(api.fetchLatestReport).not.toHaveBeenCalled();
  });

  it('fetches latest report successfully', async () => {
    vi.mocked(api.fetchLatestReport).mockResolvedValue(mockReport);
    const { result } = renderHook(() => useLatestReport('child-1', 'WEEKLY'), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data).toEqual(mockReport);
    });
    expect(api.fetchLatestReport).toHaveBeenCalledWith('child-1', 'WEEKLY');
  });
});

describe('useReports', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not fetch when childId is null', () => {
    const { result } = renderHook(() => useReports(null), { wrapper: createWrapper() });
    expect(result.current.isPending).toBe(true);
    expect(api.fetchReports).not.toHaveBeenCalled();
  });

  it('fetches reports successfully', async () => {
    vi.mocked(api.fetchReports).mockResolvedValue(mockReports);
    const { result } = renderHook(() => useReports('child-1'), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data).toEqual(mockReports);
    });
    expect(api.fetchReports).toHaveBeenCalledWith('child-1');
  });

  it('returns empty array by default', async () => {
    vi.mocked(api.fetchReports).mockResolvedValue([]);
    const { result } = renderHook(() => useReports('child-1'), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data).toEqual([]);
    });
  });
});

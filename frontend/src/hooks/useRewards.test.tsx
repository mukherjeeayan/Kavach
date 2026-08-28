import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRewardCatalog, useCreateRewardItem, useRewardPoints, useAwardPoints, useRedemptions, useRedeemReward } from './useRewards';
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

const baseRewardCatalogItem = {
  id: 'r1',
  name: 'Extra Playtime',
  description: '30 minutes of extra screen time',
  cost_points: 100,
  icon: '??',
};

describe('useRewardCatalog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns initial state', () => {
    const { result } = renderHook(() => useRewardCatalog(), { wrapper: createWrapper() });
    expect(result.current.isPending).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it('fetches reward catalog', async () => {
    const mockCatalog = [baseRewardCatalogItem];
    vi.mocked(api.fetchRewardCatalog).mockResolvedValue(mockCatalog);

    const { result } = renderHook(() => useRewardCatalog(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data).toEqual(mockCatalog);
    });
  });
});

describe('useCreateRewardItem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns mutation interface', () => {
    const { result } = renderHook(() => useCreateRewardItem(), { wrapper: createWrapper() });
    expect(typeof result.current.mutate).toBe('function');
    expect(result.current.isPending).toBe(false);
  });

  it('calls createRewardItem on mutate', async () => {
    vi.mocked(api.createRewardItem).mockResolvedValue({ id: 'r2', ...baseRewardCatalogItem } as never);

    const { result } = renderHook(() => useCreateRewardItem(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync({ name: 'New Reward', cost_points: 50 });
    });

    expect(api.createRewardItem).toHaveBeenCalledWith({ name: 'New Reward', cost_points: 50 }, expect.anything());
  });
});

describe('useRewardPoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns initial state', () => {
    const { result } = renderHook(() => useRewardPoints('child-1'), { wrapper: createWrapper() });
    expect(result.current.isPending).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it('fetches reward points when childId is provided', async () => {
    const mockPoints = { total_points: 500, recent_entries: [] };
    vi.mocked(api.fetchRewardPoints).mockResolvedValue(mockPoints);

    const { result } = renderHook(() => useRewardPoints('child-1'), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data).toEqual(mockPoints);
    });
  });

  it('does not fetch when childId is null', () => {
    const { result } = renderHook(() => useRewardPoints(null), { wrapper: createWrapper() });
    expect(result.current.isPending).toBe(true);
    expect(api.fetchRewardPoints).not.toHaveBeenCalled();
  });
});

describe('useAwardPoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns mutation interface', () => {
    const { result } = renderHook(() => useAwardPoints('child-1'), { wrapper: createWrapper() });
    expect(typeof result.current.mutate).toBe('function');
    expect(result.current.isPending).toBe(false);
  });

  it('calls awardPoints on mutate', async () => {
    vi.mocked(api.awardPoints).mockResolvedValue(undefined as never);

    const { result } = renderHook(() => useAwardPoints('child-1'), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync({ points: 50, reason: 'Good behavior', source: 'parent' });
    });

    expect(api.awardPoints).toHaveBeenCalledWith('child-1', { points: 50, reason: 'Good behavior', source: 'parent' });
  });
});

describe('useRedemptions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns initial state', () => {
    const { result } = renderHook(() => useRedemptions('child-1'), { wrapper: createWrapper() });
    expect(result.current.isPending).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it('fetches redemptions when childId is provided', async () => {
    const mockRedemptions = [{ id: 'red1', reward_id: 'r1', points_cost: 100, status: 'pending' }];
    vi.mocked(api.fetchRedemptions).mockResolvedValue(mockRedemptions);

    const { result } = renderHook(() => useRedemptions('child-1'), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data).toEqual(mockRedemptions);
    });
  });

  it('does not fetch when childId is null', () => {
    const { result } = renderHook(() => useRedemptions(null), { wrapper: createWrapper() });
    expect(result.current.isPending).toBe(true);
    expect(api.fetchRedemptions).not.toHaveBeenCalled();
  });
});

describe('useRedeemReward', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns mutation interface', () => {
    const { result } = renderHook(() => useRedeemReward('child-1'), { wrapper: createWrapper() });
    expect(typeof result.current.mutate).toBe('function');
    expect(result.current.isPending).toBe(false);
  });

  it('calls redeemReward on mutate', async () => {
    const mockRedemption = { id: 'red1', reward_id: 'r1', points_cost: 100, status: 'completed' };
    vi.mocked(api.redeemReward).mockResolvedValue(mockRedemption as never);

    const { result } = renderHook(() => useRedeemReward('child-1'), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync('r1');
    });

    expect(api.redeemReward).toHaveBeenCalledWith('child-1', 'r1');
  });
});
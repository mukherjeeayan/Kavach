import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import RewardsPage from './RewardsPage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRewardCatalog } from '../hooks/useRewards';
import * as api from '../services/api';

vi.mock('../services/api');

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('RewardsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Rewards page with loading state', () => {
    const { container, unmount } = render(<RewardsPage childId="child-1" />, { wrapper: createWrapper() });
    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
    unmount();
  });

  it('displays when reward catalog is fetched', async () => {
    vi.mocked(api.fetchRewardCatalog).mockResolvedValue([
      { id: 'r1', name: 'Extra Playtime', description: '30 minutes of extra screen time', cost_points: 100, icon: '??' },
    ]);

    const { result } = renderHook(() => useRewardCatalog(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
  });
});
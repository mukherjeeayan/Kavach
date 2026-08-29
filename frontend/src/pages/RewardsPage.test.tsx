import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import RewardsPage from './RewardsPage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRewardCatalog } from '../hooks/useRewards';
import * as api from '../services/api';

vi.mock('../services/api');

function createWrapper(initialPath = '/children/child-1/rewards') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/children/:childId/rewards" element={children} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('RewardsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Rewards page with loading state', () => {
    const { container, unmount } = render(<RewardsPage />, { wrapper: createWrapper() });
    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
    unmount();
  });

  it('displays when reward catalog is fetched', async () => {
    vi.mocked(api.fetchRewardCatalog).mockResolvedValue([
      { id: 'r1', parent_id: 'parent-1', name: 'Extra Playtime', description: '30 minutes of extra screen time', cost_points: 100, icon: '🎮', is_active: true, created_at: '2026-01-01T00:00:00Z' },
    ]);

    const { result } = renderHook(() => useRewardCatalog(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          {children}
        </QueryClientProvider>
      ),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
  });
});
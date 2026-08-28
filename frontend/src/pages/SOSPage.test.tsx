import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import SOSPage from './SOSPage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSosEvents } from '../hooks/useSos';
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

describe('SOSPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders SOS page with loading state', () => {
    const { container, unmount } = render(<SOSPage childId="child-1" />, { wrapper: createWrapper() });
    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
    unmount();
  });

  it('displays when SOS events are fetched', async () => {
    vi.mocked(api.fetchSosEvents).mockResolvedValue([
      { id: 'evt-1', child_id: 'child-1', trigger_method: 'button', status: 'ACTIVE', created_at: '2026-08-20T10:00:00Z' },
    ]);

    const { result } = renderHook(() => useSosEvents('child-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
  });
});
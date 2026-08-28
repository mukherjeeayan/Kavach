import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import GeofencePage from './GeofencePage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useGeofences } from '../hooks/useGeofencing';
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

describe('GeofencePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Geofence page with loading state', () => {
    const { container, unmount } = render(<GeofencePage childId="child-1" />, { wrapper: createWrapper() });
    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
    unmount();
  });

  it('displays when geofences are fetched', async () => {
    vi.mocked(api.fetchGeofences).mockResolvedValue([
      { id: 'gf-1', name: 'Home Zone', latitude: 13.0827, longitude: 80.2707, radius_meters: 500, zone_type: 'HOME', alert_on_entry: true, alert_on_exit: true, is_active: true, created_at: '2026-08-20T00:00:00Z', updated_at: '2026-08-20T00:00:00Z' },
    ]);

    const { result } = renderHook(() => useGeofences('child-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
  });
});
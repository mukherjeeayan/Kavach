import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import LocationsSection from './LocationsSection';

vi.mock('../../hooks/usePhase1Data', () => ({
  useCurrentLocations: vi.fn(),
  useLocationHistory: vi.fn(),
}));

vi.mock('./LocationMap', () => ({
  default: ({ points }: { points: unknown[] }) => points.length > 0 ? <div data-testid="location-map" /> : null,
}));

import { useCurrentLocations, useLocationHistory } from '../../hooks/usePhase1Data';

const mockedUseCurrentLocations = useCurrentLocations as ReturnType<typeof vi.fn>;
const mockedUseLocationHistory = useLocationHistory as ReturnType<typeof vi.fn>;

describe('LocationsSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows empty state', () => {
    mockedUseCurrentLocations.mockReturnValue({ data: [], isLoading: false });
    mockedUseLocationHistory.mockReturnValue({ data: [], isLoading: false });
    render(<LocationsSection childId="child-1" />);
    expect(screen.getByText(/no location pings yet/i)).toBeInTheDocument();
  });

  it('shows loading state', () => {
    mockedUseCurrentLocations.mockReturnValue({ data: undefined, isLoading: true });
    mockedUseLocationHistory.mockReturnValue({ data: undefined, isLoading: true });
    render(<LocationsSection childId="child-1" />);
    expect(screen.getByText('Location')).toBeInTheDocument();
  });

  it('renders location entries', () => {
    mockedUseCurrentLocations.mockReturnValue({ data: [], isLoading: false });
    mockedUseLocationHistory.mockReturnValue({
      data: [
        { id: 'p1', latitude: 28.6139, longitude: 77.2090, accuracy_m: 10, speed_kmh: null, recorded_at: '2026-08-21T10:00:00Z' },
      ],
      isLoading: false,
    });
    render(<LocationsSection childId="child-1" />);
    expect(screen.getByText(/28\.613900, 77\.209000/)).toBeInTheDocument();
    expect(screen.getByText('Open in Google Maps →')).toBeInTheDocument();
  });

  it('shows error state', () => {
    mockedUseCurrentLocations.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    mockedUseLocationHistory.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    render(<LocationsSection childId="child-1" />);
    expect(screen.getByText(/failed to load location data/i)).toBeInTheDocument();
  });
});

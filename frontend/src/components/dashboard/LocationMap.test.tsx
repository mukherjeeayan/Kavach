import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import LocationMap from './LocationMap';

// Mock react-leaflet to avoid DOM issues in tests
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="map-container">{children}</div>,
  TileLayer: () => null,
  Marker: () => null,
  Popup: () => null,
  useMap: () => ({
    setView: vi.fn(),
    fitBounds: vi.fn(),
  }),
}));

// Mock leaflet
vi.mock('leaflet', () => {
  const mockMergeOptions = vi.fn();
  const Icon = function MockIcon() {} as any;
  return {
    __esModule: true,
    default: {
      Icon: Object.assign(Icon, {
        Default: Object.assign(
          function MockDefaultIcon() {},
          { mergeOptions: mockMergeOptions, prototype: { _getIconUrl: undefined } }
        ),
      }),
      latLngBounds: vi.fn(),
    },
    mockMergeOptions,
  };
});

// Mock leaflet images
vi.mock('leaflet/dist/images/marker-icon-2x.png', () => ({ default: 'marker-icon-2x.png' }));
vi.mock('leaflet/dist/images/marker-icon.png', () => ({ default: 'marker-icon.png' }));
vi.mock('leaflet/dist/images/marker-shadow.png', () => ({ default: 'marker-shadow.png' }));

describe('LocationMap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the map container when points exist', () => {
    const { getByText, getByTestId } = render(
      <LocationMap
        points={[
          { id: 'p1', latitude: 13.0827, longitude: 80.2707, recorded_at: '2026-08-29T10:00:00Z', accuracy_m: 10, child_id: 'c1', device_id: 'd1', speed_kmh: 0 },
        ]}
      />
    );
    expect(getByText('On the map')).toBeInTheDocument();
    expect(getByTestId('map-container')).toBeInTheDocument();
  });

  it('renders nothing when there are no points', () => {
    const { container } = render(<LocationMap points={[]} />);
    expect(container.firstChild).toBeNull();
  });
});

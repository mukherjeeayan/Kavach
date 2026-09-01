import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import LocationMap from './LocationMap';
import apiClient from '../../services/apiClient';

vi.mock('mapbox-gl', () => {
  const createMarker = () => {
    const m: { setLngLat: () => typeof m; setPopup: () => typeof m; addTo: () => typeof m; remove: () => void } = {
      setLngLat() { return m; },
      setPopup() { return m; },
      addTo() { return m; },
      remove() {},
    };
    return m;
  };
  return {
    default: {
      Map: function () {
        return { remove: () => {}, fitBounds: () => {} };
      },
      Marker: function () { return createMarker(); },
      Popup: function () { return { setDOMContent: () => ({}) }; },
      LngLatBounds: function () { return { extend: () => {} }; },
      accessToken: '',
    },
  };
});

const mockedGet = vi.fn();

describe('LocationMap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(apiClient, 'get').mockImplementation(mockedGet);
  });

  it('renders the map container when a token is returned and points exist', async () => {
    mockedGet.mockResolvedValue({ data: { data: { token: 'pk.test' } } });
    const { findByText } = render(
      <LocationMap
        points={[
          { id: 'p1', latitude: 13.0827, longitude: 80.2707, recorded_at: '2026-08-29T10:00:00Z', accuracy_m: 10, child_id: 'c1', device_id: 'd1', speed_kmh: 0 },
        ]}
      />
    );
    expect(await findByText('On the map')).toBeInTheDocument();
  });

  it('renders nothing when no token is returned (fallback)', () => {
    mockedGet.mockResolvedValue({ data: { data: { token: null } } });
    const { container } = render(
      <LocationMap
        points={[
          { id: 'p1', latitude: 13.0827, longitude: 80.2707, recorded_at: '2026-08-29T10:00:00Z', accuracy_m: 10, child_id: 'c1', device_id: 'd1', speed_kmh: 0 },
        ]}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when the token request fails', () => {
    mockedGet.mockRejectedValue(new Error('Network error'));
    const { container } = render(
      <LocationMap
        points={[
          { id: 'p1', latitude: 13.0827, longitude: 80.2707, recorded_at: '2026-08-29T10:00:00Z', accuracy_m: 10, child_id: 'c1', device_id: 'd1', speed_kmh: 0 },
        ]}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when there are no points', () => {
    mockedGet.mockResolvedValue({ data: { data: { token: 'pk.test' } } });
    const { container } = render(<LocationMap points={[]} />);
    expect(container.firstChild).toBeNull();
  });
});

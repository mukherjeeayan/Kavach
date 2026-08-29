import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import GeofenceSection from './GeofenceSection';

vi.mock('../../hooks/useGeofencing', () => ({
  useGeofences: vi.fn(),
  useCreateGeofence: vi.fn(),
  useDeleteGeofence: vi.fn(),
  useUpdateGeofence: vi.fn(),
}));

import { useGeofences, useCreateGeofence, useDeleteGeofence, useUpdateGeofence } from '../../hooks/useGeofencing';

const mockedUseGeofences = useGeofences as ReturnType<typeof vi.fn>;
const mockedUseCreateGeofence = useCreateGeofence as ReturnType<typeof vi.fn>;
const mockedUseDeleteGeofence = useDeleteGeofence as ReturnType<typeof vi.fn>;
const mockedUseUpdateGeofence = useUpdateGeofence as ReturnType<typeof vi.fn>;

describe('GeofenceSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseCreateGeofence.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    mockedUseDeleteGeofence.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    mockedUseUpdateGeofence.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
  });

  it('renders geofence entries', () => {
    mockedUseGeofences.mockReturnValue({
      data: [
        { id: 'g1', name: 'Home', zone_type: 'HOME', radius_meters: 500, is_active: true, alert_on_entry: true, alert_on_exit: true, latitude: 13.0, longitude: 80.0, child_id: 'child-1', device_id: null, created_at: '', updated_at: '' },
        { id: 'g2', name: 'School', zone_type: 'SCHOOL', radius_meters: 1000, is_active: false, alert_on_entry: false, alert_on_exit: true, latitude: 13.1, longitude: 80.1, child_id: 'child-1', device_id: null, created_at: '', updated_at: '' },
      ],
      isLoading: false,
    });
    render(<GeofenceSection childId="child-1" onError={vi.fn()} />);
    expect(screen.getByText('Geofencing')).toBeInTheDocument();
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('School')).toBeInTheDocument();
    expect(screen.getByText(/2 zones configured/i)).toBeInTheDocument();
  });

  it('shows empty state when there are no geofences', () => {
    mockedUseGeofences.mockReturnValue({ data: [], isLoading: false });
    render(<GeofenceSection childId="child-1" onError={vi.fn()} />);
    expect(screen.getByText(/no geofences configured yet/i)).toBeInTheDocument();
  });

  it('shows the add form when + Add Zone is clicked', () => {
    mockedUseGeofences.mockReturnValue({ data: [], isLoading: false });
    render(<GeofenceSection childId="child-1" onError={vi.fn()} />);
    fireEvent.click(screen.getByText('+ Add Zone'));
    expect(screen.getByPlaceholderText('Zone name')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Latitude')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Longitude')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Radius (m)')).toBeInTheDocument();
    expect(screen.getByText('Create Zone')).toBeInTheDocument();
  });

  it('shows loading skeleton while fetching', () => {
    mockedUseGeofences.mockReturnValue({ data: undefined, isLoading: true });
    const { container } = render(<GeofenceSection childId="child-1" onError={vi.fn()} />);
    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
  });

  it('calls onError when invalid coordinates are submitted', () => {
    const onError = vi.fn();
    mockedUseGeofences.mockReturnValue({ data: [], isLoading: false });
    render(<GeofenceSection childId="child-1" onError={onError} />);
    fireEvent.click(screen.getByText('+ Add Zone'));
    const latInput = screen.getByPlaceholderText('Latitude');
    const lngInput = screen.getByPlaceholderText('Longitude');
    fireEvent.change(latInput, { target: { value: 'not-a-number' } });
    fireEvent.change(lngInput, { target: { value: '80.0' } });
    fireEvent.click(screen.getByText('Create Zone'));
    expect(onError).toHaveBeenCalledWith('Please enter valid coordinates and radius');
  });
});

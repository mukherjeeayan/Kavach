import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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

const sampleGeofence = {
  id: 'g1',
  name: 'Home',
  zone_type: 'HOME',
  radius_meters: 500,
  is_active: true,
  alert_on_entry: true,
  alert_on_exit: false,
  latitude: 13.0,
  longitude: 80.0,
  child_id: 'child-1',
  device_id: null,
  created_at: '',
  updated_at: '',
};

describe('GeofenceSection edit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseCreateGeofence.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    mockedUseDeleteGeofence.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
  });

  it('renders an edit button for each geofence row', () => {
    mockedUseGeofences.mockReturnValue({ data: [sampleGeofence], isLoading: false });
    mockedUseUpdateGeofence.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });

    render(<GeofenceSection childId="child-1" onError={vi.fn()} />);

    const editButton = screen.getByRole('button', { name: /edit home/i });
    expect(editButton).toBeInTheDocument();
  });

  it('opens an inline edit form with prefilled values when the edit button is clicked', () => {
    mockedUseGeofences.mockReturnValue({ data: [sampleGeofence], isLoading: false });
    mockedUseUpdateGeofence.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });

    render(<GeofenceSection childId="child-1" onError={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /edit home/i }));

    const form = screen.getByTestId('geofence-edit-form');
    expect(form).toBeInTheDocument();

    expect((screen.getByLabelText('Zone name') as HTMLInputElement).value).toBe('Home');
    expect((screen.getByLabelText('Latitude') as HTMLInputElement).value).toBe('13');
    expect((screen.getByLabelText('Longitude') as HTMLInputElement).value).toBe('80');
    expect((screen.getByLabelText('Radius') as HTMLInputElement).value).toBe('500');
  });

  it('calls useUpdateGeofence with the new values when save is clicked', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({});
    mockedUseGeofences.mockReturnValue({ data: [sampleGeofence], isLoading: false });
    mockedUseUpdateGeofence.mockReturnValue({ mutateAsync, isPending: false });

    render(<GeofenceSection childId="child-1" onError={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /edit home/i }));

    fireEvent.change(screen.getByLabelText('Zone name'), { target: { value: 'Home Sweet Home' } });
    fireEvent.change(screen.getByLabelText('Latitude'), { target: { value: '12.5' } });
    fireEvent.change(screen.getByLabelText('Longitude'), { target: { value: '79.5' } });
    fireEvent.change(screen.getByLabelText('Radius'), { target: { value: '750' } });

    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledTimes(1);
    });
    expect(mutateAsync).toHaveBeenCalledWith({
      geofenceId: 'g1',
      input: expect.objectContaining({
        name: 'Home Sweet Home',
        latitude: 12.5,
        longitude: 79.5,
        radius_meters: 750,
      }),
    });
  });

  it('discards changes and closes the form when cancel is clicked', () => {
    const mutateAsync = vi.fn();
    mockedUseGeofences.mockReturnValue({ data: [sampleGeofence], isLoading: false });
    mockedUseUpdateGeofence.mockReturnValue({ mutateAsync, isPending: false });

    render(<GeofenceSection childId="child-1" onError={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /edit home/i }));
    expect(screen.getByTestId('geofence-edit-form')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Zone name'), { target: { value: 'Should not save' } });
    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));

    expect(screen.queryByTestId('geofence-edit-form')).not.toBeInTheDocument();
    expect(mutateAsync).not.toHaveBeenCalled();
  });
});

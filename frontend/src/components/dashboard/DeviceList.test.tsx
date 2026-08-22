import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import DeviceList from './DeviceList';
import type { DeviceProfile } from '../../types/api';

const baseDevice = {
  child_id: 'child-1',
  os_version: null,
  fcm_token: null,
};

describe('DeviceList', () => {
  const defaultProps = {
    devices: [] as DeviceProfile[],
    selectedDeviceId: null as string | null,
    onSelect: vi.fn(),
  };

  it('shows empty state', () => {
    render(<DeviceList {...defaultProps} />);
    expect(screen.getByText(/no registered devices/i)).toBeInTheDocument();
  });

  it('renders device cards', () => {
    const devices: DeviceProfile[] = [
      { ...baseDevice, device_id: 'dev-1', device_name: 'Pixel 7', device_type: 'ANDROID', os_version: '14', admin_active: true, last_active: '2026-08-21T10:00:00Z' },
      { ...baseDevice, device_id: 'dev-2', device_name: 'Samsung S23', device_type: 'ANDROID', os_version: '13', admin_active: false, last_active: null },
    ];
    render(<DeviceList {...defaultProps} devices={devices} />);
    expect(screen.getByText('Pixel 7')).toBeInTheDocument();
    expect(screen.getByText('Samsung S23')).toBeInTheDocument();
  });

  it('shows protected status when admin is active', () => {
    const devices: DeviceProfile[] = [
      { ...baseDevice, device_id: 'dev-1', device_name: 'Pixel 7', device_type: 'ANDROID', os_version: '14', admin_active: true, last_active: null },
    ];
    render(<DeviceList {...defaultProps} devices={devices} />);
    expect(screen.getByText(/protected/i)).toBeInTheDocument();
  });

  it('shows warning when admin is not active', () => {
    const devices: DeviceProfile[] = [
      { ...baseDevice, device_id: 'dev-1', device_name: 'Pixel 7', device_type: 'ANDROID', os_version: '14', admin_active: false, last_active: null },
    ];
    render(<DeviceList {...defaultProps} devices={devices} />);
    expect(screen.getByText(/admin not active/i)).toBeInTheDocument();
  });

  it('highlights selected device', () => {
    const devices: DeviceProfile[] = [
      { ...baseDevice, device_id: 'dev-1', device_name: 'Pixel 7', device_type: 'ANDROID', os_version: '14', admin_active: true, last_active: null },
    ];
    render(<DeviceList {...defaultProps} devices={devices} selectedDeviceId="dev-1" />);
    const card = screen.getByText('Pixel 7').closest('div')!;
    expect(card.className).toContain('border-primary');
  });
});

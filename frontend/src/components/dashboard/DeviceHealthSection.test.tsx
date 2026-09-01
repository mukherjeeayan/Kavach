import { describe, expect, it, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import DeviceHealthSection from './DeviceHealthSection';

vi.mock('../../hooks/useDeviceHealth', () => ({
  useDeviceHealth: vi.fn(),
}));

vi.mock('../ui/Skeleton', () => ({
  SkeletonCard: () => <div aria-hidden="true" data-testid="skeleton-card" />,
}));

import { useDeviceHealth } from '../../hooks/useDeviceHealth';

const mockedUseDeviceHealth = useDeviceHealth as ReturnType<typeof vi.fn>;

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeAll(() => {
  (globalThis as unknown as { ResizeObserver: typeof ResizeObserverStub }).ResizeObserver = ResizeObserverStub;
});

const sampleHealth = {
  id: 'h1',
  device_id: 'dev-1',
  battery_level: 75,
  is_charging: true,
  storage_total_mb: 64000,
  storage_free_mb: 32000,
  is_rooted: false,
  is_developer_options: false,
  is_usb_debugging: false,
  os_version: 'Android 14',
  app_version: '1.2.3',
  recorded_at: '2026-08-29T10:00:00Z',
  created_at: '2026-08-29T10:00:00Z',
};

describe('DeviceHealthSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseDeviceHealth.mockReturnValue({ data: null, isLoading: false });
  });

  it('shows message when no device is selected', () => {
    render(<DeviceHealthSection childId="child-1" deviceId={null} />);
    expect(screen.getByText(/select a device to view health/i)).toBeInTheDocument();
  });

  it('shows loading skeleton while fetching', () => {
    mockedUseDeviceHealth.mockReturnValue({ data: undefined, isLoading: true });
    render(<DeviceHealthSection childId="child-1" deviceId="dev-1" />);
    expect(screen.getByTestId('skeleton-card')).toBeInTheDocument();
  });

  it('shows empty state when no health data is available', () => {
    render(<DeviceHealthSection childId="child-1" deviceId="dev-1" />);
    expect(screen.getByText(/no health data available/i)).toBeInTheDocument();
  });

  it('renders heading with last updated time', () => {
    mockedUseDeviceHealth.mockReturnValue({ data: sampleHealth, isLoading: false });
    render(<DeviceHealthSection childId="child-1" deviceId="dev-1" />);
    expect(screen.getByText('Device Health')).toBeInTheDocument();
    expect(screen.getByText(/last updated:/i)).toBeInTheDocument();
  });

  it('displays battery level and charging status', () => {
    mockedUseDeviceHealth.mockReturnValue({ data: sampleHealth, isLoading: false });
    render(<DeviceHealthSection childId="child-1" deviceId="dev-1" />);
    expect(screen.getByText('Battery')).toBeInTheDocument();
    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(screen.getByText('Charging')).toBeInTheDocument();
  });

  it('displays storage usage percentage', () => {
    mockedUseDeviceHealth.mockReturnValue({ data: sampleHealth, isLoading: false });
    render(<DeviceHealthSection childId="child-1" deviceId="dev-1" />);
    expect(screen.getByText('Storage')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText(/31GB free of 63GB/)).toBeInTheDocument();
  });

  it('displays security status as Clean when not rooted', () => {
    mockedUseDeviceHealth.mockReturnValue({ data: sampleHealth, isLoading: false });
    render(<DeviceHealthSection childId="child-1" deviceId="dev-1" />);
    expect(screen.getByText('Security')).toBeInTheDocument();
    expect(screen.getByText('Clean')).toBeInTheDocument();
    expect(screen.queryByText('ROOTED')).not.toBeInTheDocument();
  });

  it('displays ROOTED badge when device is rooted', () => {
    mockedUseDeviceHealth.mockReturnValue({
      data: { ...sampleHealth, is_rooted: true },
      isLoading: false,
    });
    render(<DeviceHealthSection childId="child-1" deviceId="dev-1" />);
    expect(screen.getByText('ROOTED')).toBeInTheDocument();
  });

  it('displays USB Debug badge when USB debugging is enabled', () => {
    mockedUseDeviceHealth.mockReturnValue({
      data: { ...sampleHealth, is_usb_debugging: true },
      isLoading: false,
    });
    render(<DeviceHealthSection childId="child-1" deviceId="dev-1" />);
    expect(screen.getByText('USB Debug')).toBeInTheDocument();
  });

  it('displays OS version and app version', () => {
    mockedUseDeviceHealth.mockReturnValue({ data: sampleHealth, isLoading: false });
    render(<DeviceHealthSection childId="child-1" deviceId="dev-1" />);
    expect(screen.getByText('Android 14')).toBeInTheDocument();
    expect(screen.getByText(/app: 1.2.3/i)).toBeInTheDocument();
  });

  it('displays Unknown when OS version is null', () => {
    mockedUseDeviceHealth.mockReturnValue({
      data: { ...sampleHealth, os_version: null },
      isLoading: false,
    });
    render(<DeviceHealthSection childId="child-1" deviceId="dev-1" />);
    expect(screen.getByText('Unknown')).toBeInTheDocument();
  });

  it('displays No data when storage free is null', () => {
    mockedUseDeviceHealth.mockReturnValue({
      data: { ...sampleHealth, storage_free_mb: null },
      isLoading: false,
    });
    render(<DeviceHealthSection childId="child-1" deviceId="dev-1" />);
    expect(screen.getByText('No data')).toBeInTheDocument();
  });
});

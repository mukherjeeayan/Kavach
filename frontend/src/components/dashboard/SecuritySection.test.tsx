import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SecuritySection from './SecuritySection';

vi.mock('../../hooks/usePredictions', () => ({
  useSecurityScans: vi.fn(),
  useWifiLogs: vi.fn(),
}));

vi.mock('../ui/Skeleton', () => ({
  SkeletonTable: ({ rows }: { rows: number }) => (
    <div data-testid="skeleton-table" data-rows={rows} />
  ),
}));

import { useSecurityScans, useWifiLogs } from '../../hooks/usePredictions';

const mockedUseSecurityScans = useSecurityScans as ReturnType<typeof vi.fn>;
const mockedUseWifiLogs = useWifiLogs as ReturnType<typeof vi.fn>;

const sampleScan = {
  id: 's1',
  device_id: 'dev-1',
  scan_type: 'ROOT' as const,
  result: {},
  threats_found: 0,
  scanned_at: '2026-08-29T10:00:00Z',
};

const sampleWifiLog = {
  id: 'w1',
  device_id: 'dev-1',
  ssid: 'HomeNetwork',
  bssid: '00:11:22:33:44:55',
  security_type: 'WPA2',
  is_open: false,
  is_known: true,
  ip_address: '192.168.1.100',
  recorded_at: '2026-08-29T10:00:00Z',
};

describe('SecuritySection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows message when no device is selected', () => {
    mockedUseSecurityScans.mockReturnValue({ data: undefined, isLoading: false });
    mockedUseWifiLogs.mockReturnValue({ data: undefined, isLoading: false });
    render(<SecuritySection childId="child-1" deviceId={null} />);
    expect(screen.getByText(/select a device to view security/i)).toBeInTheDocument();
  });

  it('shows loading skeleton while fetching', () => {
    mockedUseSecurityScans.mockReturnValue({ data: undefined, isLoading: true });
    mockedUseWifiLogs.mockReturnValue({ data: undefined, isLoading: true });
    render(<SecuritySection childId="child-1" deviceId="dev-1" />);
    expect(screen.getByTestId('skeleton-table')).toBeInTheDocument();
  });

  it('renders heading and tab buttons', () => {
    mockedUseSecurityScans.mockReturnValue({ data: [], isLoading: false });
    mockedUseWifiLogs.mockReturnValue({ data: [], isLoading: false });
    render(<SecuritySection childId="child-1" deviceId="dev-1" />);
    expect(screen.getByText('Security')).toBeInTheDocument();
    expect(screen.getByText('Scans and network monitoring')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /security scans/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /wifi history/i })).toBeInTheDocument();
  });

  it('shows empty state when no security scans', () => {
    mockedUseSecurityScans.mockReturnValue({ data: [], isLoading: false });
    mockedUseWifiLogs.mockReturnValue({ data: [], isLoading: false });
    render(<SecuritySection childId="child-1" deviceId="dev-1" />);
    expect(screen.getByText(/no security scans recorded yet/i)).toBeInTheDocument();
  });

  it('renders security scans with no threats', () => {
    mockedUseSecurityScans.mockReturnValue({
      data: [{ ...sampleScan, threats_found: 0, scan_type: 'FULL' }],
      isLoading: false,
    });
    mockedUseWifiLogs.mockReturnValue({ data: [], isLoading: false });
    render(<SecuritySection childId="child-1" deviceId="dev-1" />);
    expect(screen.getByText('FULL Scan')).toBeInTheDocument();
    expect(screen.getByText('0 threats')).toBeInTheDocument();
  });

  it('renders security scan with threats', () => {
    mockedUseSecurityScans.mockReturnValue({
      data: [{ ...sampleScan, threats_found: 3, scan_type: 'APP_INTEGRITY' }],
      isLoading: false,
    });
    mockedUseWifiLogs.mockReturnValue({ data: [], isLoading: false });
    render(<SecuritySection childId="child-1" deviceId="dev-1" />);
    expect(screen.getByText('APP_INTEGRITY Scan')).toBeInTheDocument();
    expect(screen.getByText('3 threats')).toBeInTheDocument();
  });

  it('switches to WiFi History tab and shows wifi logs', () => {
    mockedUseSecurityScans.mockReturnValue({ data: [], isLoading: false });
    mockedUseWifiLogs.mockReturnValue({ data: [sampleWifiLog], isLoading: false });
    render(<SecuritySection childId="child-1" deviceId="dev-1" />);
    fireEvent.click(screen.getByRole('button', { name: /wifi history/i }));
    expect(screen.getByText('Network')).toBeInTheDocument();
    expect(screen.getByText('HomeNetwork')).toBeInTheDocument();
    expect(screen.getByText('WPA2')).toBeInTheDocument();
    expect(screen.getByText('Known')).toBeInTheDocument();
  });

  it('shows empty WiFi state when no logs', () => {
    mockedUseSecurityScans.mockReturnValue({ data: [], isLoading: false });
    mockedUseWifiLogs.mockReturnValue({ data: [], isLoading: false });
    render(<SecuritySection childId="child-1" deviceId="dev-1" />);
    fireEvent.click(screen.getByRole('button', { name: /wifi history/i }));
    expect(screen.getByText(/no wifi connection logs recorded/i)).toBeInTheDocument();
  });

  it('shows Open security badge for open wifi', () => {
    mockedUseSecurityScans.mockReturnValue({ data: [], isLoading: false });
    mockedUseWifiLogs.mockReturnValue({
      data: [{ ...sampleWifiLog, is_open: true, security_type: null }],
      isLoading: false,
    });
    render(<SecuritySection childId="child-1" deviceId="dev-1" />);
    fireEvent.click(screen.getByRole('button', { name: /wifi history/i }));
    expect(screen.getByText('Open')).toBeInTheDocument();
  });

  it('shows Unknown status for unknown wifi', () => {
    mockedUseSecurityScans.mockReturnValue({ data: [], isLoading: false });
    mockedUseWifiLogs.mockReturnValue({
      data: [{ ...sampleWifiLog, is_known: false }],
      isLoading: false,
    });
    render(<SecuritySection childId="child-1" deviceId="dev-1" />);
    fireEvent.click(screen.getByRole('button', { name: /wifi history/i }));
    expect(screen.getByText('Unknown')).toBeInTheDocument();
  });
});

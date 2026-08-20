import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import AlertsSection from './AlertsSection';

vi.mock('../../hooks/usePhase1Data', () => ({
  useChildAlerts: vi.fn(),
}));

import { useChildAlerts } from '../../hooks/usePhase1Data';

const mockedUseChildAlerts = useChildAlerts as ReturnType<typeof vi.fn>;

describe('AlertsSection', () => {
  it('shows the empty state', () => {
    mockedUseChildAlerts.mockReturnValue({ data: [] });
    render(<AlertsSection childId="child-1" />);
    expect(
      screen.getByText(/no alerts yet/i)
    ).toBeInTheDocument();
  });

  it('shows a tamper alert', () => {
    mockedUseChildAlerts.mockReturnValue({
      data: [
        {
          action: 'TAMPER_ALERT',
          resource_type: 'audit_logs',
          details: {},
          created_at: '2026-08-19T10:00:00.000Z',
        },
      ],
    });
    render(<AlertsSection childId="child-1" />);
    expect(screen.getByText('Device tamper detected')).toBeInTheDocument();
  });

  it('shows a screen-time limit alert with its limit', () => {
    mockedUseChildAlerts.mockReturnValue({
      data: [
        {
          action: 'SCREEN_TIME_LIMIT_REACHED',
          resource_type: 'audit_logs',
          details: { limit_minutes: 60 },
          created_at: '2026-08-19T10:00:00.000Z',
        },
      ],
    });
    render(<AlertsSection childId="child-1" />);
    expect(screen.getByText('Screen-time limit reached')).toBeInTheDocument();
    expect(screen.getByText(/60 min/)).toBeInTheDocument();
  });

  it('shows an error state', () => {
    mockedUseChildAlerts.mockReturnValue({ isError: true });
    render(<AlertsSection childId="child-1" />);
    expect(screen.getByRole('alert')).toHaveTextContent(/failed to load alerts/i);
  });
});
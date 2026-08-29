import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AlertsSection from './AlertsSection';

vi.mock('../../hooks/usePhase1Data', () => ({
  useChildAlerts: vi.fn(),
}));

import { useChildAlerts } from '../../hooks/usePhase1Data';

const mockedUseChildAlerts = useChildAlerts as ReturnType<typeof vi.fn>;

const buildAlerts = (count: number) =>
  Array.from({ length: count }).map((_, i) => ({
    id: `a${i}`,
    action: i % 2 === 0 ? 'TAMPER_ALERT' : 'SCREEN_TIME_LIMIT_REACHED',
    resource_type: 'audit_logs',
    details: { limit_minutes: 60 },
    created_at: `2026-08-19T10:0${i}:00.000Z`,
    acknowledged_at: null,
  }));

describe('AlertsSection', () => {
  it('shows the empty state', () => {
    mockedUseChildAlerts.mockReturnValue({
      data: { data: [], meta: { page: 1, limit: 20, total: 0, total_pages: 0 } },
    });
    render(<AlertsSection childId="child-1" />);
    expect(screen.getByText(/no alerts yet/i)).toBeInTheDocument();
  });

  it('shows a tamper alert', () => {
    mockedUseChildAlerts.mockReturnValue({
      data: {
        data: [
          {
            action: 'TAMPER_ALERT',
            resource_type: 'audit_logs',
            details: {},
            created_at: '2026-08-19T10:00:00.000Z',
          },
        ],
        meta: { page: 1, limit: 20, total: 1, total_pages: 1 },
      },
    });
    render(<AlertsSection childId="child-1" />);
    expect(screen.getByText('Device tamper detected')).toBeInTheDocument();
  });

  it('shows a screen-time limit alert with its limit', () => {
    mockedUseChildAlerts.mockReturnValue({
      data: {
        data: [
          {
            action: 'SCREEN_TIME_LIMIT_REACHED',
            resource_type: 'audit_logs',
            details: { limit_minutes: 60 },
            created_at: '2026-08-19T10:00:00.000Z',
          },
        ],
        meta: { page: 1, limit: 20, total: 1, total_pages: 1 },
      },
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

  it('does not show pagination when there is only one page', () => {
    mockedUseChildAlerts.mockReturnValue({
      data: {
        data: buildAlerts(3),
        meta: { page: 1, limit: 20, total: 3, total_pages: 1 },
      },
    });
    render(<AlertsSection childId="child-1" />);
    expect(screen.queryByText(/Page 1 of/)).not.toBeInTheDocument();
  });

  it('shows pagination controls when there are multiple pages', () => {
    mockedUseChildAlerts.mockReturnValue({
      data: {
        data: buildAlerts(3),
        meta: { page: 1, limit: 20, total: 45, total_pages: 3 },
      },
    });
    render(<AlertsSection childId="child-1" />);
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
  });

  it('disables Prev on the first page', () => {
    mockedUseChildAlerts.mockReturnValue({
      data: {
        data: buildAlerts(3),
        meta: { page: 1, limit: 20, total: 45, total_pages: 3 },
      },
    });
    render(<AlertsSection childId="child-1" />);
    const prev = screen.getByText('Prev').closest('button')!;
    expect(prev).toBeDisabled();
  });

  it('disables Next on the last page', () => {
    mockedUseChildAlerts.mockReturnValue({
      data: {
        data: buildAlerts(3),
        meta: { page: 1, limit: 20, total: 45, total_pages: 3 },
      },
    });
    render(<AlertsSection childId="child-1" />);
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Next'));
    const next = screen.getByText('Next').closest('button')!;
    expect(next).toBeDisabled();
  });

  it('calls useChildAlerts with the next page when Next is clicked', () => {
    mockedUseChildAlerts.mockReturnValue({
      data: {
        data: buildAlerts(3),
        meta: { page: 1, limit: 20, total: 45, total_pages: 3 },
      },
    });
    render(<AlertsSection childId="child-1" />);
    fireEvent.click(screen.getByText('Next'));
    expect(mockedUseChildAlerts).toHaveBeenLastCalledWith('child-1', 2, 20);
  });

  it('calls useChildAlerts with the previous page when Prev is clicked', () => {
    mockedUseChildAlerts.mockReturnValue({
      data: {
        data: buildAlerts(3),
        meta: { page: 2, limit: 20, total: 45, total_pages: 3 },
      },
    });
    render(<AlertsSection childId="child-1" />);
    fireEvent.click(screen.getByText('Prev'));
    expect(mockedUseChildAlerts).toHaveBeenLastCalledWith('child-1', 1, 20);
  });
});

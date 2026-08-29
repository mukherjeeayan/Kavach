import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AnalyticsSection from './AnalyticsSection';
import type { AnalyticsReport } from '../../types/api';

const { mockedUseGenerateReport, mockedUseLatestReport, mockedUseChildren } = vi.hoisted(() => ({
  mockedUseGenerateReport: vi.fn(),
  mockedUseLatestReport: vi.fn(),
  mockedUseChildren: vi.fn(),
}));

vi.mock('../../hooks/useAnalytics', () => ({
  useGenerateReport: (...args: unknown[]) => mockedUseGenerateReport(...args),
  useLatestReport: (...args: unknown[]) => mockedUseLatestReport(...args),
}));

vi.mock('../../hooks/useChildrenData', () => ({
  useChildren: (...args: unknown[]) => mockedUseChildren(...args),
}));

const makeReport = (): AnalyticsReport => ({
  id: 'rep-1',
  child_id: 'child-1',
  report_type: 'WEEKLY',
  period_start: '2026-08-13T00:00:00Z',
  period_end: '2026-08-20T00:00:00Z',
  generated_at: '2026-08-20T10:00:00Z',
  data: {
    screen_time: { grand_total_seconds: 7200, daily_totals: [], by_app: [], by_category: [] },
    location: { total_pings: 42 },
    communications: [{ comm_type: 'SMS', count: 5, flagged: 0 }],
    keyword_alerts: [{ severity: 'HIGH', count: 2 }],
  },
});

describe('AnalyticsSection export', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseGenerateReport.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    mockedUseChildren.mockReturnValue({ data: [{ id: 'child-1', name: 'Alice' }] });
  });

  it('does not show Export PDF button when no report exists', () => {
    mockedUseLatestReport.mockReturnValue({ data: null, isLoading: false });
    render(<AnalyticsSection childId="child-1" onError={vi.fn()} />);
    const btn = screen.queryByText('Export PDF') as HTMLButtonElement | null;
    expect(btn).toBeInTheDocument();
    expect(btn).toBeDisabled();
  });

  it('shows Export PDF button enabled when a report exists', () => {
    mockedUseLatestReport.mockReturnValue({ data: makeReport(), isLoading: false });
    render(<AnalyticsSection childId="child-1" onError={vi.fn()} />);
    const btn = screen.getByText('Export PDF') as HTMLButtonElement;
    expect(btn).toBeInTheDocument();
    expect(btn).not.toBeDisabled();
  });

  it('opens a print window when Export PDF is clicked', () => {
    const writeSpy = vi.fn();
    const printSpy = vi.fn();
    const closeSpy = vi.fn();
    const focusSpy = vi.fn();
    const openSpy = vi.spyOn(window, 'open').mockReturnValue({
      document: { write: writeSpy, close: closeSpy },
      focus: focusSpy,
      print: printSpy,
    } as unknown as Window);
    mockedUseLatestReport.mockReturnValue({ data: makeReport(), isLoading: false });
    render(<AnalyticsSection childId="child-1" onError={vi.fn()} />);

    fireEvent.click(screen.getByText('Export PDF'));

    expect(openSpy).toHaveBeenCalled();
    expect(writeSpy).toHaveBeenCalled();
    const htmlArg = writeSpy.mock.calls[0][0] as string;
    expect(htmlArg).toContain('Alice');
    expect(htmlArg).toContain('Safety score');
    expect(htmlArg).toContain('Kavach weekly report');
    openSpy.mockRestore();
  });
});

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ScreenTimeSection from './ScreenTimeSection';

const mocks = vi.hoisted(() => ({
  useSubscriptionTier: vi.fn(),
}));

vi.mock('../../store/authSlice', () => ({
  useSubscriptionTier: (...args: unknown[]) => mocks.useSubscriptionTier(...args),
}));

vi.mock('../../hooks/usePhase1Data', () => ({
  useScreenTimeSummary: vi.fn(),
  useDailyScreenTime: vi.fn(),
  useScreenTimeLimitAction: vi.fn(),
}));

vi.mock('../ui/Skeleton', () => ({
  SkeletonStats: () => <div data-testid="skeleton-stats" />,
  SkeletonChart: () => <div data-testid="skeleton-chart" />,
  SkeletonTable: () => <div data-testid="skeleton-table" />,
}));

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="responsive-container">{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  ReferenceLine: () => null,
}));

import {
  useScreenTimeSummary,
  useDailyScreenTime,
  useScreenTimeLimitAction,
} from '../../hooks/usePhase1Data';

const mockSummary = vi.mocked(useScreenTimeSummary);
const mockDaily = vi.mocked(useDailyScreenTime);
const mockSaveLimit = vi.mocked(useScreenTimeLimitAction);

const defaultSummaryData = {
  total_seconds: 7200,
  daily: [
    { date_recorded: '2026-08-20', total_seconds: 3600 },
    { date_recorded: '2026-08-21', total_seconds: 3600 },
  ],
  by_app: [
    { app_package: 'com.android.chrome', app_category: 'Browser', total_seconds: 5400 },
    { app_package: 'com.instagram.android', app_category: 'Social', total_seconds: 1800 },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.useSubscriptionTier.mockReturnValue('PREMIUM');
  mockSummary.mockReturnValue({
    data: defaultSummaryData,
    isLoading: false,
    isError: false,
  } as any); // eslint-disable-line @typescript-eslint/no-explicit-any
  mockDaily.mockReturnValue({
    data: [],
    isLoading: false,
    isError: false,
  } as any); // eslint-disable-line @typescript-eslint/no-explicit-any
  mockSaveLimit.mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as any); // eslint-disable-line @typescript-eslint/no-explicit-any
});

describe('ScreenTimeSection', () => {
  it('renders heading', () => {
    render(<ScreenTimeSection childId="child-1" limitMinutes={null} />);
    expect(screen.getByText('Screen Time')).toBeInTheDocument();
  });

  it('renders range buttons (Day, Week, Month)', () => {
    render(<ScreenTimeSection childId="child-1" limitMinutes={null} />);
    expect(screen.getByRole('button', { name: 'Day' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Week' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Month' })).toBeInTheDocument();
  });

  it('Day button has aria-pressed=true by default', () => {
    render(<ScreenTimeSection childId="child-1" limitMinutes={null} />);
    expect(screen.getByRole('button', { name: 'Day' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Week' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Month' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('calls useScreenTimeSummary with default range "day"', () => {
    render(<ScreenTimeSection childId="child-1" limitMinutes={null} />);
    expect(mockSummary).toHaveBeenCalledWith('child-1', 'day');
  });

  it('switches range when Week is clicked', () => {
    render(<ScreenTimeSection childId="child-1" limitMinutes={null} />);
    fireEvent.click(screen.getByRole('button', { name: 'Week' }));
    expect(mockSummary).toHaveBeenCalledWith('child-1', 'week');
    expect(screen.getByRole('button', { name: 'Week' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Day' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('displays total time', () => {
    render(<ScreenTimeSection childId="child-1" limitMinutes={null} />);
    expect(screen.getByText('2h 0m')).toBeInTheDocument();
  });

  it('displays top app', () => {
    render(<ScreenTimeSection childId="child-1" limitMinutes={null} />);
    expect(screen.getAllByText('com.android.chrome').length).toBeGreaterThanOrEqual(1);
  });

  it('renders app usage table with app names and times', () => {
    render(<ScreenTimeSection childId="child-1" limitMinutes={null} />);
    expect(screen.getAllByText('com.android.chrome').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('com.instagram.android').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('1h 30m').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('30m').length).toBeGreaterThanOrEqual(1);
  });

  it('shows loading skeletons', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockSummary.mockReturnValue({ data: null, isLoading: true, isError: false } as any);
    render(<ScreenTimeSection childId="child-1" limitMinutes={null} />);
    expect(screen.getByTestId('skeleton-stats')).toBeInTheDocument();
    expect(screen.getByTestId('skeleton-chart')).toBeInTheDocument();
    expect(screen.getByTestId('skeleton-table')).toBeInTheDocument();
  });

  it('shows error state', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockSummary.mockReturnValue({ data: null, isLoading: false, isError: true } as any);
    render(<ScreenTimeSection childId="child-1" limitMinutes={null} />);
    expect(screen.getByText(/failed to load screen time data/i)).toBeInTheDocument();
  });

  it('shows empty state when no data', () => {
    mockSummary.mockReturnValue({
      data: { total_seconds: 0, daily: [], by_app: [] },
      isLoading: false,
      isError: false,
    } as any); // eslint-disable-line @typescript-eslint/no-explicit-any
    mockDaily.mockReturnValue({ data: [], isLoading: false, isError: false } as any); // eslint-disable-line @typescript-eslint/no-explicit-any
    render(<ScreenTimeSection childId="child-1" limitMinutes={null} />);
    expect(screen.getByText(/no usage recorded yet/i)).toBeInTheDocument();
  });

  it('displays current limit when set', () => {
    render(<ScreenTimeSection childId="child-1" limitMinutes={60} />);
    expect(screen.getByText(/current limit: 60 min\/day/i)).toBeInTheDocument();
  });

  it('displays no-limit message when limitMinutes is null', () => {
    render(<ScreenTimeSection childId="child-1" limitMinutes={null} />);
    expect(screen.getByText(/no limit set/i)).toBeInTheDocument();
  });

  it('renders the limit input', () => {
    render(<ScreenTimeSection childId="child-1" limitMinutes={null} />);
    expect(screen.getByPlaceholderText('No limit')).toBeInTheDocument();
  });

  it('renders Set limit and Clear buttons', () => {
    render(<ScreenTimeSection childId="child-1" limitMinutes={null} />);
    expect(screen.getByRole('button', { name: /set limit/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /clear/i })).toBeInTheDocument();
  });
});

import { describe, expect, it, vi, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import ScreenTimeChart from './ScreenTimeChart';

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  BarChart: ({ children, data }: { children: React.ReactNode; data: unknown[] }) => (
    <div data-testid="bar-chart" data-length={data.length}>{children}</div>
  ),
  Bar: ({ dataKey }: { dataKey: string }) => <div data-testid={`bar-${dataKey}`} />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  ReferenceLine: ({ y, label }: { y: number; label?: { value: string } }) => (
    <div data-testid="reference-line" data-y={y}>{label?.value}</div>
  ),
}));

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeAll(() => {
  (globalThis as unknown as { ResizeObserver: typeof ResizeObserverStub }).ResizeObserver = ResizeObserverStub;
});

const sampleData = [
  { date_recorded: '2026-08-25', total_seconds: 3600 },
  { date_recorded: '2026-08-26', total_seconds: 5400 },
  { date_recorded: '2026-08-27', total_seconds: 1800 },
];

describe('ScreenTimeChart', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <ScreenTimeChart data={sampleData} limitMinutes={null} />
    );
    expect(container).toBeInTheDocument();
  });

  it('renders the chart container and axes', () => {
    render(<ScreenTimeChart data={sampleData} limitMinutes={null} />);
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
    expect(screen.getByTestId('x-axis')).toBeInTheDocument();
    expect(screen.getByTestId('y-axis')).toBeInTheDocument();
    expect(screen.getByTestId('cartesian-grid')).toBeInTheDocument();
    expect(screen.getByTestId('tooltip')).toBeInTheDocument();
  });

  it('renders the bar with correct dataKey', () => {
    render(<ScreenTimeChart data={sampleData} limitMinutes={null} />);
    expect(screen.getByTestId('bar-total_seconds')).toBeInTheDocument();
  });

  it('renders a ReferenceLine when limitMinutes is set', () => {
    render(<ScreenTimeChart data={sampleData} limitMinutes={60} />);
    const refLine = screen.getByTestId('reference-line');
    expect(refLine).toBeInTheDocument();
    expect(refLine).toHaveAttribute('data-y', String(60 * 60));
    expect(refLine).toHaveTextContent('limit 60m');
  });

  it('does not render a ReferenceLine when limitMinutes is null', () => {
    render(<ScreenTimeChart data={sampleData} limitMinutes={null} />);
    expect(screen.queryByTestId('reference-line')).not.toBeInTheDocument();
  });

  it('does not render a ReferenceLine when limitMinutes is 0', () => {
    render(<ScreenTimeChart data={sampleData} limitMinutes={0} />);
    expect(screen.queryByTestId('reference-line')).not.toBeInTheDocument();
  });

  it('passes correct number of data items to BarChart', () => {
    render(<ScreenTimeChart data={sampleData} limitMinutes={null} />);
    expect(screen.getByTestId('bar-chart')).toHaveAttribute('data-length', '3');
  });

  it('renders with empty data array', () => {
    render(<ScreenTimeChart data={[]} limitMinutes={null} />);
    expect(screen.getByTestId('bar-chart')).toHaveAttribute('data-length', '0');
  });
});

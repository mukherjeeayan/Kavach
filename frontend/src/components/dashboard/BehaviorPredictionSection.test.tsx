import { describe, expect, it, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import BehaviorPredictionSection from './BehaviorPredictionSection';

vi.mock('../../hooks/usePredictions', () => ({
  useBehaviorPredictions: vi.fn(),
}));

vi.mock('../ui/Skeleton', () => ({
  SkeletonList: ({ items }: { items: number }) => (
    <div aria-hidden="true" data-testid="skeleton-list" data-items={items} />
  ),
}));

import { useBehaviorPredictions } from '../../hooks/usePredictions';

const mockedUseBehaviorPredictions = useBehaviorPredictions as ReturnType<typeof vi.fn>;

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeAll(() => {
  (globalThis as unknown as { ResizeObserver: typeof ResizeObserverStub }).ResizeObserver = ResizeObserverStub;
});

const buildPrediction = (overrides: Record<string, unknown>) => ({
  id: 'p1',
  child_id: 'child-1',
  prediction_type: 'HIGH_RISK_TIME' as const,
  confidence: 0.85,
  risk_score: 75,
  prediction_data: {},
  valid_from: '2026-08-01T00:00:00Z',
  valid_until: '2026-08-31T23:59:59Z',
  is_active: true,
  created_at: '2026-08-20T10:00:00Z',
  ...overrides,
});

describe('BehaviorPredictionSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading skeleton while fetching', () => {
    mockedUseBehaviorPredictions.mockReturnValue({ data: undefined, isLoading: true });
    const { container } = render(<BehaviorPredictionSection childId="child-1" />);
    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
  });

  it('shows empty state when there are no active predictions', () => {
    mockedUseBehaviorPredictions.mockReturnValue({ data: [], isLoading: false });
    render(<BehaviorPredictionSection childId="child-1" />);
    expect(screen.getByText(/no predictions available yet/i)).toBeInTheDocument();
  });

  it('hides inactive predictions', () => {
    mockedUseBehaviorPredictions.mockReturnValue({
      data: [buildPrediction({ id: 'p1', is_active: false })],
      isLoading: false,
    });
    render(<BehaviorPredictionSection childId="child-1" />);
    expect(screen.getByText(/no predictions available yet/i)).toBeInTheDocument();
  });

  it('renders heading and active prediction count', () => {
    mockedUseBehaviorPredictions.mockReturnValue({
      data: [
        buildPrediction({ id: 'p1' }),
        buildPrediction({ id: 'p2', prediction_type: 'SCREEN_TIME_TREND' }),
      ],
      isLoading: false,
    });
    render(<BehaviorPredictionSection childId="child-1" />);
    expect(screen.getByText('AI Insights')).toBeInTheDocument();
    expect(screen.getByText(/2 active prediction/i)).toBeInTheDocument();
  });

  it('renders prediction type labels and risk scores', () => {
    mockedUseBehaviorPredictions.mockReturnValue({
      data: [
        buildPrediction({ id: 'p1', prediction_type: 'HIGH_RISK_TIME', risk_score: 80, confidence: 0.9 }),
        buildPrediction({ id: 'p2', prediction_type: 'APP_USAGE_PATTERN', risk_score: 30, confidence: 0.6 }),
      ],
      isLoading: false,
    });
    render(<BehaviorPredictionSection childId="child-1" />);
    expect(screen.getByText('High Risk Time')).toBeInTheDocument();
    expect(screen.getByText('App Usage Pattern')).toBeInTheDocument();
    expect(screen.getByText('80')).toBeInTheDocument();
    expect(screen.getByText('30')).toBeInTheDocument();
  });

  it('displays confidence as percentage', () => {
    mockedUseBehaviorPredictions.mockReturnValue({
      data: [buildPrediction({ id: 'p1', confidence: 0.85 })],
      isLoading: false,
    });
    render(<BehaviorPredictionSection childId="child-1" />);
    expect(screen.getByText(/confidence: 85%/i)).toBeInTheDocument();
  });

  it('displays valid date range', () => {
    mockedUseBehaviorPredictions.mockReturnValue({
      data: [buildPrediction({ id: 'p1', valid_from: '2026-08-01T00:00:00Z', valid_until: '2026-08-31T23:59:59Z' })],
      isLoading: false,
    });
    render(<BehaviorPredictionSection childId="child-1" />);
    expect(screen.getByText(/valid:/i)).toBeInTheDocument();
  });

  it('displays singular form for one active prediction', () => {
    mockedUseBehaviorPredictions.mockReturnValue({
      data: [buildPrediction({ id: 'p1' })],
      isLoading: false,
    });
    render(<BehaviorPredictionSection childId="child-1" />);
    expect(screen.getByText(/1 active prediction$/i)).toBeInTheDocument();
  });

  it('handles unknown prediction types with fallback style', () => {
    mockedUseBehaviorPredictions.mockReturnValue({
      data: [buildPrediction({ id: 'p1', prediction_type: 'UNKNOWN_TYPE' as string })],
      isLoading: false,
    });
    render(<BehaviorPredictionSection childId="child-1" />);
    expect(screen.getByText('UNKNOWN_TYPE')).toBeInTheDocument();
  });
});

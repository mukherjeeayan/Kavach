import { describe, expect, it, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MoodTrackingSection from './MoodTrackingSection';

vi.mock('../../hooks/useMood', () => ({
  useMoodLogs: vi.fn(),
}));

import { useMoodLogs } from '../../hooks/useMood';

const mockedUseMoodLogs = useMoodLogs as ReturnType<typeof vi.fn>;

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeAll(() => {
  (globalThis as unknown as { ResizeObserver: typeof ResizeObserverStub }).ResizeObserver = ResizeObserverStub;
});

describe('MoodTrackingSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders mood entries with labels and notes', () => {
    mockedUseMoodLogs.mockReturnValue({
      data: {
        data: [
          { id: 'm1', mood_score: 5, note: 'Great day!', recorded_at: '2026-08-29T10:00:00Z' },
          { id: 'm2', mood_score: 3, note: null, recorded_at: '2026-08-28T10:00:00Z' },
        ],
        meta: { page: 1, limit: 20, total: 2, total_pages: 1 },
      },
      isLoading: false,
    });
    render(<MoodTrackingSection childId="child-1" />);
    expect(screen.getByText('Mood Tracking')).toBeInTheDocument();
    expect(screen.getByText('Very Happy')).toBeInTheDocument();
    expect(screen.getByText('Neutral')).toBeInTheDocument();
    expect(screen.getByText('"Great day!"')).toBeInTheDocument();
  });

  it('shows empty state when there are no mood logs', () => {
    mockedUseMoodLogs.mockReturnValue({
      data: { data: [], meta: { page: 1, limit: 20, total: 0, total_pages: 1 } },
      isLoading: false,
    });
    render(<MoodTrackingSection childId="child-1" />);
    expect(screen.getByText(/no mood entries recorded yet/i)).toBeInTheDocument();
  });

  it('shows loading skeleton while fetching', () => {
    mockedUseMoodLogs.mockReturnValue({ data: undefined, isLoading: true });
    const { container } = render(<MoodTrackingSection childId="child-1" />);
    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
  });

  it('does not show pagination when there is only one page', () => {
    mockedUseMoodLogs.mockReturnValue({
      data: {
        data: [{ id: 'm1', mood_score: 4, note: null, recorded_at: '2026-08-29T10:00:00Z' }],
        meta: { page: 1, limit: 20, total: 1, total_pages: 1 },
      },
      isLoading: false,
    });
    render(<MoodTrackingSection childId="child-1" />);
    expect(screen.queryByText(/Page 1 of/)).not.toBeInTheDocument();
  });

  it('shows pagination controls when there are multiple pages', () => {
    mockedUseMoodLogs.mockReturnValue({
      data: {
        data: [{ id: 'm1', mood_score: 4, note: null, recorded_at: '2026-08-29T10:00:00Z' }],
        meta: { page: 1, limit: 20, total: 45, total_pages: 3 },
      },
      isLoading: false,
    });
    render(<MoodTrackingSection childId="child-1" />);
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
  });

  it('navigates to next page when Next is clicked', () => {
    mockedUseMoodLogs.mockReturnValue({
      data: {
        data: [{ id: 'm1', mood_score: 4, note: null, recorded_at: '2026-08-29T10:00:00Z' }],
        meta: { page: 1, limit: 20, total: 45, total_pages: 3 },
      },
      isLoading: false,
    });
    render(<MoodTrackingSection childId="child-1" />);
    fireEvent.click(screen.getByText('Next'));
    expect(mockedUseMoodLogs).toHaveBeenLastCalledWith('child-1', 2, 20);
  });
});

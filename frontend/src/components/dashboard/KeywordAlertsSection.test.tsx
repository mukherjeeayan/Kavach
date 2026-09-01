import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import KeywordAlertsSection from './KeywordAlertsSection';

vi.mock('../../hooks/useCommunications', () => ({
  useKeywordAlerts: vi.fn(),
  useReviewKeywordAlert: vi.fn(),
}));

vi.mock('../ui/Skeleton', () => ({
  SkeletonList: ({ items }: { items: number }) => (
    <div aria-hidden="true" data-testid="skeleton-list" data-items={items} />
  ),
}));

import { useKeywordAlerts, useReviewKeywordAlert } from '../../hooks/useCommunications';

const mockedUseKeywordAlerts = useKeywordAlerts as ReturnType<typeof vi.fn>;
const mockedUseReviewKeywordAlert = useReviewKeywordAlert as ReturnType<typeof vi.fn>;

const buildAlert = (overrides: Record<string, unknown>) => ({
  id: 'a1',
  device_id: 'dev-1',
  child_id: 'child-1',
  source_type: 'SMS' as const,
  detected_keywords: ['bully', 'threat'],
  severity: 'HIGH' as const,
  content_snippet: 'I will bully you',
  app_package: null,
  is_reviewed: false,
  reviewed_at: null,
  created_at: '2026-08-29T10:00:00Z',
  ...overrides,
});

describe('KeywordAlertsSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseReviewKeywordAlert.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue(undefined),
      isPending: false,
    });
  });

  it('shows loading skeleton while fetching', () => {
    mockedUseKeywordAlerts.mockReturnValue({ data: undefined, isLoading: true });
    const { container } = render(
      <KeywordAlertsSection childId="child-1" onError={vi.fn()} />
    );
    expect(screen.getByTestId('skeleton-list')).toBeInTheDocument();
    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
  });

  it('shows empty state when there are no alerts', () => {
    mockedUseKeywordAlerts.mockReturnValue({ data: [], isLoading: false });
    render(<KeywordAlertsSection childId="child-1" onError={vi.fn()} />);
    expect(screen.getByText(/no keyword alerts detected/i)).toBeInTheDocument();
  });

  it('renders unreviewed alerts with severity and keywords', () => {
    mockedUseKeywordAlerts.mockReturnValue({
      data: [buildAlert({ id: 'a1', severity: 'HIGH', detected_keywords: ['bully'] })],
      isLoading: false,
    });
    render(<KeywordAlertsSection childId="child-1" onError={vi.fn()} />);
    expect(screen.getByText('Keyword Alerts')).toBeInTheDocument();
    expect(screen.getByText('1 unreviewed alert')).toBeInTheDocument();
    expect(screen.getByText('HIGH')).toBeInTheDocument();
    expect(screen.getByText('bully')).toBeInTheDocument();
    expect(screen.getByText(/needs review/i)).toBeInTheDocument();
  });

  it('shows content snippet for unreviewed alerts', () => {
    mockedUseKeywordAlerts.mockReturnValue({
      data: [buildAlert({ content_snippet: 'worried about exam results' })],
      isLoading: false,
    });
    render(<KeywordAlertsSection childId="child-1" onError={vi.fn()} />);
    expect(screen.getByText(/worried about exam results/)).toBeInTheDocument();
  });

  it('shows reviewed alerts in the Reviewed section', () => {
    mockedUseKeywordAlerts.mockReturnValue({
      data: [
        buildAlert({ id: 'a1', is_reviewed: false, severity: 'HIGH', detected_keywords: ['bully'] }),
        buildAlert({ id: 'a2', is_reviewed: true, severity: 'LOW', detected_keywords: ['homework'] }),
      ],
      isLoading: false,
    });
    render(<KeywordAlertsSection childId="child-1" onError={vi.fn()} />);
    expect(screen.getByText('Reviewed')).toBeInTheDocument();
    expect(screen.getByText('homework')).toBeInTheDocument();
  });

  it('calls mutateAsync with alert id when Mark Reviewed is clicked', () => {
    const mockMutateAsync = vi.fn().mockResolvedValue(undefined);
    mockedUseReviewKeywordAlert.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    });
    mockedUseKeywordAlerts.mockReturnValue({
      data: [buildAlert({ id: 'a1', is_reviewed: false })],
      isLoading: false,
    });
    render(<KeywordAlertsSection childId="child-1" onError={vi.fn()} />);
    fireEvent.click(screen.getByText('Mark Reviewed'));
    expect(mockMutateAsync).toHaveBeenCalledWith('a1');
  });

  it('calls onError when review fails', async () => {
    const onError = vi.fn();
    const mockMutateAsync = vi.fn().mockRejectedValue(new Error('fail'));
    mockedUseReviewKeywordAlert.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    });
    mockedUseKeywordAlerts.mockReturnValue({
      data: [buildAlert({ id: 'a1', is_reviewed: false })],
      isLoading: false,
    });
    render(<KeywordAlertsSection childId="child-1" onError={onError} />);
    fireEvent.click(screen.getByText('Mark Reviewed'));
    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith('Failed to mark alert as reviewed');
    });
  });

  it('disables Mark Reviewed button when mutation is pending', () => {
    mockedUseReviewKeywordAlert.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: true,
    });
    mockedUseKeywordAlerts.mockReturnValue({
      data: [buildAlert({ id: 'a1', is_reviewed: false })],
      isLoading: false,
    });
    render(<KeywordAlertsSection childId="child-1" onError={vi.fn()} />);
    expect(screen.getByText('Mark Reviewed')).toBeDisabled();
  });
});

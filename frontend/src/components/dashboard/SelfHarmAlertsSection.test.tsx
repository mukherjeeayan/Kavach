import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SelfHarmAlertsSection from './SelfHarmAlertsSection';

vi.mock('../../hooks/useSelfHarmAlerts', () => ({
  useSelfHarmAlerts: vi.fn(),
  useAcknowledgeSelfHarmAlert: vi.fn(),
}));

import { useSelfHarmAlerts, useAcknowledgeSelfHarmAlert } from '../../hooks/useSelfHarmAlerts';

const mockedUseSelfHarmAlerts = useSelfHarmAlerts as ReturnType<typeof vi.fn>;
const mockedUseAcknowledgeSelfHarmAlert = useAcknowledgeSelfHarmAlert as ReturnType<typeof vi.fn>;

describe('SelfHarmAlertsSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseAcknowledgeSelfHarmAlert.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    });
  });

  it('shows empty state', () => {
    mockedUseSelfHarmAlerts.mockReturnValue({ data: [], isLoading: false });
    render(<SelfHarmAlertsSection childId="child-1" onError={vi.fn()} />);
    expect(screen.getByText(/no self-harm alerts detected/i)).toBeInTheDocument();
  });

  it('shows loading state', () => {
    mockedUseSelfHarmAlerts.mockReturnValue({ data: undefined, isLoading: true });
    const { container } = render(<SelfHarmAlertsSection childId="child-1" onError={vi.fn()} />);
    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
  });

  it('renders alert entries', () => {
    mockedUseSelfHarmAlerts.mockReturnValue({
      data: [
        {
          id: 'a1',
          risk_level: 'HIGH',
          source_type: 'SMS',
          content_snippet: 'worried about my grades',
          detected_keywords: ['worried', 'grades'],
          is_acknowledged: false,
          created_at: '2026-08-21T10:00:00.000Z',
        },
        {
          id: 'a2',
          risk_level: 'MEDIUM',
          source_type: 'APP_TEXT',
          content_snippet: 'feeling down',
          detected_keywords: ['feeling'],
          is_acknowledged: true,
          created_at: '2026-08-20T08:00:00.000Z',
        },
      ],
      isLoading: false,
    });
    render(<SelfHarmAlertsSection childId="child-1" onError={vi.fn()} />);
    expect(screen.getByText('HIGH')).toBeInTheDocument();
    expect(screen.getByText('MEDIUM')).toBeInTheDocument();
    expect(screen.getByText('SMS')).toBeInTheDocument();
    expect(screen.getByText('App Text')).toBeInTheDocument();
    expect(screen.getByText(/worried about my grades/)).toBeInTheDocument();
    expect(screen.getByText(/feeling down/)).toBeInTheDocument();
    expect(screen.getByText('worried')).toBeInTheDocument();
    expect(screen.getByText('grades')).toBeInTheDocument();
    expect(screen.getByText('Needs Attention')).toBeInTheDocument();
    expect(screen.getAllByText('Acknowledged').length).toBeGreaterThanOrEqual(1);
  });

  it('handles acknowledge action', () => {
    const mockMutateAsync = vi.fn().mockResolvedValue(undefined);
    mockedUseAcknowledgeSelfHarmAlert.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    });
    mockedUseSelfHarmAlerts.mockReturnValue({
      data: [
        {
          id: 'a1',
          risk_level: 'HIGH',
          source_type: 'SMS',
          content_snippet: 'test',
          detected_keywords: [],
          is_acknowledged: false,
          created_at: '2026-08-21T10:00:00.000Z',
        },
      ],
      isLoading: false,
    });
    render(<SelfHarmAlertsSection childId="child-1" onError={vi.fn()} />);
    fireEvent.click(screen.getByText('Acknowledge'));
    expect(mockMutateAsync).toHaveBeenCalledWith('a1');
  });
});

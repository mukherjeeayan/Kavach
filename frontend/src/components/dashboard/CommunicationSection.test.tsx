import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CommunicationSection from './CommunicationSection';

vi.mock('../../hooks/useCommunications', () => ({
  useCommunicationLogs: vi.fn(),
}));

import { useCommunicationLogs } from '../../hooks/useCommunications';

const mockedUseCommunicationLogs = useCommunicationLogs as ReturnType<typeof vi.fn>;

describe('CommunicationSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders communication log entries', () => {
    mockedUseCommunicationLogs.mockReturnValue({
      data: {
        data: [
          { id: 'l1', comm_type: 'SMS_IN', contact_name: 'Mom', contact_number: '+91 99999 11111', content_snippet: 'Hello', duration_seconds: null, is_flagged: false, recorded_at: '2026-08-29T10:00:00Z' },
        ],
        meta: { page: 1, total_pages: 1, total: 1 },
      },
      isLoading: false,
    });
    render(<CommunicationSection childId="child-1" />);
    expect(screen.getByText('Communication Logs')).toBeInTheDocument();
    expect(screen.getByText('Mom')).toBeInTheDocument();
    expect(screen.getByText('SMS Received')).toBeInTheDocument();
  });

  it('shows empty state when there are no logs', () => {
    mockedUseCommunicationLogs.mockReturnValue({
      data: { data: [], meta: { page: 1, total_pages: 1, total: 0 } },
      isLoading: false,
    });
    render(<CommunicationSection childId="child-1" />);
    expect(screen.getByText(/no communication logs recorded yet/i)).toBeInTheDocument();
  });

  it('toggles flagged filter when button is clicked', () => {
    mockedUseCommunicationLogs.mockReturnValue({
      data: { data: [], meta: { page: 1, total_pages: 1, total: 0 } },
      isLoading: false,
    });
    render(<CommunicationSection childId="child-1" />);
    const toggle = screen.getByRole('button', { name: /show flagged only/i });
    fireEvent.click(toggle);
    expect(mockedUseCommunicationLogs).toHaveBeenCalledWith('child-1', true, 1);
  });

  it('renders pagination when more than one page', () => {
    mockedUseCommunicationLogs.mockReturnValue({
      data: {
        data: [
          { id: 'l1', comm_type: 'SMS_IN', contact_name: 'A', contact_number: null, content_snippet: null, duration_seconds: null, is_flagged: false, recorded_at: '2026-08-29T10:00:00Z' },
        ],
        meta: { page: 1, total_pages: 3, total: 30 },
      },
      isLoading: false,
    });
    render(<CommunicationSection childId="child-1" />);
    expect(screen.getByText(/page 1 of 3/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /prev/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /next/i })).not.toBeDisabled();
  });

  it('shows loading skeleton while fetching', () => {
    mockedUseCommunicationLogs.mockReturnValue({ data: undefined, isLoading: true });
    const { container } = render(<CommunicationSection childId="child-1" />);
    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
  });

  it('navigates to next page when next is clicked', () => {
    mockedUseCommunicationLogs.mockReturnValue({
      data: {
        data: [
          { id: 'l1', comm_type: 'SMS_IN', contact_name: 'A', contact_number: null, content_snippet: null, duration_seconds: null, is_flagged: false, recorded_at: '2026-08-29T10:00:00Z' },
        ],
        meta: { page: 1, total_pages: 3, total: 30 },
      },
      isLoading: false,
    });
    render(<CommunicationSection childId="child-1" />);
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(mockedUseCommunicationLogs).toHaveBeenCalledWith('child-1', false, 2);
  });
});

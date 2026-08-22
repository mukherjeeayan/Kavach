import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import LocksSection from './LocksSection';

vi.mock('../../hooks/usePhase1Data', () => ({
  useLocks: vi.fn(),
  useLockActions: vi.fn(),
  useActionsError: vi.fn(),
}));

import { useLocks, useLockActions } from '../../hooks/usePhase1Data';

const mockedUseLocks = useLocks as ReturnType<typeof vi.fn>;
const mockedUseLockActions = useLockActions as ReturnType<typeof vi.fn>;

describe('LocksSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseLockActions.mockReturnValue({
      create: { mutate: vi.fn(), isPending: false },
      update: { mutate: vi.fn(), isPending: false },
      remove: { mutate: vi.fn(), isPending: false },
    });
  });

  it('shows empty state', () => {
    mockedUseLocks.mockReturnValue({ data: [], isLoading: false });
    render(<LocksSection childId="child-1" onError={vi.fn()} />);
    expect(screen.getByText(/no lock windows yet/i)).toBeInTheDocument();
  });

  it('shows loading state', () => {
    mockedUseLocks.mockReturnValue({ data: undefined, isLoading: true });
    render(<LocksSection childId="child-1" onError={vi.fn()} />);
    expect(screen.getByText('Scheduled Locks')).toBeInTheDocument();
  });

  it('renders lock entries', () => {
    mockedUseLocks.mockReturnValue({
      data: [
        { id: 'l1', day_of_week: 1, start_time: '21:00', end_time: '06:00', is_active: true },
        { id: 'l2', day_of_week: null, start_time: '22:00', end_time: '07:00', is_active: false },
      ],
      isLoading: false,
    });
    render(<LocksSection childId="child-1" onError={vi.fn()} />);
    expect(screen.getByText(/21:00.*06:00/)).toBeInTheDocument();
    expect(screen.getByText(/Monday/)).toBeInTheDocument();
    expect(screen.getByText(/22:00.*07:00/)).toBeInTheDocument();
    expect(screen.getByText(/Every day/)).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Disabled')).toBeInTheDocument();
  });

  it('shows add form when + Add lock is clicked', () => {
    mockedUseLocks.mockReturnValue({ data: [], isLoading: false });
    render(<LocksSection childId="child-1" onError={vi.fn()} />);
    fireEvent.click(screen.getByText('+ Add lock'));
    expect(screen.getByText('New lock window')).toBeInTheDocument();
    expect(screen.getByText('Save lock')).toBeInTheDocument();
  });
});

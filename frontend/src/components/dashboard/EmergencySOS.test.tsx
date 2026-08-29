import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EmergencySOS from './EmergencySOS';
import type { SosEvent } from '../../types/api';

const { mockedUseSosEvents, mockedUseAcknowledgeSos, mockedUseResolveSos, mockMutateAsync } = vi.hoisted(() => ({
  mockedUseSosEvents: vi.fn(),
  mockedUseAcknowledgeSos: vi.fn(),
  mockedUseResolveSos: vi.fn(),
  mockMutateAsync: vi.fn(),
}));

vi.mock('../../hooks/useSos', () => ({
  useSosEvents: (...args: unknown[]) => mockedUseSosEvents(...args),
  useAcknowledgeSos: (...args: unknown[]) => mockedUseAcknowledgeSos(...args),
  useResolveSos: (...args: unknown[]) => mockedUseResolveSos(...args),
}));

const makeEvent = (overrides: Partial<SosEvent> = {}): SosEvent => ({
  id: 'evt-1',
  device_id: 'dev-1',
  child_id: 'child-1',
  latitude: 13.0827,
  longitude: 80.2707,
  battery_level: 85,
  trigger_method: 'BUTTON',
  status: 'ACTIVE',
  acknowledged_at: null,
  resolved_at: null,
  notes: null,
  created_at: '2026-08-20T10:00:00Z',
  ...overrides,
});

const paginated = (events: SosEvent[], totalPages = 1) => ({
  data: { data: events, meta: { page: 1, limit: 10, total: events.length, total_pages: totalPages } },
  isLoading: false,
});

describe('EmergencySOS', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMutateAsync.mockResolvedValue(undefined);
    mockedUseAcknowledgeSos.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    mockedUseResolveSos.mockReturnValue({ mutateAsync: mockMutateAsync, isPending: false });
  });

  it('shows confirmation dialog when Resolve is clicked', () => {
    mockedUseSosEvents.mockReturnValue(paginated([makeEvent()]));
    render(<EmergencySOS childId="child-1" onError={vi.fn()} />);
    fireEvent.click(screen.getByText('Resolve'));
    expect(
      screen.getByText('Are you sure you want to resolve this SOS event? This action cannot be undone.')
    ).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('does not call resolve mutation until confirmation', () => {
    mockedUseSosEvents.mockReturnValue(paginated([makeEvent()]));
    render(<EmergencySOS childId="child-1" onError={vi.fn()} />);
    fireEvent.click(screen.getByText('Resolve'));
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it('calls resolve mutation only after confirming in the dialog', async () => {
    mockedUseSosEvents.mockReturnValue(paginated([makeEvent()]));
    render(<EmergencySOS childId="child-1" onError={vi.fn()} />);

    fireEvent.click(screen.getByText('Resolve'));
    const dialogConfirm = screen.getAllByRole('button', { name: 'Resolve' })
      .find((b) => b.className.includes('bg-red-600'))!;
    fireEvent.click(dialogConfirm);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({ eventId: 'evt-1' });
    });
  });

  it('cancels without calling resolve when Cancel is clicked', () => {
    mockedUseSosEvents.mockReturnValue(paginated([makeEvent()]));
    render(<EmergencySOS childId="child-1" onError={vi.fn()} />);

    fireEvent.click(screen.getByText('Resolve'));
    fireEvent.click(screen.getByText('Cancel'));

    expect(mockMutateAsync).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('uses danger variant (red) styling on the confirm button', () => {
    mockedUseSosEvents.mockReturnValue(paginated([makeEvent()]));
    render(<EmergencySOS childId="child-1" onError={vi.fn()} />);
    fireEvent.click(screen.getByText('Resolve'));
    const confirmBtns = screen.getAllByRole('button', { name: 'Resolve' });
    const dialogConfirm = confirmBtns.find((b) => b.className.includes('bg-red-600'))!;
    expect(dialogConfirm).toBeDefined();
  });
});

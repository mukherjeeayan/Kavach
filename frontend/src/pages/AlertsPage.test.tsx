import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AlertsPage from './AlertsPage';
import type { ChildAlert } from '../types/api';

const mockMutateAsync = vi.fn();

vi.mock('../hooks/useChildrenData', () => ({
  useChildren: vi.fn(),
}));

vi.mock('../hooks/usePhase1Data', () => ({
  useChildAlerts: vi.fn(),
  useAcknowledgeAlert: () => ({
    mutateAsync: (...args: unknown[]) => mockMutateAsync(...args),
    isPending: false,
  }),
}));

vi.mock('../components/ui/Skeleton', () => ({
  SkeletonList: ({ items }: { items: number }) => (
    <div data-testid="skeleton-list" data-items={items} />
  ),
}));

vi.mock('../components/ui/Toast', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  default: ({ message, type }: any) => (
    <div role="alert" data-toast-type={type}>{message}</div>
  ),
}));

const mockUseChildren = vi.mocked(
  (await import('../hooks/useChildrenData')).useChildren
);
const mockUseChildAlerts = vi.mocked(
  (await import('../hooks/usePhase1Data')).useChildAlerts
);

function makeAlert(overrides: Partial<ChildAlert> = {}): ChildAlert {
  return {
    id: 'alert-1',
    action: 'TAMPER_ALERT',
    resource_type: 'audit_log',
    details: {},
    created_at: '2025-01-15T10:00:00Z',
    acknowledged_at: null,
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <AlertsPage />
    </MemoryRouter>
  );
}

describe('AlertsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders page heading', () => {
    mockUseChildren.mockReturnValue({
      data: [{ id: 'child-1', name: 'Test Child' }],
      isLoading: false,
    } as ReturnType<typeof mockUseChildren>);

    mockUseChildAlerts.mockReturnValue({
      data: { data: [], meta: { page: 1, limit: 20, total: 0, total_pages: 1 } },
      isLoading: false,
    } as unknown as ReturnType<typeof mockUseChildAlerts>);

    renderPage();

    expect(screen.getByText('Alerts')).toBeInTheDocument();
  });

  it('shows empty state when no alerts', () => {
    mockUseChildren.mockReturnValue({
      data: [{ id: 'child-1', name: 'Test Child' }],
      isLoading: false,
    } as ReturnType<typeof mockUseChildren>);

    mockUseChildAlerts.mockReturnValue({
      data: { data: [], meta: { page: 1, limit: 20, total: 0, total_pages: 1 } },
      isLoading: false,
    } as unknown as ReturnType<typeof mockUseChildAlerts>);

    renderPage();

    expect(screen.getByText(/no alerts recorded yet/i)).toBeInTheDocument();
  });

  it('shows loading state', () => {
    mockUseChildren.mockReturnValue({
      data: [{ id: 'child-1', name: 'Test Child' }],
      isLoading: false,
    } as ReturnType<typeof mockUseChildren>);

    mockUseChildAlerts.mockReturnValue({
      data: undefined,
      isLoading: true,
    } as unknown as ReturnType<typeof mockUseChildAlerts>);

    renderPage();

    expect(screen.getByTestId('skeleton-list')).toBeInTheDocument();
  });

  it('displays alert items when data exists', () => {
    mockUseChildren.mockReturnValue({
      data: [{ id: 'child-1', name: 'Test Child' }],
      isLoading: false,
    } as ReturnType<typeof mockUseChildren>);

    mockUseChildAlerts.mockReturnValue({
      data: {
        data: [
          makeAlert({ id: 'a1', action: 'TAMPER_ALERT' }),
          makeAlert({ id: 'a2', action: 'SOS_TRIGGERED' }),
        ],
        meta: { page: 1, limit: 20, total: 2, total_pages: 1 },
      },
      isLoading: false,
    } as ReturnType<typeof mockUseChildAlerts>);

    renderPage();

    expect(screen.getByText('Tamper Alert')).toBeInTheDocument();
    expect(screen.getByText('SOS Triggered')).toBeInTheDocument();
  });

  it('shows acknowledge button for unacknowledged alerts', () => {
    mockUseChildren.mockReturnValue({
      data: [{ id: 'child-1', name: 'Test Child' }],
      isLoading: false,
    } as ReturnType<typeof mockUseChildren>);

    mockUseChildAlerts.mockReturnValue({
      data: {
        data: [
          makeAlert({ id: 'a1', acknowledged_at: null }),
        ],
        meta: { page: 1, limit: 20, total: 1, total_pages: 1 },
      },
      isLoading: false,
    } as ReturnType<typeof mockUseChildAlerts>);

    renderPage();

    expect(screen.getByText('Mark Read')).toBeInTheDocument();
  });

  it('hides acknowledge button for acknowledged alerts', () => {
    mockUseChildren.mockReturnValue({
      data: [{ id: 'child-1', name: 'Test Child' }],
      isLoading: false,
    } as ReturnType<typeof mockUseChildren>);

    mockUseChildAlerts.mockReturnValue({
      data: {
        data: [
          makeAlert({ id: 'a1', acknowledged_at: '2025-01-15T11:00:00Z' }),
        ],
        meta: { page: 1, limit: 20, total: 1, total_pages: 1 },
      },
      isLoading: false,
    } as ReturnType<typeof mockUseChildAlerts>);

    renderPage();

    expect(screen.queryByText('Mark Read')).not.toBeInTheDocument();
  });

  it('calls acknowledge when Mark Read is clicked', async () => {
    mockMutateAsync.mockResolvedValueOnce({});

    mockUseChildren.mockReturnValue({
      data: [{ id: 'child-1', name: 'Test Child' }],
      isLoading: false,
    } as ReturnType<typeof mockUseChildren>);

    mockUseChildAlerts.mockReturnValue({
      data: {
        data: [
          makeAlert({ id: 'a1', acknowledged_at: null }),
        ],
        meta: { page: 1, limit: 20, total: 1, total_pages: 1 },
      },
      isLoading: false,
    } as ReturnType<typeof mockUseChildAlerts>);

    renderPage();

    fireEvent.click(screen.getByText('Mark Read'));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith('a1');
    });
  });

  it('shows error toast when acknowledge fails', async () => {
    mockMutateAsync.mockRejectedValueOnce(new Error('fail'));

    mockUseChildren.mockReturnValue({
      data: [{ id: 'child-1', name: 'Test Child' }],
      isLoading: false,
    } as ReturnType<typeof mockUseChildren>);

    mockUseChildAlerts.mockReturnValue({
      data: {
        data: [
          makeAlert({ id: 'a1', acknowledged_at: null }),
        ],
        meta: { page: 1, limit: 20, total: 1, total_pages: 1 },
      },
      isLoading: false,
    } as ReturnType<typeof mockUseChildAlerts>);

    renderPage();

    fireEvent.click(screen.getByText('Mark Read'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Failed to mark alert as read');
    });
  });

  it('shows empty state when no children found', () => {
    mockUseChildren.mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof mockUseChildren>);

    renderPage();

    expect(screen.getByText(/no children found/i)).toBeInTheDocument();
  });

  it('shows children loading state', () => {
    mockUseChildren.mockReturnValue({
      data: undefined,
      isLoading: true,
    } as unknown as ReturnType<typeof mockUseChildren>);

    renderPage();

    expect(screen.getByTestId('skeleton-list')).toBeInTheDocument();
  });
});

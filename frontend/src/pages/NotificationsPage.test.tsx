import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import NotificationsPage from './NotificationsPage';
import type { Notification } from '../types/api';

const mockMutateAsync = vi.fn();
const mockMutateAllAsync = vi.fn();

vi.mock('../hooks/useNotifications', () => ({
  useNotifications: vi.fn(),
  useMarkNotificationRead: () => ({
    mutateAsync: (...args: unknown[]) => mockMutateAsync(...args),
    isPending: false,
  }),
  useMarkAllNotificationsRead: () => ({
    mutateAsync: (...args: unknown[]) => mockMutateAllAsync(...args),
    isPending: false,
  }),
}));

vi.mock('../components/ui/Skeleton', () => ({
  SkeletonList: () => <div data-testid="skeleton-list" />,
}));

vi.mock('../components/ui/Toast', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  default: ({ message }: any) => <div role="alert">{message}</div>,
}));

const mockUseNotifications = vi.mocked(
  (await import('../hooks/useNotifications')).useNotifications
);

function makeNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: '1',
    user_id: 'u1',
    title: 'Test Notification',
    body: 'Some body text',
    notification_type: 'ALERT',
    reference_id: null,
    is_read: false,
    created_at: '2025-01-15T10:00:00Z',
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <NotificationsPage />
    </MemoryRouter>
  );
}

describe('NotificationsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders notification list', () => {
    mockUseNotifications.mockReturnValue({
      data: [
        makeNotification({ id: '1', title: 'SOS Alert' }),
        makeNotification({ id: '2', title: 'Geofence Alert', is_read: true }),
      ],
      isLoading: false,
    } as ReturnType<typeof mockUseNotifications>);

    renderPage();

    expect(screen.getByText('Notifications')).toBeInTheDocument();
    expect(screen.getByText('SOS Alert')).toBeInTheDocument();
    expect(screen.getByText('Geofence Alert')).toBeInTheDocument();
  });

  it('handles empty state', () => {
    mockUseNotifications.mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof mockUseNotifications>);

    renderPage();

    expect(screen.getByText(/no notifications yet/i)).toBeInTheDocument();
  });

  it('handles loading state', () => {
    mockUseNotifications.mockReturnValue({
      data: undefined,
      isLoading: true,
    } as unknown as ReturnType<typeof mockUseNotifications>);

    renderPage();

    expect(screen.getByTestId('skeleton-list')).toBeInTheDocument();
  });

  it('shows "Mark All Read" button when there are unread notifications', () => {
    mockUseNotifications.mockReturnValue({
      data: [makeNotification({ is_read: false })],
      isLoading: false,
    } as ReturnType<typeof mockUseNotifications>);

    renderPage();

    expect(screen.getByText('Mark All Read')).toBeInTheDocument();
  });

  it('hides "Mark All Read" button when all notifications are read', () => {
    mockUseNotifications.mockReturnValue({
      data: [makeNotification({ is_read: true })],
      isLoading: false,
    } as ReturnType<typeof mockUseNotifications>);

    renderPage();

    expect(screen.queryByText('Mark All Read')).not.toBeInTheDocument();
  });

  it('shows unread count', () => {
    mockUseNotifications.mockReturnValue({
      data: [
        makeNotification({ id: '1', is_read: false }),
        makeNotification({ id: '2', is_read: false }),
        makeNotification({ id: '3', is_read: true }),
      ],
      isLoading: false,
    } as ReturnType<typeof mockUseNotifications>);

    renderPage();

    expect(screen.getByText(/new \(2\)/i)).toBeInTheDocument();
  });

  it('calls markRead when "Mark read" button is clicked', async () => {
    mockMutateAsync.mockResolvedValueOnce({});
    mockUseNotifications.mockReturnValue({
      data: [makeNotification({ id: 'abc', is_read: false })],
      isLoading: false,
    } as ReturnType<typeof mockUseNotifications>);

    renderPage();

    fireEvent.click(screen.getByText('Mark read'));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith('abc');
    });
  });

  it('shows error toast when markRead fails', async () => {
    mockMutateAsync.mockRejectedValueOnce(new Error('fail'));
    mockUseNotifications.mockReturnValue({
      data: [makeNotification({ id: 'abc', is_read: false })],
      isLoading: false,
    } as ReturnType<typeof mockUseNotifications>);

    renderPage();

    fireEvent.click(screen.getByText('Mark read'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Failed to mark notification as read');
    });
  });

  it('calls markAllRead when "Mark All Read" is clicked', async () => {
    mockMutateAllAsync.mockResolvedValueOnce({});
    mockUseNotifications.mockReturnValue({
      data: [makeNotification({ is_read: false })],
      isLoading: false,
    } as ReturnType<typeof mockUseNotifications>);

    renderPage();

    fireEvent.click(screen.getByText('Mark All Read'));

    await waitFor(() => {
      expect(mockMutateAllAsync).toHaveBeenCalled();
    });
  });
});

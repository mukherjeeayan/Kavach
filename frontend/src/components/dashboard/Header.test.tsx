import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Header from './Header';
import type { AuthUser, Notification } from '../../types/api';

const { mockedUseNotifications } = vi.hoisted(() => ({
  mockedUseNotifications: vi.fn(),
}));

vi.mock('../../hooks/useNotifications', () => ({
  useNotifications: (...args: unknown[]) => mockedUseNotifications(...args),
}));

const user: AuthUser = {
  id: 'u1',
  email: 'p@example.com',
  name: 'Parent',
};

const makeNotification = (overrides: Partial<Notification> = {}): Notification => ({
  id: 'n1',
  user_id: 'u1',
  title: 'Test',
  body: 'body',
  notification_type: 'ALERT',
  reference_id: null,
  is_read: false,
  created_at: '2026-08-20T10:00:00Z',
  ...overrides,
});

function renderHeader() {
  return render(
    <MemoryRouter>
      <Header user={user} onLogout={vi.fn()} />
    </MemoryRouter>
  );
}

describe('Header notification badge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not show badge when there are no unread notifications', () => {
    mockedUseNotifications.mockReturnValue({ data: [] });
    renderHeader();
    expect(screen.queryByTestId('notification-badge')).not.toBeInTheDocument();
  });

  it('shows badge with unread count when there are unread notifications', () => {
    mockedUseNotifications.mockReturnValue({
      data: [
        makeNotification({ id: '1', is_read: false }),
        makeNotification({ id: '2', is_read: false }),
        makeNotification({ id: '3', is_read: true }),
      ],
    });
    renderHeader();
    const badge = screen.getByTestId('notification-badge');
    expect(badge).toBeInTheDocument();
    expect(badge.textContent).toBe('2');
  });

  it('does not count read notifications towards the badge', () => {
    mockedUseNotifications.mockReturnValue({
      data: [
        makeNotification({ id: '1', is_read: true }),
        makeNotification({ id: '2', is_read: true }),
      ],
    });
    renderHeader();
    expect(screen.queryByTestId('notification-badge')).not.toBeInTheDocument();
  });

  it('shows 99+ when unread count exceeds 99', () => {
    mockedUseNotifications.mockReturnValue({
      data: Array.from({ length: 150 }, (_, i) => makeNotification({ id: `n${i}`, is_read: false })),
    });
    renderHeader();
    const badge = screen.getByTestId('notification-badge');
    expect(badge.textContent).toBe('99+');
  });
});

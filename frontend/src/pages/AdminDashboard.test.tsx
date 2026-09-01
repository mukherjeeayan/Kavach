import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminDashboard from './AdminDashboard';

const mocks = vi.hoisted(() => ({
  useIsAdmin: vi.fn(),
  useQuery: vi.fn(),
  useMutation: vi.fn(),
  useQueryClient: vi.fn(),
  useNavigate: vi.fn(),
  handleLogout: vi.fn(),
}));

vi.mock('../store/authSlice', () => ({
  useIsAdmin: (...args: unknown[]) => mocks.useIsAdmin(...args),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mocks.useQuery(...args),
  useMutation: (...args: unknown[]) => mocks.useMutation(...args),
  useQueryClient: (...args: unknown[]) => mocks.useQueryClient(...args),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mocks.useNavigate,
  };
});

vi.mock('../hooks/useAuth', () => ({
  useLogout: () => ({ handleLogout: mocks.handleLogout }),
}));

vi.mock('../services/api', () => ({
  fetchAdminStats: vi.fn(),
  fetchAdminUsers: vi.fn(),
  updateAdminUserSubscription: vi.fn(),
  updateAdminUserRole: vi.fn(),
  fetchAdminFeatureFlags: vi.fn(),
  updateAdminFeatureFlag: vi.fn(),
}));

const fullStatsData = {
  total_users: 100,
  free_users: 40,
  active_trial_users: 20,
  expired_trial_users: 10,
  premium_users: 25,
  admin_users: 5,
  new_users_7d: 15,
  new_users_30d: 50,
};

function renderDashboard() {
  return render(
    <MemoryRouter>
      <AdminDashboard />
    </MemoryRouter>
  );
}

describe('AdminDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useQueryClient.mockReturnValue({ invalidateQueries: vi.fn() });
    mocks.useMutation.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
  });

  it('redirects non-admin users', () => {
    mocks.useIsAdmin.mockReturnValue(false);
    mocks.useQuery.mockReturnValue({ data: null, isLoading: false });
    renderDashboard();
    expect(mocks.useNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });
  });

  it('renders admin dashboard for admin users', () => {
    mocks.useIsAdmin.mockReturnValue(true);
    mocks.useQuery.mockReturnValue({
      data: fullStatsData,
      isLoading: false,
    });
    renderDashboard();
    expect(screen.getByText('Admin Dashboard')).toBeInTheDocument();
  });

  it('shows stats tab by default', () => {
    mocks.useIsAdmin.mockReturnValue(true);
    mocks.useQuery.mockReturnValue({
      data: fullStatsData,
      isLoading: false,
    });
    renderDashboard();
    expect(screen.getByText('Total Users')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
  });

  it('shows loading skeletons', () => {
    mocks.useIsAdmin.mockReturnValue(true);
    mocks.useQuery.mockReturnValue({ data: null, isLoading: true });
    renderDashboard();
    expect(document.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });
});

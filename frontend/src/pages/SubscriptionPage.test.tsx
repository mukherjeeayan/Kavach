import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SubscriptionPage from './SubscriptionPage';

const mocks = vi.hoisted(() => ({
  useSubscriptionTier: vi.fn(),
  useAuth: vi.fn(),
  useQuery: vi.fn(),
  createRazorpayOrder: vi.fn(),
}));

vi.mock('../store/authSlice', () => ({
  useSubscriptionTier: (...args: unknown[]) => mocks.useSubscriptionTier(...args),
  useAuth: (...args: unknown[]) => mocks.useAuth(...args),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mocks.useQuery(...args),
}));

vi.mock('../services/api', () => ({
  fetchSubscriptionPlans: vi.fn(),
  createRazorpayOrder: (...args: unknown[]) => mocks.createRazorpayOrder(...args),
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <SubscriptionPage />
    </MemoryRouter>
  );
}

describe('SubscriptionPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useAuth.mockReturnValue({ user: { id: 'u1', name: 'Test', email: 'test@example.com', role: 'parent' } });
    mocks.createRazorpayOrder.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
  });

  it('renders page title', () => {
    mocks.useSubscriptionTier.mockReturnValue('FREE');
    mocks.useQuery.mockReturnValue({ data: null, isLoading: false });
    renderPage();
    expect(screen.getByText('Subscription')).toBeInTheDocument();
  });

  it('shows current plan for FREE user', () => {
    mocks.useSubscriptionTier.mockReturnValue('FREE');
    mocks.useQuery.mockReturnValue({ data: null, isLoading: false });
    renderPage();
    expect(screen.getByText('Current Plan')).toBeInTheDocument();
    expect(screen.getByText('Free')).toBeInTheDocument();
  });

  it('shows current plan for PREMIUM user', () => {
    mocks.useSubscriptionTier.mockReturnValue('PREMIUM');
    mocks.useQuery.mockReturnValue({ data: null, isLoading: false });
    renderPage();
    expect(screen.getByText('Premium')).toBeInTheDocument();
  });

  it('shows plan cards when loaded', () => {
    mocks.useSubscriptionTier.mockReturnValue('FREE');
    mocks.useQuery.mockReturnValue({
      data: {
        premium: { plan_id: 'monthly', name: 'Monthly', amount: 299, currency: 'INR' },
      },
    });
    renderPage();
    expect(screen.getByText('Monthly')).toBeInTheDocument();
  });

  it('shows loading skeleton', () => {
    mocks.useSubscriptionTier.mockReturnValue('FREE');
    mocks.useQuery.mockReturnValue({ data: null, isLoading: true });
    renderPage();
    expect(document.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });
});

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import DashboardPage from './DashboardPage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import authReducer from '../store/authSlice';

vi.mock('../hooks/useChildrenData', () => ({
  useChildren: () => ({ data: [], isLoading: false, isError: false }),
  useCreateChild: () => ({ mutate: async () => {}, isPending: false, isError: false }),
  useDevices: () => ({ data: [], isLoading: false, isError: false }),
  useBlockedApps: () => ({ data: [], isLoading: false, isError: false }),
  useUnblockRequests: () => ({ data: [], isLoading: false, isError: false }),
  useInvalidateChildData: () => ({ invalidateQueries: () => {} }),
}));

vi.mock('../hooks/useDashboardActions', () => ({
  useBlockAppAction: () => ({ mutate: async () => {}, isPending: false, isError: false }),
  useRespondToUnblockRequest: () => ({ mutate: async () => {}, isPending: false, isError: false }),
}));

vi.mock('../hooks/usePhase1Data', () => ({
  useSetParentPin: () => ({ mutate: async () => {}, isPending: false, isError: false }),
  useVerifyParentPin: () => ({ mutate: async () => {}, isPending: false, isError: false }),
}));

vi.mock('../hooks/useRealtimeRules', () => ({
  useRealtimeRules: () => ({ isConnected: true }),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

function createTestStore() {
  return configureStore({ reducer: { auth: authReducer } });
}

function renderWithProviders(ui: ReactNode, store = createTestStore()) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <MemoryRouter>{ui}</MemoryRouter>
      </Provider>
    </QueryClientProvider>
  );
}

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders dashboard header with user name', () => {
    renderWithProviders(<DashboardPage />);
    expect(screen.getByText('Kavach')).toBeInTheDocument();
  });

  it('renders child selector', () => {
    renderWithProviders(<DashboardPage />);
    expect(screen.getByText('Children')).toBeInTheDocument();
  });

  it('renders page main content', () => {
    renderWithProviders(<DashboardPage />);
    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  it('shows loading state when no child selected', () => {
    renderWithProviders(<DashboardPage />);
    expect(screen.getByText(/No child profiles yet/)).toBeInTheDocument();
  });
});
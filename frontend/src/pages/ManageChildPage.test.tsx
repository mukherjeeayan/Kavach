import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import ManageChildPage from './ManageChildPage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../hooks/useChildrenData', () => ({
  useChildren: vi.fn(),
  useCreateChild: vi.fn(),
  useDevices: vi.fn(),
}));

vi.mock('../hooks/usePhase1Data', () => ({
  useChildAlerts: vi.fn(),
}));

vi.mock('../services/api', () => ({
  updateChild: vi.fn(),
  deleteChild: vi.fn(),
}));

import { useChildren, useCreateChild, useDevices } from '../hooks/useChildrenData';
import { useChildAlerts } from '../hooks/usePhase1Data';

const mockedUseChildren = useChildren as ReturnType<typeof vi.fn>;
const mockedUseCreateChild = useCreateChild as ReturnType<typeof vi.fn>;
const mockedUseDevices = useDevices as ReturnType<typeof vi.fn>;
const mockedUseChildAlerts = useChildAlerts as ReturnType<typeof vi.fn>;

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe('ManageChildPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseCreateChild.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    mockedUseDevices.mockReturnValue({ data: [], isLoading: false });
    mockedUseChildAlerts.mockReturnValue({ data: [], isLoading: false });
  });

  it('renders the child list with names', () => {
    mockedUseChildren.mockReturnValue({
      data: [
        { id: 'c1', name: 'Ayan', birth_date: '2010-01-15', daily_screen_time_limit_minutes: 120, created_at: '2025-01-01T00:00:00Z' },
        { id: 'c2', name: 'Riya', birth_date: null, daily_screen_time_limit_minutes: null, created_at: '2025-02-01T00:00:00Z' },
      ],
      isLoading: false,
    });
    render(<ManageChildPage />, { wrapper: createWrapper() });
    expect(screen.getByText('Manage Children')).toBeInTheDocument();
    expect(screen.getByText('Ayan')).toBeInTheDocument();
    expect(screen.getByText('Riya')).toBeInTheDocument();
    expect(screen.getByText(/Children \(2\)/)).toBeInTheDocument();
  });

  it('renders the Add Child button', () => {
    mockedUseChildren.mockReturnValue({ data: [], isLoading: false });
    render(<ManageChildPage />, { wrapper: createWrapper() });
    expect(screen.getByRole('button', { name: /\+ Add Child/i })).toBeInTheDocument();
  });

  it('shows loading skeleton when children are loading', () => {
    mockedUseChildren.mockReturnValue({ data: undefined, isLoading: true });
    const { container } = render(<ManageChildPage />, { wrapper: createWrapper() });
    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
  });

  it('shows empty state when no children exist', () => {
    mockedUseChildren.mockReturnValue({ data: [], isLoading: false });
    render(<ManageChildPage />, { wrapper: createWrapper() });
    expect(screen.getByText(/no children registered yet/i)).toBeInTheDocument();
  });

  it('shows "Select a child to view details" when children exist but none selected', () => {
    mockedUseChildren.mockReturnValue({
      data: [{ id: 'c1', name: 'Ayan', birth_date: null, daily_screen_time_limit_minutes: null, created_at: '2025-01-01T00:00:00Z' }],
      isLoading: false,
    });
    render(<ManageChildPage />, { wrapper: createWrapper() });
    expect(screen.getByText(/select a child to view details/i)).toBeInTheDocument();
  });
});

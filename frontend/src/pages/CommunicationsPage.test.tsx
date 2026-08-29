import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import CommunicationsPage from './CommunicationsPage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../hooks/useChildrenData', () => ({
  useChildren: vi.fn(),
}));

vi.mock('../components/dashboard/CommunicationSection', () => ({
  default: ({ childId }: { childId: string }) => (
    <div data-testid="communication-section">CommunicationSection for {childId}</div>
  ),
}));

import { useChildren } from '../hooks/useChildrenData';

const mockedUseChildren = useChildren as ReturnType<typeof vi.fn>;

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe('CommunicationsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders child selector when more than one child exists', () => {
    mockedUseChildren.mockReturnValue({
      data: [
        { id: 'c1', name: 'Child One' },
        { id: 'c2', name: 'Child Two' },
      ],
      isLoading: false,
    });
    render(<CommunicationsPage />, { wrapper: createWrapper() });
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('renders CommunicationSection when a child is available', () => {
    mockedUseChildren.mockReturnValue({ data: [{ id: 'child-1', name: 'Ayan' }], isLoading: false });
    render(<CommunicationsPage />, { wrapper: createWrapper() });
    expect(screen.getByTestId('communication-section')).toBeInTheDocument();
  });

  it('does not render child selector when there is only one child', () => {
    mockedUseChildren.mockReturnValue({ data: [{ id: 'child-1', name: 'Ayan' }], isLoading: false });
    render(<CommunicationsPage />, { wrapper: createWrapper() });
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('shows error / no-children state when no children exist', () => {
    mockedUseChildren.mockReturnValue({ data: [], isLoading: false });
    render(<CommunicationsPage />, { wrapper: createWrapper() });
    expect(screen.getByText(/no children found\. add a child first\./i)).toBeInTheDocument();
  });

  it('shows loading skeleton when children are loading', () => {
    mockedUseChildren.mockReturnValue({ data: undefined, isLoading: true });
    const { container } = render(<CommunicationsPage />, { wrapper: createWrapper() });
    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
  });
});

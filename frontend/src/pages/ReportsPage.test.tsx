import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import ReportsPage from './ReportsPage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../hooks/useChildrenData', () => ({
  useChildren: vi.fn(),
}));

vi.mock('../hooks/useAnalytics', () => ({
  useGenerateReport: vi.fn(),
  useLatestReport: vi.fn(),
  useReports: vi.fn(),
}));

vi.mock('../hooks/usePhase1Data', () => ({
  useScreenTimeSummary: vi.fn(),
  useCurrentLocations: vi.fn(),
}));

vi.mock('../hooks/useCommunications', () => ({
  useCommunicationLogs: vi.fn(),
}));

import { useChildren } from '../hooks/useChildrenData';
import { useGenerateReport, useLatestReport, useReports } from '../hooks/useAnalytics';
import { useScreenTimeSummary, useCurrentLocations } from '../hooks/usePhase1Data';
import { useCommunicationLogs } from '../hooks/useCommunications';

const mockedUseChildren = useChildren as ReturnType<typeof vi.fn>;
const mockedUseGenerateReport = useGenerateReport as ReturnType<typeof vi.fn>;
const mockedUseLatestReport = useLatestReport as ReturnType<typeof vi.fn>;
const mockedUseReports = useReports as ReturnType<typeof vi.fn>;
const mockedUseScreenTimeSummary = useScreenTimeSummary as ReturnType<typeof vi.fn>;
const mockedUseCurrentLocations = useCurrentLocations as ReturnType<typeof vi.fn>;
const mockedUseCommunicationLogs = useCommunicationLogs as ReturnType<typeof vi.fn>;

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

describe('ReportsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseGenerateReport.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    mockedUseLatestReport.mockReturnValue({ data: undefined, isLoading: false });
    mockedUseReports.mockReturnValue({ data: [] });
    mockedUseScreenTimeSummary.mockReturnValue({ data: undefined, isLoading: false });
    mockedUseCurrentLocations.mockReturnValue({ data: [], isLoading: false });
    mockedUseCommunicationLogs.mockReturnValue({ data: { data: [], meta: { page: 1, total_pages: 1, total: 0 } }, isLoading: false });
  });

  it('renders page title "Reports"', () => {
    mockedUseChildren.mockReturnValue({ data: [], isLoading: false });
    render(<ReportsPage />, { wrapper: createWrapper() });
    expect(screen.getByRole('heading', { name: 'Reports' })).toBeInTheDocument();
  });

  it('shows loading skeleton when children are loading', () => {
    mockedUseChildren.mockReturnValue({ data: undefined, isLoading: true });
    const { container } = render(<ReportsPage />, { wrapper: createWrapper() });
    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
  });

  it('renders all report tabs when a child is available', () => {
    mockedUseChildren.mockReturnValue({ data: [{ id: 'child-1', name: 'Ayan' }], isLoading: false });
    render(<ReportsPage />, { wrapper: createWrapper() });
    expect(screen.getByRole('button', { name: 'Overview' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Safety' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Location' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Usage' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Communication' })).toBeInTheDocument();
  });

  it('renders back to dashboard link', () => {
    mockedUseChildren.mockReturnValue({ data: [], isLoading: false });
    render(<ReportsPage />, { wrapper: createWrapper() });
    expect(screen.getByText('Back to Dashboard')).toBeInTheDocument();
  });
});

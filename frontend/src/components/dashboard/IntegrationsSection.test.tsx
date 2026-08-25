import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import IntegrationsSection from './IntegrationsSection';

vi.mock('../../hooks/useIntegrations', () => ({
  useIntegrations: vi.fn(),
  useCreateIntegration: vi.fn(),
  useDeleteIntegration: vi.fn(),
  useSyncIntegration: vi.fn(),
}));

import {
  useIntegrations,
  useCreateIntegration,
  useDeleteIntegration,
  useSyncIntegration,
} from '../../hooks/useIntegrations';

const mockedUseIntegrations = useIntegrations as ReturnType<typeof vi.fn>;
const mockedUseCreateIntegration = useCreateIntegration as ReturnType<typeof vi.fn>;
const mockedUseDeleteIntegration = useDeleteIntegration as ReturnType<typeof vi.fn>;
const mockedUseSyncIntegration = useSyncIntegration as ReturnType<typeof vi.fn>;

describe('IntegrationsSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseCreateIntegration.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    });
    mockedUseDeleteIntegration.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    });
    mockedUseSyncIntegration.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    });
  });

  it('shows empty state', () => {
    mockedUseIntegrations.mockReturnValue({ data: [], isLoading: false });
    render(<IntegrationsSection onError={vi.fn()} />);
    expect(screen.getByText(/no integrations configured/i)).toBeInTheDocument();
  });

  it('shows loading state', () => {
    mockedUseIntegrations.mockReturnValue({ data: undefined, isLoading: true });
    const { container } = render(<IntegrationsSection onError={vi.fn()} />);
    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
  });

  it('renders integration entries', () => {
    mockedUseIntegrations.mockReturnValue({
      data: [
        {
          id: 'i1',
          name: 'School Portal',
          integration_type: 'SCHOOL_PORTAL',
          is_active: true,
          last_sync_at: '2026-08-21T10:00:00.000Z',
        },
        {
          id: 'i2',
          name: 'Health App',
          integration_type: 'HEALTH_APP',
          is_active: false,
          last_sync_at: null,
        },
      ],
      isLoading: false,
    });
    render(<IntegrationsSection onError={vi.fn()} />);
    expect(screen.getByText('School Portal')).toBeInTheDocument();
    expect(screen.getAllByText('Health App').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Inactive')).toBeInTheDocument();
    expect(screen.getByText('2 connected')).toBeInTheDocument();
  });

  it('shows add form when + Add is clicked', () => {
    mockedUseIntegrations.mockReturnValue({ data: [], isLoading: false });
    render(<IntegrationsSection onError={vi.fn()} />);
    fireEvent.click(screen.getByText('+ Add'));
    expect(screen.getByText('Create')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });
});

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import WebsiteFilterSection from './WebsiteFilterSection';

vi.mock('../../hooks/useUrlFilters', () => ({
  useUrlFilters: vi.fn(),
  useCreateUrlFilter: vi.fn(),
  useDeleteUrlFilter: vi.fn(),
  useUpdateUrlFilter: vi.fn(),
}));

vi.mock('../ui/Skeleton', () => ({
  SkeletonTable: ({ rows }: { rows: number }) => (
    <div data-testid="skeleton-table" data-rows={rows} />
  ),
}));

vi.mock('../ui/ConfirmDialog', () => ({
  default: ({ title, message, onConfirm, onCancel }: { title: string; message: string; onConfirm: () => void; onCancel: () => void }) => (
    <div role="dialog" data-testid="confirm-dialog">
      <h3>{title}</h3>
      <p>{message}</p>
      <button onClick={onCancel}>Cancel</button>
      <button onClick={onConfirm}>Delete</button>
    </div>
  ),
}));

import {
  useUrlFilters,
  useCreateUrlFilter,
  useDeleteUrlFilter,
  useUpdateUrlFilter,
} from '../../hooks/useUrlFilters';

const mockedUseUrlFilters = useUrlFilters as ReturnType<typeof vi.fn>;
const mockedUseCreateUrlFilter = useCreateUrlFilter as ReturnType<typeof vi.fn>;
const mockedUseDeleteUrlFilter = useDeleteUrlFilter as ReturnType<typeof vi.fn>;
const mockedUseUpdateUrlFilter = useUpdateUrlFilter as ReturnType<typeof vi.fn>;

const sampleRule = {
  id: 'r1',
  url_pattern: 'facebook.com',
  rule_type: 'BLOCK' as const,
  category: 'Social Media',
  is_active: true,
  child_id: 'child-1',
  created_at: '2026-08-29T10:00:00Z',
  updated_at: '2026-08-29T10:00:00Z',
};

function setupDefaultMocks() {
  mockedUseUrlFilters.mockReturnValue({ data: [sampleRule], isLoading: false });
  mockedUseCreateUrlFilter.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue({}), isPending: false });
  mockedUseDeleteUrlFilter.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue({}), isPending: false });
  mockedUseUpdateUrlFilter.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue({}), isPending: false });
}

describe('WebsiteFilterSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading skeleton while fetching', () => {
    mockedUseUrlFilters.mockReturnValue({ data: undefined, isLoading: true });
    render(<WebsiteFilterSection childId="child-1" onError={vi.fn()} />);
    expect(screen.getByTestId('skeleton-table')).toBeInTheDocument();
  });

  it('renders heading', () => {
    setupDefaultMocks();
    render(<WebsiteFilterSection childId="child-1" onError={vi.fn()} />);
    expect(screen.getByText('Website Filtering')).toBeInTheDocument();
    expect(screen.getByText(/block or allow specific websites/i)).toBeInTheDocument();
  });

  it('renders the add form with input, selects, and submit button', () => {
    setupDefaultMocks();
    render(<WebsiteFilterSection childId="child-1" onError={vi.fn()} />);
    expect(screen.getByPlaceholderText(/enter url or pattern/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^add$/i })).toBeInTheDocument();
  });

  it('shows empty state when no rules', () => {
    mockedUseUrlFilters.mockReturnValue({ data: [], isLoading: false });
    mockedUseCreateUrlFilter.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    mockedUseDeleteUrlFilter.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    mockedUseUpdateUrlFilter.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    render(<WebsiteFilterSection childId="child-1" onError={vi.fn()} />);
    expect(screen.getByText(/no website rules configured yet/i)).toBeInTheDocument();
  });

  it('renders rule in table with url pattern, type, and category', () => {
    setupDefaultMocks();
    render(<WebsiteFilterSection childId="child-1" onError={vi.fn()} />);
    expect(screen.getByText('facebook.com')).toBeInTheDocument();
    expect(screen.getByText('BLOCK')).toBeInTheDocument();
    expect(screen.getAllByText('Social Media').length).toBeGreaterThanOrEqual(1);
  });

  it('calls useCreateUrlFilter when add form is submitted', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({});
    setupDefaultMocks();
    mockedUseCreateUrlFilter.mockReturnValue({ mutateAsync, isPending: false });
    render(<WebsiteFilterSection childId="child-1" onError={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/enter url or pattern/i), { target: { value: 'twitter.com' } });
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }));
    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({
        url_pattern: 'twitter.com',
        rule_type: 'BLOCK',
        category: 'Custom',
      });
    });
  });

  it('shows add form loading state', () => {
    setupDefaultMocks();
    mockedUseCreateUrlFilter.mockReturnValue({ mutateAsync: vi.fn(), isPending: true });
    render(<WebsiteFilterSection childId="child-1" onError={vi.fn()} />);
    expect(screen.getByText('Adding...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /adding/i })).toBeDisabled();
  });

  it('does not submit when URL input is empty', () => {
    const mutateAsync = vi.fn();
    setupDefaultMocks();
    mockedUseCreateUrlFilter.mockReturnValue({ mutateAsync, isPending: false });
    render(<WebsiteFilterSection childId="child-1" onError={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }));
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('opens confirm dialog when delete is clicked', () => {
    setupDefaultMocks();
    render(<WebsiteFilterSection childId="child-1" onError={vi.fn()} />);
    fireEvent.click(screen.getByText('Delete'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Delete URL Rule')).toBeInTheDocument();
  });

  it('calls delete mutation when confirm is clicked', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({});
    setupDefaultMocks();
    mockedUseDeleteUrlFilter.mockReturnValue({ mutateAsync, isPending: false });
    render(<WebsiteFilterSection childId="child-1" onError={vi.fn()} />);
    fireEvent.click(screen.getByText('Delete'));
    const dialog = screen.getByRole('dialog');
    const deleteBtn = dialog.querySelector('button:last-child')!;
    fireEvent.click(deleteBtn);
    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith('r1');
    });
  });

  it('calls onError when delete fails', async () => {
    const onError = vi.fn();
    const mutateAsync = vi.fn().mockRejectedValue(new Error('fail'));
    setupDefaultMocks();
    mockedUseDeleteUrlFilter.mockReturnValue({ mutateAsync, isPending: false });
    render(<WebsiteFilterSection childId="child-1" onError={onError} />);
    fireEvent.click(screen.getByText('Delete'));
    const dialog = screen.getByRole('dialog');
    const deleteBtn = dialog.querySelector('button:last-child')!;
    fireEvent.click(deleteBtn);
    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith('Failed to delete URL rule');
    });
  });

  it('calls onError when create fails', async () => {
    const onError = vi.fn();
    const mutateAsync = vi.fn().mockRejectedValue(new Error('fail'));
    setupDefaultMocks();
    mockedUseCreateUrlFilter.mockReturnValue({ mutateAsync, isPending: false });
    render(<WebsiteFilterSection childId="child-1" onError={onError} />);
    fireEvent.change(screen.getByPlaceholderText(/enter url or pattern/i), { target: { value: 'test.com' } });
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }));
    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith('Failed to add URL rule');
    });
  });
});

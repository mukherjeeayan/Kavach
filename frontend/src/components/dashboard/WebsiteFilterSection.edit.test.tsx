import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import WebsiteFilterSection from './WebsiteFilterSection';

vi.mock('../../hooks/useUrlFilters', () => ({
  useUrlFilters: vi.fn(),
  useCreateUrlFilter: vi.fn(),
  useDeleteUrlFilter: vi.fn(),
  useUpdateUrlFilter: vi.fn(),
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
  created_at: '',
  updated_at: '',
};

describe('WebsiteFilterSection edit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseCreateUrlFilter.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    mockedUseDeleteUrlFilter.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
  });

  it('renders an edit button for each URL rule row', () => {
    mockedUseUrlFilters.mockReturnValue({ data: [sampleRule], isLoading: false });
    mockedUseUpdateUrlFilter.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });

    render(<WebsiteFilterSection childId="child-1" onError={vi.fn()} />);

    const editButton = screen.getByRole('button', { name: /edit facebook\.com/i });
    expect(editButton).toBeInTheDocument();
  });

  it('opens an inline edit form with prefilled values when edit is clicked', () => {
    mockedUseUrlFilters.mockReturnValue({ data: [sampleRule], isLoading: false });
    mockedUseUpdateUrlFilter.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });

    render(<WebsiteFilterSection childId="child-1" onError={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /edit facebook\.com/i }));

    const form = screen.getByTestId('url-filter-edit-form');
    expect(form).toBeInTheDocument();

    expect((screen.getByLabelText('URL pattern') as HTMLInputElement).value).toBe('facebook.com');
    const blockRadio = form.querySelector<HTMLInputElement>('input[type="radio"][value="BLOCK"], input[type="radio"]');
    expect((screen.getByLabelText('Category') as HTMLSelectElement).value).toBe('Social Media');
    if (blockRadio) {
      expect(blockRadio.checked).toBe(true);
    }
  });

  it('calls useUpdateUrlFilter with the edited values when save is clicked', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({});
    mockedUseUrlFilters.mockReturnValue({ data: [sampleRule], isLoading: false });
    mockedUseUpdateUrlFilter.mockReturnValue({ mutateAsync, isPending: false });

    render(<WebsiteFilterSection childId="child-1" onError={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /edit facebook\.com/i }));

    fireEvent.change(screen.getByLabelText('URL pattern'), { target: { value: 'twitter.com' } });
    fireEvent.click(screen.getByLabelText('Allow'));
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'Games' } });

    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledTimes(1);
    });
    expect(mutateAsync).toHaveBeenCalledWith({
      ruleId: 'r1',
      input: {
        url_pattern: 'twitter.com',
        rule_type: 'ALLOW',
        category: 'Games',
      },
    });
  });

  it('discards changes and closes the edit form when cancel is clicked', () => {
    const mutateAsync = vi.fn();
    mockedUseUrlFilters.mockReturnValue({ data: [sampleRule], isLoading: false });
    mockedUseUpdateUrlFilter.mockReturnValue({ mutateAsync, isPending: false });

    render(<WebsiteFilterSection childId="child-1" onError={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /edit facebook\.com/i }));
    expect(screen.getByTestId('url-filter-edit-form')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('URL pattern'), { target: { value: 'should-not-save.com' } });
    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));

    expect(screen.queryByTestId('url-filter-edit-form')).not.toBeInTheDocument();
    expect(mutateAsync).not.toHaveBeenCalled();
  });
});

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import KeywordDictionarySection from './KeywordDictionarySection';

vi.mock('../../hooks/useKeywords', () => ({
  useKeywords: vi.fn(),
  useCreateKeyword: vi.fn(),
  useDeleteKeyword: vi.fn(),
}));

import { useKeywords, useCreateKeyword, useDeleteKeyword } from '../../hooks/useKeywords';

const mockedUseKeywords = useKeywords as ReturnType<typeof vi.fn>;
const mockedUseCreateKeyword = useCreateKeyword as ReturnType<typeof vi.fn>;
const mockedUseDeleteKeyword = useDeleteKeyword as ReturnType<typeof vi.fn>;

const sampleEntries = [
  {
    id: 'k1',
    category: 'violence' as const,
    keyword: 'attack',
    severity: 'high' as const,
    language: 'en',
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'k2',
    category: 'bullying' as const,
    keyword: 'loser',
    severity: 'low' as const,
    language: 'en',
    is_active: false,
    created_at: '2026-01-02T00:00:00Z',
  },
];

describe('KeywordDictionarySection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseCreateKeyword.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    mockedUseDeleteKeyword.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
  });

  it('renders the list of keyword entries', () => {
    mockedUseKeywords.mockReturnValue({
      data: { data: sampleEntries, meta: { page: 1, limit: 50, total: 2, total_pages: 1 } },
      isLoading: false,
      isError: false,
    });
    render(<KeywordDictionarySection onError={vi.fn()} />);
    expect(screen.getByText('attack')).toBeInTheDocument();
    expect(screen.getByText('loser')).toBeInTheDocument();
    expect(screen.getByText('violence')).toBeInTheDocument();
    expect(screen.getByText('bullying')).toBeInTheDocument();
    expect(screen.getByText('high')).toBeInTheDocument();
    expect(screen.getByText('low')).toBeInTheDocument();
  });

  it('shows the empty state when no keywords exist', () => {
    mockedUseKeywords.mockReturnValue({
      data: { data: [], meta: { page: 1, limit: 50, total: 0, total_pages: 0 } },
      isLoading: false,
      isError: false,
    });
    render(<KeywordDictionarySection onError={vi.fn()} />);
    expect(screen.getByText(/no keywords configured/i)).toBeInTheDocument();
  });

  it('shows loading state', () => {
    mockedUseKeywords.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    const { container } = render(<KeywordDictionarySection onError={vi.fn()} />);
    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
  });

  it('shows error banner on failure', () => {
    mockedUseKeywords.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    render(<KeywordDictionarySection onError={vi.fn()} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/failed to load keyword dictionary/i);
  });

  it('opens the add form and submits a new keyword', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({});
    mockedUseCreateKeyword.mockReturnValue({ mutateAsync, isPending: false });
    mockedUseKeywords.mockReturnValue({
      data: { data: [], meta: { page: 1, limit: 50, total: 0, total_pages: 0 } },
      isLoading: false,
      isError: false,
    });

    render(<KeywordDictionarySection onError={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /add keyword/i }));

    const keywordInput = screen.getByPlaceholderText(/enter keyword or phrase/i);
    fireEvent.change(keywordInput, { target: { value: 'weapon' } });

    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({
        category: 'violence',
        keyword: 'weapon',
        severity: 'medium',
      });
    });
  });

  it('does not submit when keyword is empty', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({});
    mockedUseCreateKeyword.mockReturnValue({ mutateAsync, isPending: false });
    mockedUseKeywords.mockReturnValue({
      data: { data: [], meta: { page: 1, limit: 50, total: 0, total_pages: 0 } },
      isLoading: false,
      isError: false,
    });

    render(<KeywordDictionarySection onError={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /add keyword/i }));

    const saveBtn = screen.getByRole('button', { name: /^save$/i });
    expect(saveBtn).toBeDisabled();
  });

  it('opens confirm dialog and deletes keyword on confirm', async () => {
    const deleteMutate = vi.fn().mockResolvedValue(undefined);
    mockedUseDeleteKeyword.mockReturnValue({ mutateAsync: deleteMutate, isPending: false });
    mockedUseKeywords.mockReturnValue({
      data: { data: sampleEntries, meta: { page: 1, limit: 50, total: 2, total_pages: 1 } },
      isLoading: false,
      isError: false,
    });

    render(<KeywordDictionarySection onError={vi.fn()} />);

    const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
    fireEvent.click(deleteButtons[0]);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('Delete Keyword');
    expect(dialog).toHaveTextContent(/are you sure/i);

    const confirmBtn = within(dialog).getByRole('button', { name: /^delete$/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(deleteMutate).toHaveBeenCalledWith('k1');
    });
  });

  it('reports error when delete fails', async () => {
    const onError = vi.fn();
    const deleteMutate = vi.fn().mockRejectedValue(new Error('fail'));
    mockedUseDeleteKeyword.mockReturnValue({ mutateAsync: deleteMutate, isPending: false });
    mockedUseKeywords.mockReturnValue({
      data: { data: sampleEntries, meta: { page: 1, limit: 50, total: 2, total_pages: 1 } },
      isLoading: false,
      isError: false,
    });

    render(<KeywordDictionarySection onError={onError} />);

    const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
    fireEvent.click(deleteButtons[0]);
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: /^delete$/i }));

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith('Failed to delete keyword');
    });
  });
});

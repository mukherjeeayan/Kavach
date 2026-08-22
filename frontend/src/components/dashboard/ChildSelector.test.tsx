import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ChildSelector from './ChildSelector';
import type { ChildProfile } from '../../types/api';

const baseChild = {
  parent_id: 'parent-1',
  created_at: '2026-08-21T00:00:00Z',
  updated_at: '2026-08-21T00:00:00Z',
};

describe('ChildSelector', () => {
  const defaultProps = {
    children: [],
    selectedChildId: null,
    isLoading: false,
    isError: false,
    onSelect: vi.fn(),
    onAddChild: vi.fn(),
    isAddingChild: false,
    addChildError: null,
  };

  it('shows loading state', () => {
    render(<ChildSelector {...defaultProps} isLoading={true} />);
    expect(screen.getByText(/children/i)).toBeInTheDocument();
  });

  it('shows error state', () => {
    render(<ChildSelector {...defaultProps} isError={true} />);
    expect(screen.getByText(/failed to load children/i)).toBeInTheDocument();
  });

  it('shows empty state', () => {
    render(<ChildSelector {...defaultProps} />);
    expect(screen.getByText(/no child profiles yet/i)).toBeInTheDocument();
  });

  it('renders child buttons', () => {
    const children: ChildProfile[] = [
      { ...baseChild, id: '1', name: 'Aarav', birth_date: '2015-06-01', daily_screen_time_limit_minutes: null },
      { ...baseChild, id: '2', name: 'Diya', birth_date: '2018-03-15', daily_screen_time_limit_minutes: 60 },
    ];
    render(<ChildSelector {...defaultProps} children={children} />);
    expect(screen.getByText('Aarav')).toBeInTheDocument();
    expect(screen.getByText('Diya')).toBeInTheDocument();
  });

  it('highlights selected child', () => {
    const children: ChildProfile[] = [
      { ...baseChild, id: '1', name: 'Aarav', birth_date: '2015-06-01', daily_screen_time_limit_minutes: null },
    ];
    render(<ChildSelector {...defaultProps} children={children} selectedChildId="1" />);
    const button = screen.getByText('Aarav');
    expect(button.className).toContain('bg-primary');
  });

  it('shows add child form when + Add child is clicked', async () => {
    render(<ChildSelector {...defaultProps} />);
    const addBtn = screen.getByText('+ Add child');
    fireEvent.click(addBtn);
    expect(screen.getByText('Save child')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/aarav/i)).toBeInTheDocument();
  });

  it('shows add child error', () => {
    render(<ChildSelector {...defaultProps} addChildError="Failed to add child" />);
    fireEvent.click(screen.getByText('+ Add child'));
    expect(screen.getByText('Failed to add child')).toBeInTheDocument();
  });
});

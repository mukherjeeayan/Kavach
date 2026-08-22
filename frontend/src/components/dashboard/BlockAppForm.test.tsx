import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import BlockAppForm from './BlockAppForm';

describe('BlockAppForm', () => {
  const defaultProps = {
    isPending: false,
    disabled: false,
    showDeviceHint: false,
    onBlock: vi.fn(),
  };

  it('renders the form', () => {
    render(<BlockAppForm {...defaultProps} />);
    expect(screen.getByText('Block an App')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/package name/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/reason/i)).toBeInTheDocument();
    expect(screen.getByText('Block App')).toBeInTheDocument();
  });

  it('shows device hint when showDeviceHint is true', () => {
    render(<BlockAppForm {...defaultProps} showDeviceHint={true} />);
    expect(screen.getByText(/select a device above/i)).toBeInTheDocument();
  });

  it('disables button when disabled prop is true', () => {
    render(<BlockAppForm {...defaultProps} disabled={true} />);
    expect(screen.getByText('Block App')).toBeDisabled();
  });

  it('shows loading state when isPending is true', () => {
    render(<BlockAppForm {...defaultProps} isPending={true} />);
    expect(screen.getByText('Blocking...')).toBeInTheDocument();
  });
});

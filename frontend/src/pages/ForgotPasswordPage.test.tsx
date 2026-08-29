import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ForgotPasswordPage from './ForgotPasswordPage';

const mockPost = vi.fn();
vi.mock('../services/apiClient', () => ({
  default: { post: (...args: unknown[]) => mockPost(...args) },
}));

vi.mock('../components/auth/AuthLayout', () => ({
  default: ({ children, title }: { children: React.ReactNode; title: string }) => (
    <div data-testid="auth-layout">
      <h1>{title}</h1>
      {children}
    </div>
  ),
}));

vi.mock('../components/ui/TextField', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TextField: ({ label, ...props }: any) => (
    <div>
      <label>{label}</label>
      <input aria-label={label} {...props} />
    </div>
  ),
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <ForgotPasswordPage />
    </MemoryRouter>
  );
}

describe('ForgotPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders email input and submit button', () => {
    renderPage();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send reset link/i })).toBeInTheDocument();
  });

  it('renders page title and description', () => {
    renderPage();
    expect(screen.getByText('Reset Password')).toBeInTheDocument();
    expect(screen.getByText(/enter your email address/i)).toBeInTheDocument();
  });

  it('has a link back to login', () => {
    renderPage();
    expect(screen.getByText('Sign in')).toHaveAttribute('href', '/login');
  });

  it('shows success message after submission', async () => {
    mockPost.mockResolvedValueOnce({});

    renderPage();

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }));

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(/password reset link has been sent/i);
    });
  });

  it('shows error message on API failure', async () => {
    mockPost.mockRejectedValueOnce(new Error('Network error'));

    renderPage();

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong. Please try again later.');
    });
  });

  it('shows loading state while submitting', async () => {
    let resolvePost: () => void;
    mockPost.mockReturnValueOnce(new Promise<void>((r) => { resolvePost = r; }));

    renderPage();

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /sending/i })).toBeDisabled();
    });

    resolvePost!();
  });

  it('submit button is disabled when email is empty', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /send reset link/i })).toBeDisabled();
  });

  it('enables submit button when email is entered', () => {
    renderPage();
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.com' } });
    expect(screen.getByRole('button', { name: /send reset link/i })).not.toBeDisabled();
  });
});

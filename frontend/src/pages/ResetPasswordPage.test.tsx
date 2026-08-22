import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ResetPasswordPage from './ResetPasswordPage';
import apiClient from '../services/apiClient';

vi.mock('../services/apiClient', () => ({
  default: { post: vi.fn() },
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
  TextField: ({ label, error, ...props }: any) => (
    <div>
      <label>{label}</label>
      <input aria-label={label} {...props} />
      {error && <span className="text-red-500">{error}</span>}
    </div>
  ),
}));

function renderWithRouter(initialEntries: string[]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <ResetPasswordPage />
    </MemoryRouter>
  );
}

describe('ResetPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('missing token', () => {
    it('shows error when token is missing', () => {
      renderWithRouter(['/reset-password']);
      expect(screen.getByText(/missing its token/i)).toBeInTheDocument();
    });

    it('shows link to request new reset link', () => {
      renderWithRouter(['/reset-password']);
      expect(screen.getByText('Request a new reset link')).toHaveAttribute(
        'href',
        '/forgot-password'
      );
    });

    it('does not render the form when token is missing', () => {
      renderWithRouter(['/reset-password']);
      expect(screen.queryByRole('button', { name: /reset password/i })).not.toBeInTheDocument();
    });
  });

  describe('with token', () => {
    it('renders the form with password fields', () => {
      renderWithRouter(['/reset-password?token=abc123']);
      expect(screen.getByLabelText('New Password')).toBeInTheDocument();
      expect(screen.getByLabelText('Confirm New Password')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /reset password/i })).toBeInTheDocument();
    });

    it('renders the page title', () => {
      renderWithRouter(['/reset-password?token=abc123']);
      expect(screen.getByText('Choose a New Password')).toBeInTheDocument();
    });

    it('submit button is disabled when passwords are too short', () => {
      renderWithRouter(['/reset-password?token=abc123']);
      const button = screen.getByRole('button', { name: /reset password/i });
      expect(button).toBeDisabled();
    });

    it('shows password mismatch error', () => {
      renderWithRouter(['/reset-password?token=abc123']);
      const newPass = screen.getByLabelText('New Password');
      const confirmPass = screen.getByLabelText('Confirm New Password');

      fireEvent.change(newPass, { target: { value: 'password123' } });
      fireEvent.change(confirmPass, { target: { value: 'different123' } });

      expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
    });

    it('enables submit when valid passwords are entered', () => {
      renderWithRouter(['/reset-password?token=abc123']);
      const newPass = screen.getByLabelText('New Password');
      const confirmPass = screen.getByLabelText('Confirm New Password');

      fireEvent.change(newPass, { target: { value: 'password123' } });
      fireEvent.change(confirmPass, { target: { value: 'password123' } });

      expect(screen.getByRole('button', { name: /reset password/i })).not.toBeDisabled();
    });

    it('submits form and calls API', async () => {
      vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { success: true } });

      renderWithRouter(['/reset-password?token=abc123']);
      const newPass = screen.getByLabelText('New Password');
      const confirmPass = screen.getByLabelText('Confirm New Password');

      fireEvent.change(newPass, { target: { value: 'password123' } });
      fireEvent.change(confirmPass, { target: { value: 'password123' } });
      fireEvent.click(screen.getByRole('button', { name: /reset password/i }));

      await waitFor(() => {
        expect(apiClient.post).toHaveBeenCalledWith('/auth/reset-password', {
          token: 'abc123',
          new_password: 'password123',
        });
      });
    });

    it('shows success message after successful reset', async () => {
      vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { success: true } });

      renderWithRouter(['/reset-password?token=abc123']);
      const newPass = screen.getByLabelText('New Password');
      const confirmPass = screen.getByLabelText('Confirm New Password');

      fireEvent.change(newPass, { target: { value: 'password123' } });
      fireEvent.change(confirmPass, { target: { value: 'password123' } });
      fireEvent.click(screen.getByRole('button', { name: /reset password/i }));

      await waitFor(() => {
        expect(screen.getByText(/password has been reset successfully/i)).toBeInTheDocument();
      });
    });

    it('shows sign in link after success', async () => {
      vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { success: true } });

      renderWithRouter(['/reset-password?token=abc123']);
      fireEvent.change(screen.getByLabelText('New Password'), { target: { value: 'password123' } });
      fireEvent.change(screen.getByLabelText('Confirm New Password'), {
        target: { value: 'password123' },
      });
      fireEvent.click(screen.getByRole('button', { name: /reset password/i }));

      await waitFor(() => {
        expect(screen.getByText('Sign in')).toHaveAttribute('href', '/login');
      });
    });

    it('shows generic error on API failure', async () => {
      vi.mocked(apiClient.post).mockRejectedValueOnce(new Error('Network error'));

      renderWithRouter(['/reset-password?token=abc123']);
      fireEvent.change(screen.getByLabelText('New Password'), { target: { value: 'password123' } });
      fireEvent.change(screen.getByLabelText('Confirm New Password'), {
        target: { value: 'password123' },
      });
      fireEvent.click(screen.getByRole('button', { name: /reset password/i }));

      await waitFor(() => {
        expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
      });
    });

    it('shows specific error for invalid token', async () => {
      vi.mocked(apiClient.post).mockRejectedValueOnce({
        response: { data: { error: 'Invalid or expired reset token' } },
      });

      renderWithRouter(['/reset-password?token=abc123']);
      fireEvent.change(screen.getByLabelText('New Password'), { target: { value: 'password123' } });
      fireEvent.change(screen.getByLabelText('Confirm New Password'), {
        target: { value: 'password123' },
      });
      fireEvent.click(screen.getByRole('button', { name: /reset password/i }));

      await waitFor(() => {
        expect(screen.getByText(/reset link is invalid or has already been used/i)).toBeInTheDocument();
      });
    });

    it('shows Resetting... while loading', async () => {
      let resolvePromise: (value: any) => void;
      vi.mocked(apiClient.post).mockReturnValueOnce(
        new Promise((resolve) => {
          resolvePromise = resolve;
        })
      );

      renderWithRouter(['/reset-password?token=abc123']);
      fireEvent.change(screen.getByLabelText('New Password'), { target: { value: 'password123' } });
      fireEvent.change(screen.getByLabelText('Confirm New Password'), {
        target: { value: 'password123' },
      });
      fireEvent.click(screen.getByRole('button', { name: /reset password/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /resetting/i })).toBeInTheDocument();
      });

      resolvePromise!({ data: { success: true } });
    });
  });
});

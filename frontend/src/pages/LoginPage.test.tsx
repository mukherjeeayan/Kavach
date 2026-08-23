import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from './LoginPage';
import authReducer from '../store/authSlice';
import type { ReactNode } from 'react';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockOnSubmit = vi.fn();
const mockRegister = vi.fn();
const mockUseLogin = vi.fn();
vi.mock('../hooks/useAuth', () => ({
  useLogin: () => mockUseLogin(),
}));

vi.mock('../components/auth/AuthLayout', () => ({
  default: ({ children, title }: { children: ReactNode; title: string }) => (
    <div data-testid="auth-layout">
      <h1>{title}</h1>
      {children}
    </div>
  ),
}));

vi.mock('../components/ui/TextField', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TextField: ({ label, error, ...props }: any) => (
    <div>
      <label>{label}</label>
      <input aria-label={label} {...props} />
      {error && <span className="text-red-500">{error}</span>}
    </div>
  ),
}));

function createTestStore() {
  return configureStore({ reducer: { auth: authReducer } });
}

function renderWithProviders(ui: ReactNode, store = createTestStore()) {
  return render(
    <Provider store={store}>
      <MemoryRouter>{ui}</MemoryRouter>
    </Provider>
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseLogin.mockReturnValue({
      register: mockRegister.mockReturnValue({ name: 'email', onBlur: vi.fn(), ref: vi.fn() }),
      errors: {},
      onSubmit: mockOnSubmit,
      isLoading: false,
      serverError: null,
    });
  });

  it('renders email and password inputs, submit button, and links', () => {
    renderWithProviders(<LoginPage />);

    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    expect(screen.getByText('Forgot your password?')).toBeInTheDocument();
    expect(screen.getByText('Create an account')).toBeInTheDocument();
  });

  it('renders page title', () => {
    renderWithProviders(<LoginPage />);
    expect(screen.getByText('SafeGuard Parent Portal')).toBeInTheDocument();
  });

  it('calls onSubmit when form is submitted', () => {
    mockOnSubmit.mockImplementation((e: React.FormEvent) => e.preventDefault());

    renderWithProviders(<LoginPage />);

    const form = document.querySelector('form')!;
    fireEvent.submit(form);

    expect(mockOnSubmit).toHaveBeenCalled();
  });

  it('shows "Signing In..." text when loading', () => {
    mockUseLogin.mockReturnValue({
      register: mockRegister.mockReturnValue({ name: 'email', onBlur: vi.fn(), ref: vi.fn() }),
      errors: {},
      onSubmit: mockOnSubmit,
      isLoading: true,
      serverError: null,
    });

    renderWithProviders(<LoginPage />);

    expect(screen.getByRole('button', { name: /signing in/i })).toBeInTheDocument();
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('displays server error message', () => {
    mockUseLogin.mockReturnValue({
      register: mockRegister.mockReturnValue({ name: 'email', onBlur: vi.fn(), ref: vi.fn() }),
      errors: {},
      onSubmit: mockOnSubmit,
      isLoading: false,
      serverError: 'Invalid email or password.',
    });

    renderWithProviders(<LoginPage />);

    expect(screen.getByRole('alert')).toHaveTextContent('Invalid email or password.');
  });

  it('does not display server error when null', () => {
    renderWithProviders(<LoginPage />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('displays validation errors', () => {
    mockUseLogin.mockReturnValue({
      register: mockRegister.mockReturnValue({ name: 'email', onBlur: vi.fn(), ref: vi.fn() }),
      errors: {
        email: { message: 'Email is required' },
        password: { message: 'Password is required' },
      },
      onSubmit: mockOnSubmit,
      isLoading: false,
      serverError: null,
    });

    renderWithProviders(<LoginPage />);

    expect(screen.getByText('Email is required')).toBeInTheDocument();
    expect(screen.getByText('Password is required')).toBeInTheDocument();
  });

  it('submit button is enabled when not loading', () => {
    renderWithProviders(<LoginPage />);
    expect(screen.getByRole('button', { name: /sign in/i })).not.toBeDisabled();
  });
});

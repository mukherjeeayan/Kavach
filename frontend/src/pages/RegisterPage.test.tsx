import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import RegisterPage from './RegisterPage';
import authReducer from '../store/authSlice';
import type { ReactNode } from 'react';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockOnSubmit = vi.fn();
const mockRegister = vi.fn();
const mockUseRegister = vi.fn();
vi.mock('../hooks/useAuth', () => ({
  useRegister: () => mockUseRegister(),
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
  TextField: ({ label, error, optional, ...props }: any) => (
    <div>
      <label>
        {label}
        {optional && <span> (optional)</span>}
      </label>
      <input aria-label={label} {...props} />
      {error && <span className="text-red-500">{error.message ?? String(error)}</span>}
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

describe('RegisterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseRegister.mockReturnValue({
      register: mockRegister.mockReturnValue({ name: 'name', onBlur: vi.fn(), ref: vi.fn() }),
      errors: {},
      onSubmit: mockOnSubmit,
      isLoading: false,
      serverError: null,
    });
  });

  it('renders all form fields and submit button', () => {
    renderWithProviders(<RegisterPage />);

    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByLabelText(/First Child's Name/)).toBeInTheDocument();
    expect(screen.getByLabelText('Birth Date')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
  });

  it('renders page title', () => {
    renderWithProviders(<RegisterPage />);
    expect(screen.getByText('Create Parent Account')).toBeInTheDocument();
  });

  it('renders "Already have an account?" link', () => {
    renderWithProviders(<RegisterPage />);
    expect(screen.getByText('Already have an account?')).toBeInTheDocument();
    expect(screen.getByText('Sign in')).toHaveAttribute('href', '/login');
  });

  it('marks optional fields', () => {
    renderWithProviders(<RegisterPage />);
    expect(screen.getAllByText('(optional)').length).toBe(2);
  });

  it('calls onSubmit when form is submitted', () => {
    mockOnSubmit.mockImplementation((e: React.FormEvent) => e.preventDefault());

    renderWithProviders(<RegisterPage />);

    const form = document.querySelector('form')!;
    fireEvent.submit(form);

    expect(mockOnSubmit).toHaveBeenCalled();
  });

  it('shows "Creating Account..." when loading', () => {
    mockUseRegister.mockReturnValue({
      register: mockRegister.mockReturnValue({ name: 'name', onBlur: vi.fn(), ref: vi.fn() }),
      errors: {},
      onSubmit: mockOnSubmit,
      isLoading: true,
      serverError: null,
    });

    renderWithProviders(<RegisterPage />);

    expect(screen.getByRole('button', { name: /creating account/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /creating account/i })).toBeDisabled();
  });

  it('displays server error', () => {
    mockUseRegister.mockReturnValue({
      register: mockRegister.mockReturnValue({ name: 'name', onBlur: vi.fn(), ref: vi.fn() }),
      errors: {},
      onSubmit: mockOnSubmit,
      isLoading: false,
      serverError: 'Email already in use.',
    });

    renderWithProviders(<RegisterPage />);
    expect(screen.getByRole('alert')).toHaveTextContent('Email already in use.');
  });

  it('displays validation errors', () => {
    mockUseRegister.mockReturnValue({
      register: mockRegister.mockReturnValue({ name: 'name', onBlur: vi.fn(), ref: vi.fn() }),
      errors: {
        name: { message: 'Name is required' },
        email: { message: 'Invalid email' },
        password: { message: 'Password must be at least 8 characters' },
      },
      onSubmit: mockOnSubmit,
      isLoading: false,
      serverError: null,
    });

    renderWithProviders(<RegisterPage />);

    expect(screen.getByText('Name is required')).toBeInTheDocument();
    expect(screen.getByText('Invalid email')).toBeInTheDocument();
    expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument();
  });

  it('submit button enabled when not loading', () => {
    renderWithProviders(<RegisterPage />);
    expect(screen.getByRole('button', { name: /create account/i })).not.toBeDisabled();
  });
});

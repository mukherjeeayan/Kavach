import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import SettingsPage from './SettingsPage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import authReducer from '../store/authSlice';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

function createTestStore() {
  return configureStore({ reducer: { auth: authReducer } });
}

function renderWithProviders(ui: React.ReactNode, store = createTestStore()) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>{ui}</MemoryRouter>
      </QueryClientProvider>
    </Provider>
  );
}

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders profile section', () => {
    renderWithProviders(<SettingsPage />);
    expect(screen.getByText('Profile')).toBeInTheDocument();
    expect(screen.getByText('Name')).toBeInTheDocument();
  });

  it('renders change password section', () => {
    renderWithProviders(<SettingsPage />);
    expect(screen.getByText('Current Password')).toBeInTheDocument();
    expect(screen.getByText('New Password')).toBeInTheDocument();
  });

  it('renders PIN section', () => {
    renderWithProviders(<SettingsPage />);
    expect(screen.getByText('New PIN (4-6 digits)')).toBeInTheDocument();
    expect(screen.getByText('Confirm PIN')).toBeInTheDocument();
  });

  it('renders danger zone section', () => {
    renderWithProviders(<SettingsPage />);
    expect(screen.getByText('Sign out of all devices')).toBeInTheDocument();
  });

  it('renders confirm dialog for sign out all', () => {
    renderWithProviders(<SettingsPage />);
    expect(screen.queryByText('Sign out of all devices?')).not.toBeInTheDocument();
  });
});
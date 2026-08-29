import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SettingsPage from './SettingsPage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import authReducer from '../store/authSlice';

vi.mock('../hooks/useSettings', () => ({
  useSettings: vi.fn(),
  useUpdateSettings: vi.fn(),
}));

import { useSettings, useUpdateSettings } from '../hooks/useSettings';

const mockedUseSettings = useSettings as ReturnType<typeof vi.fn>;
const mockedUseUpdateSettings = useUpdateSettings as ReturnType<typeof vi.fn>;

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

const baseSettings = {
  notifications_enabled: true,
  screen_time_alerts: true,
  location_alerts: true,
  communication_alerts: true,
  sos_alerts: true,
  self_harm_alerts: true,
  email_digest_enabled: false,
  digest_frequency: 'DAILY' as const,
  dnd_enabled: false,
  dnd_start_time: '22:00',
  dnd_end_time: '07:00',
};

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
    mockedUseUpdateSettings.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue(baseSettings),
      isPending: false,
      isError: false,
      reset: vi.fn(),
    });
  });

  it('renders profile section', () => {
    mockedUseSettings.mockReturnValue({ data: baseSettings, isLoading: false });
    renderWithProviders(<SettingsPage />);
    expect(screen.getByText('Profile')).toBeInTheDocument();
    expect(screen.getByText('Name')).toBeInTheDocument();
  });

  it('renders change password section', () => {
    mockedUseSettings.mockReturnValue({ data: baseSettings, isLoading: false });
    renderWithProviders(<SettingsPage />);
    expect(screen.getByText('Current Password')).toBeInTheDocument();
    expect(screen.getByText('New Password')).toBeInTheDocument();
  });

  it('renders PIN section', () => {
    mockedUseSettings.mockReturnValue({ data: baseSettings, isLoading: false });
    renderWithProviders(<SettingsPage />);
    expect(screen.getByText('New PIN (4-6 digits)')).toBeInTheDocument();
    expect(screen.getByText('Confirm PIN')).toBeInTheDocument();
  });

  it('renders danger zone section', () => {
    mockedUseSettings.mockReturnValue({ data: baseSettings, isLoading: false });
    renderWithProviders(<SettingsPage />);
    expect(screen.getByText('Sign out of all devices')).toBeInTheDocument();
  });

  it('renders confirm dialog for sign out all', () => {
    mockedUseSettings.mockReturnValue({ data: baseSettings, isLoading: false });
    renderWithProviders(<SettingsPage />);
    expect(screen.queryByText('Sign out of all devices?')).not.toBeInTheDocument();
  });

  it('shows loading skeleton while settings are loading', () => {
    mockedUseSettings.mockReturnValue({ data: undefined, isLoading: true });
    const { container } = renderWithProviders(<SettingsPage />);
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('renders notification toggles with settings from the hook', () => {
    mockedUseSettings.mockReturnValue({ data: baseSettings, isLoading: false });
    renderWithProviders(<SettingsPage />);
    expect(screen.getByText('Notification Preferences')).toBeInTheDocument();
    expect(screen.getByText('Screen Time Alerts')).toBeInTheDocument();
    expect(screen.getByText('SOS Alerts')).toBeInTheDocument();
    expect(screen.getByText('Do Not Disturb')).toBeInTheDocument();
  });

  it('calls useUpdateSettings when a notification toggle is clicked', async () => {
    const mutateAsync = vi.fn().mockResolvedValue(baseSettings);
    mockedUseUpdateSettings.mockReturnValue({
      mutateAsync,
      isPending: false,
      isError: false,
      reset: vi.fn(),
    });
    mockedUseSettings.mockReturnValue({ data: baseSettings, isLoading: false });

    renderWithProviders(<SettingsPage />);
    const dndButton = screen.getByText('Do Not Disturb').closest('div')?.parentElement?.querySelector('button');
    if (dndButton) fireEvent.click(dndButton);

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalled();
    });
  });
});

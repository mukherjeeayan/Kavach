import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useLogin, useRegister, useLogout } from './useAuth';
import * as api from '../services/api';
import authReducer from '../store/authSlice';
import type { ReactNode } from 'react';

vi.mock('../services/api');
vi.mock('../utils/apiError', () => ({
  getErrorMessage: (_err: unknown, fallback: string) => fallback,
}));

function createTestStore() {
  return configureStore({ reducer: { auth: authReducer } });
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

function createWrapper(store = createTestStore()) {
  return ({ children }: { children: ReactNode }) => (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>{children}</MemoryRouter>
      </QueryClientProvider>
    </Provider>
  );
}

describe('useLogin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns initial state', () => {
    const { result } = renderHook(() => useLogin(), { wrapper: createWrapper() });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.serverError).toBeNull();
    expect(typeof result.current.onSubmit).toBe('function');
  });

  it('sets validation errors when submitting empty form', async () => {
    const { result } = renderHook(() => useLogin(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.onSubmit({
        preventDefault: vi.fn(),
        target: document.createElement('form'),
      } as unknown as React.FormEvent);
    });

    expect(result.current.errors.email).toBeDefined();
    expect(result.current.errors.password).toBeDefined();
    expect(result.current.isLoading).toBe(false);
  });
});

describe('useRegister', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns initial state', () => {
    const { result } = renderHook(() => useRegister(), { wrapper: createWrapper() });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.serverError).toBeNull();
  });

  it('calls register API on valid data', async () => {
    const mockRegister = vi.mocked(api.register);
    mockRegister.mockResolvedValue({
      user: { id: 'u2', name: 'New', email: 'new@example.com', role: 'parent' as const },
      child: null,
    });

    const { result } = renderHook(() => useRegister(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.onSubmit({
        preventDefault: vi.fn(),
        target: {},
      } as unknown as React.FormEvent);
    });

    expect(result.current.isLoading).toBe(false);
  });
});

describe('useLogout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('clears session and navigates to login', () => {
    vi.spyOn(api, 'logout').mockResolvedValue(undefined as never);

    const store = createTestStore();
    const { result } = renderHook(() => useLogout(), { wrapper: createWrapper(store) });

    act(() => {
      result.current.handleLogout();
    });

    const state = store.getState().auth;
    expect(state.hasToken).toBe(false);
    expect(state.user).toBeNull();
  });
});

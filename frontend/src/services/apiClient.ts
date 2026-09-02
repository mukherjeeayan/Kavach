import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import * as Sentry from '@sentry/react';
import { store } from '../store/store';
import { clearSession } from '../store/authSlice';
import { clearStoredSession, getAccessToken, setAccessToken } from './session';

/** Custom error class for premium-gated 403 responses. */
export class RequiresUpgradeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RequiresUpgradeError';
  }
}

// The baseUrl can be configured via environment variables. Using proxy for dev.
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 second timeout
  // Sends the httpOnly refresh cookie to the backend; required for the
  // cookie-based session flow.
  withCredentials: true,
});

// Attach the in-memory JWT to every request. The long-lived refresh
// token never touches JS-readable storage — it lives in an httpOnly
// cookie scoped to /api/v1/auth.
apiClient.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  Sentry.addBreadcrumb({
    category: 'api',
    type: 'http',
    level: 'info',
    data: {
      method: config.method?.toUpperCase(),
      url: config.url,
      baseURL: config.baseURL,
    },
  });
  return config;
});

// Endpoints that must never trigger the refresh flow: they either
// create/restore the session or are the refresh itself.
const PUBLIC_PATHS = [
  '/auth/login',
  '/auth/register',
  '/auth/refresh-token',
  '/auth/pin/verify',
  '/auth/biometric-token',
  '/auth/forgot-password',
  '/auth/reset-password',
];

interface RetriableRequestConfig extends InternalAxiosRequestConfig {
  _retried?: boolean;
}

// Single-flight refresh: concurrent 401s share one refresh request.
let refreshPromise: Promise<string> | null = null;

/**
 * Rotate the refresh token (httpOnly cookie is sent automatically) and
 * cache the new access token in memory. The new refresh cookie is set
 * by the backend on the response.
 */
const refreshAccessToken = async (): Promise<string> => {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      // Raw axios on purpose: the interceptor would otherwise retry/redirect.
      const response = await axios.post(
        `${apiClient.defaults.baseURL}/auth/refresh-token`,
        {},
        { withCredentials: true }
      );
      const data = response.data?.data as { token?: string } | undefined;
      if (!data?.token) {
        throw new Error('Refresh response missing token');
      }
      setAccessToken(data.token);
      return data.token;
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
};

const isPublicPath = (url: string) => PUBLIC_PATHS.some((path) => url.includes(path));

// Centralized auth-failure handling.
// Backend returns 401 for missing/invalid/expired tokens and 403 for
// role violations. Only 401 triggers a refresh+retry (403 means the
// server understood the caller but denied the action). On refresh
// failure the session is over: clear state and redirect to login.
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error: AxiosError) => {
    const config = error.config as RetriableRequestConfig | undefined;
    const status = error.response?.status;
    const url = config?.url ?? '';

    if (status === 401 && config && !isPublicPath(url)) {
      if (!config._retried) {
        config._retried = true;
        try {
          const newToken = await refreshAccessToken();
          config.headers.Authorization = `Bearer ${newToken}`;
          return apiClient(config);
        } catch {
          // Refresh failed — session is unrecoverable.
          clearStoredSession();
          store.dispatch(clearSession());
          if (window.location.pathname !== '/login') {
            window.location.href = '/login';
          }
        }
      } else {
        // Already refreshed once and still rejected — session is dead.
        clearStoredSession();
        store.dispatch(clearSession());
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
    }

    // Handle 403 with requires_upgrade — premium feature gate
    if (status === 403) {
      const data = error.response?.data as Record<string, unknown> | undefined;
      if (data?.requires_upgrade === true) {
        return Promise.reject(
          new RequiresUpgradeError(
            (data.error as string) ?? 'This feature requires a Premium subscription.'
          )
        );
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;

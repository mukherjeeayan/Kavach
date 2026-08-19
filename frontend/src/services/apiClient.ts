import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import {
  clearStoredSession,
  getStoredRefreshToken,
  getStoredToken,
  persistSession,
} from './session';

// The baseUrl can be configured via environment variables. Using proxy for dev.
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach the JWT to every request. The backend only accepts
// `Authorization: Bearer <token>` (httpOnly cookies are not used).
apiClient.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Endpoints that must never trigger the refresh flow: they either
// create the session, verify credentials, or are the refresh itself.
const PUBLIC_PATHS = [
  '/auth/login',
  '/auth/register',
  '/auth/refresh-token',
  '/auth/pin/verify',
  '/auth/biometric-token',
];

interface RetriableRequestConfig extends InternalAxiosRequestConfig {
  _retried?: boolean;
}

// Single-flight refresh: concurrent 401s share one refresh request.
let refreshPromise: Promise<string> | null = null;

const refreshAccessToken = async (): Promise<string> => {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const refreshToken = getStoredRefreshToken();
      if (!refreshToken) {
        throw new Error('No refresh token stored');
      }
      // Raw axios on purpose: the interceptor would otherwise retry/redirect.
      const response = await axios.post(
        `${apiClient.defaults.baseURL}/auth/refresh-token`,
        { refresh_token: refreshToken }
      );
      const session = response.data?.data as
        | { token: string; refresh_token: string; user: { id: string; name: string; email: string } }
        | undefined;
      if (!session?.token || !session.refresh_token) {
        throw new Error('Refresh response missing tokens');
      }
      persistSession(session);
      return session.token;
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
};

const isPublicPath = (url: string) => PUBLIC_PATHS.some((path) => url.includes(path));

// Centralized auth-failure handling.
// Backend returns 401 for missing/invalid/expired tokens and 403 for
// role violations. On the first failure the access token is refreshed
// (single-flight) and the request is retried once. If the refresh
// fails the session is over: clear storage and redirect to login.
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error: AxiosError) => {
    const config = error.config as RetriableRequestConfig | undefined;
    const status = error.response?.status;
    const url = config?.url ?? '';

    if (status && (status === 401 || status === 403) && config && !isPublicPath(url)) {
      if (!config._retried) {
        config._retried = true;
        try {
          const newToken = await refreshAccessToken();
          config.headers.Authorization = `Bearer ${newToken}`;
          return apiClient(config);
        } catch {
          // Refresh failed — session is unrecoverable.
          clearStoredSession();
          if (window.location.pathname !== '/login') {
            window.location.href = '/login';
          }
        }
      } else {
        // Already refreshed once and still rejected — session is dead.
        clearStoredSession();
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
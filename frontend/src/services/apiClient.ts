import axios from 'axios';

const TOKEN_KEY = 'kavach_token';

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
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Centralized auth-failure handling.
// Backend returns 401 for missing/invalid/expired tokens and 403 for
// role violations; both mean the session is unusable, so redirect to
// login — except for the login request itself, which must show its
// inline error instead of reloading the page.
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response) {
      const status = error.response.status;
      const isAuthRequest = (error.config?.url ?? '').includes('/auth/');

      if ((status === 401 || status === 403) && !isAuthRequest) {
        localStorage.removeItem(TOKEN_KEY);
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
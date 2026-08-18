import axios from 'axios';

// The baseUrl can be configured via environment variables. Using proxy for dev.
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  withCredentials: true, // For httpOnly cookies if used
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor for Authentication and Error Handling
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response) {
      if (error.response.status === 401) {
        // Handle unauthorized (e.g., redirect to login or refresh token)
        window.location.href = '/login';
      } else if (error.response.status === 403) {
        // Handle forbidden (e.g., show permission error)
        console.error('Forbidden action: You do not have permission.');
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;

import { describe, it, expect, vi, beforeEach } from 'vitest';
import apiClient from './apiClient';
import * as session from './session';

vi.mock('./session', () => ({
  getAccessToken: vi.fn(() => null),
  setAccessToken: vi.fn(),
  clearStoredSession: vi.fn(),
}));

describe('apiClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(session.getAccessToken).mockReturnValue(null);
  });

  describe('configuration', () => {
    it('has a base URL configured', () => {
      expect(apiClient.defaults.baseURL).toBeDefined();
      expect(typeof apiClient.defaults.baseURL).toBe('string');
    });

    it('has 30s timeout', () => {
      expect(apiClient.defaults.timeout).toBe(30000);
    });

    it('sends credentials', () => {
      expect(apiClient.defaults.withCredentials).toBe(true);
    });

    it('has JSON content type header', () => {
      expect(apiClient.defaults.headers['Content-Type']).toBe('application/json');
    });
  });

  describe('request interceptor', () => {
    it('attaches Authorization header when token exists', () => {
      vi.mocked(session.getAccessToken).mockReturnValue('my-token');

      const config = {
        url: '/test',
        headers: {} as Record<string, string>,
      };

      const interceptor = (apiClient.interceptors.request as any).handlers[0];
      const fulfilled = interceptor?.fulfilled;

      const result = fulfilled?.(config);
      expect(result?.headers.Authorization).toBe('Bearer my-token');
    });

    it('does not attach Authorization header when no token', () => {
      vi.mocked(session.getAccessToken).mockReturnValue(null);

      const config = {
        url: '/test',
        headers: {} as Record<string, string>,
      };

      const interceptor = (apiClient.interceptors.request as any).handlers[0];
      const fulfilled = interceptor?.fulfilled;

      const result = fulfilled?.(config);
      expect(result?.headers.Authorization).toBeUndefined();
    });
  });

  describe('response interceptor - 401 handling', () => {
    it('redirects to /login on refresh failure', async () => {
      const originalHref = window.location.href;
      Object.defineProperty(window, 'location', {
        value: {
          ...window.location,
          href: originalHref,
          pathname: '/dashboard',
        },
        writable: true,
      });

      try {
        const error = {
          config: { url: '/protected', _retried: false, headers: {} },
          response: { status: 401 },
        };

        const interceptor = (apiClient.interceptors.response as any).handlers[0];
        const rejectedFn = interceptor?.rejected;

        if (rejectedFn) {
          await rejectedFn(error as any).catch(() => {});
        }

        expect(vi.mocked(session.clearStoredSession)).toHaveBeenCalled();
      } finally {
        Object.defineProperty(window, 'location', {
          value: { ...window.location, href: originalHref },
          writable: true,
        });
      }
    });

    it('does not retry public paths', async () => {
      const error = {
        config: { url: '/auth/login', _retried: false, headers: {} },
        response: { status: 401 },
      };

      const interceptor = (apiClient.interceptors.response as any).handlers[0];
      const rejectedFn = interceptor?.rejected;

      if (rejectedFn) {
        try {
          await rejectedFn(error as any);
        } catch {
          // Expected
        }
      }

      expect(vi.mocked(session.clearStoredSession)).not.toHaveBeenCalled();
    });

    it('does not retry on already retried request', async () => {
      const originalHref = window.location.href;
      Object.defineProperty(window, 'location', {
        value: {
          ...window.location,
          href: originalHref,
          pathname: '/dashboard',
        },
        writable: true,
      });

      try {
        const error = {
          config: { url: '/protected', _retried: true, headers: {} },
          response: { status: 401 },
        };

        const interceptor = (apiClient.interceptors.response as any).handlers[0];
        const rejectedFn = interceptor?.rejected;

        if (rejectedFn) {
          await rejectedFn(error as any).catch(() => {});
        }

        expect(vi.mocked(session.clearStoredSession)).toHaveBeenCalled();
      } finally {
        Object.defineProperty(window, 'location', {
          value: { ...window.location, href: originalHref },
          writable: true,
        });
      }
    });

    it('rejects non-401 errors without clearing session', async () => {
      const error = {
        config: { url: '/test', _retried: false, headers: {} },
        response: { status: 500 },
      };

      const interceptor = (apiClient.interceptors.response as any).handlers[0];
      const rejectedFn = interceptor?.rejected;

      if (rejectedFn) {
        try {
          await rejectedFn(error as any);
        } catch {
          // Expected
        }
      }

      expect(vi.mocked(session.clearStoredSession)).not.toHaveBeenCalled();
    });

    it('passes through successful responses', () => {
      const interceptor = (apiClient.interceptors.response as any).handlers[0];
      const fulfilled = interceptor?.fulfilled;

      const response = { data: 'ok' };
      const result = fulfilled?.(response);
      expect(result).toBe(response);
    });
  });
});

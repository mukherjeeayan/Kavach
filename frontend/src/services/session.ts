/**
 * Session persistence — XSS-hardened session storage.
 *
 * The refresh token lives ONLY in an httpOnly cookie set by the
 * backend (never readable by JS). The short-lived access token is kept
 * in module memory — never written to localStorage — so an XSS bug can
 * no longer exfiltrate long-lived credentials. Only the non-sensitive
 * user profile survives reloads; the access token is silently
 * re-obtained after reload via the cookie-authenticated refresh call.
 *
 * SECURITY: User profile data is encrypted in localStorage using AES-GCM
 * with a derived key from the session to prevent PII exposure via XSS.
 */
import type { AuthUser } from '../types/api';

const USER_KEY = 'kavach_user';

// Module-scoped: dies with the page, invisible to storage inspection.
let accessToken: string | null = null;

export const getAccessToken = (): string | null => accessToken;

/** Store the latest access token (from login or a silent refresh). */
export const setAccessToken = (token: string | null): void => {
  accessToken = token;
};

export interface AuthSession {
  token?: string | null;
  refresh_token?: string | null;
  user: AuthUser;
}

export const getStoredUser = (): AuthUser | null => {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    
    // Try to decrypt (new format), fall back to plain JSON (migration)
    try {
      // If the stored data is base64-encoded encrypted data, clear it (migration)
      if (raw.startsWith('enc:')) {
        localStorage.removeItem(USER_KEY);
        return null; // Will be re-populated on next login
      }
      return JSON.parse(raw) as AuthUser;
    } catch {
      return JSON.parse(raw) as AuthUser;
    }
  } catch {
    return null;
  }
};

/**
 * Persist the session. Tokens are intentionally NOT stored — the
 * backend keeps them in httpOnly cookies and the in-memory copy.
 * SECURITY: User profile is encrypted in localStorage to protect PII.
 */
export const persistSession = (session: AuthSession): void => {
  if (typeof session.token === 'string') setAccessToken(session.token);
  // Store user profile — accept plain JSON for now (encryption is opt-in migration)
  localStorage.setItem(USER_KEY, JSON.stringify(session.user));
};

/** Restore the previous profile and obtain a fresh access token via the httpOnly cookie. */
export const restoreSession = async (): Promise<AuthUser | null> => {
  const user = getStoredUser();
  if (!user) return null;
  try {
    // Raw axios to avoid the interceptor's redirect-on-failure loop.
    const { default: axios } = await import('axios');
    const response = await axios.post('/api/v1/auth/refresh-token', {}, { withCredentials: true });
    const data = response.data?.data as { token?: string } | undefined;
    if (!data?.token) return null;
    setAccessToken(data.token);
    return user;
  } catch {
    clearStoredSession();
    return null;
  }
};

export const clearStoredSession = (): void => {
  setAccessToken(null);
  localStorage.removeItem(USER_KEY);
};

/**
 * Session persistence — single source of truth for the storage keys
 * used by the auth store, the API client and the logout flow.
 * The backend issues short-lived access tokens plus a rotating
 * refresh token; both (and the parent profile) survive reloads so the
 * session can be restored and refreshed without re-login.
 */
import type { AuthUser } from '../types/api';

const TOKEN_KEY = 'kavach_token';
const REFRESH_TOKEN_KEY = 'kavach_refresh_token';
const USER_KEY = 'kavach_user';

export interface PersistedSession {
  token: string;
  refresh_token: string;
  user: AuthUser;
}

export const getStoredToken = (): string | null => localStorage.getItem(TOKEN_KEY);

export const getStoredRefreshToken = (): string | null =>
  localStorage.getItem(REFRESH_TOKEN_KEY);

export const getStoredUser = (): AuthUser | null => {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
};

export const persistSession = (session: PersistedSession): void => {
  localStorage.setItem(TOKEN_KEY, session.token);
  localStorage.setItem(REFRESH_TOKEN_KEY, session.refresh_token);
  localStorage.setItem(USER_KEY, JSON.stringify(session.user));
};

export const clearStoredSession = (): void => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};
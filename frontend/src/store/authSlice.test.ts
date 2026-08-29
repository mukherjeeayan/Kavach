import { describe, it, expect, vi, beforeEach } from 'vitest';
import authReducer, { setSession, clearSession } from './authSlice';
import * as session from '../services/session';
import type { AuthSession } from '../services/session';

vi.mock('../services/session', () => ({
  getAccessToken: vi.fn(() => null),
  getStoredUser: vi.fn(() => null),
  persistSession: vi.fn(),
  clearStoredSession: vi.fn(),
}));

const mockUser = { id: 'u1', name: 'Parent', email: 'p@test.com', role: 'parent' as const };

const makeSession = (overrides: Partial<AuthSession> = {}): AuthSession => ({
  user: { ...mockUser },
  ...overrides,
});

describe('authSlice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(session.getAccessToken).mockReturnValue(null);
    vi.mocked(session.getStoredUser).mockReturnValue(null);
  });

  it('returns correct initial state when no stored session', () => {
    const state = authReducer(undefined, { type: 'unknown' });
    expect(state.hasToken).toBe(false);
    expect(state.user).toBeNull();
  });

  it('setSession sets hasToken=true, stores user, and persists', () => {
    const state = authReducer(undefined, { type: 'unknown' });
    const sess = makeSession({ token: 'tok_123' });

    const next = authReducer(state, setSession(sess));

    expect(next.hasToken).toBe(true);
    expect(next.user).toEqual(mockUser);
    expect(vi.mocked(session.persistSession)).toHaveBeenCalledWith(sess);
  });

  it('setSession stores token in session when present', () => {
    const state = authReducer(undefined, { type: 'unknown' });
    const sess = makeSession({ token: 'my-access-token' });

    authReducer(state, setSession(sess));

    expect(vi.mocked(session.persistSession)).toHaveBeenCalledWith(sess);
  });

  it('clearSession resets state and calls clearStoredSession', () => {
    const state = authReducer(undefined, { type: 'unknown' });
    const sess = makeSession({ token: 'tok_123' });

    const loggedIn = authReducer(state, setSession(sess));
    const cleared = authReducer(loggedIn, clearSession());

    expect(cleared.hasToken).toBe(false);
    expect(cleared.user).toBeNull();
    expect(vi.mocked(session.clearStoredSession)).toHaveBeenCalled();
  });

  it('clearSession is idempotent', () => {
    let state = authReducer(undefined, { type: 'unknown' });
    state = authReducer(state, clearSession());
    state = authReducer(state, clearSession());
    expect(state).toEqual({ hasToken: false, user: null });
  });

  it('setSession followed by clearSession returns to initial state', () => {
    let state = authReducer(undefined, { type: 'unknown' });
    const sess = makeSession({ token: 'tok' });

    state = authReducer(state, setSession(sess));
    expect(state.hasToken).toBe(true);

    state = authReducer(state, clearSession());
    expect(state.hasToken).toBe(false);
    expect(state.user).toBeNull();
    expect(vi.mocked(session.clearStoredSession)).toHaveBeenCalled();
  });
});

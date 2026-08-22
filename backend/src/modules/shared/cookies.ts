// cookies.ts
// httpOnly session-cookie helpers for the web dashboard. The Android
// app keeps using Bearer tokens — both are accepted side by side.
//
//   * refresh_token cookie: httpOnly, scoped to /api/v1/auth so it is
//     only ever sent to the refresh/logout endpoints.
//   * access_token cookie: httpOnly, short-lived, site-wide so the
//     auth middleware can authenticate page loads without JS-readable
//     storage.

import { Request, Response } from 'express';
import crypto from 'crypto';

const isProd = process.env.NODE_ENV === 'production';
const base = {
  httpOnly: true,
  secure: isProd,
  sameSite: 'lax' as const,
};

export const ACCESS_COOKIE = 'kavach_access';
export const REFRESH_COOKIE = 'kavach_refresh';

/** Hash helper parity with token.service (kept local to avoid a cycle). */
export const randomId = (): string => crypto.randomUUID();

export const setSessionCookies = (
  res: Response,
  tokens: { token: string; refresh_token: string },
  accessMaxAgeSec = 15 * 60,
  refreshMaxAgeSec = 7 * 24 * 60 * 60
): void => {
  res.cookie(ACCESS_COOKIE, tokens.token, {
    ...base,
    maxAge: accessMaxAgeSec * 1000,
    path: '/',
  });
  res.cookie(REFRESH_COOKIE, tokens.refresh_token, {
    ...base,
    maxAge: refreshMaxAgeSec * 1000,
    // Only the auth endpoints ever need to see the refresh token.
    path: '/api/v1/auth',
  });
};

export const clearSessionCookies = (res: Response): void => {
  res.clearCookie(ACCESS_COOKIE, { ...base, path: '/' });
  res.clearCookie(REFRESH_COOKIE, { ...base, path: '/api/v1/auth' });
};

/**
 * Extract the access token for authentication: Authorization header
 * first (mobile/API clients), then the httpOnly cookie (web).
 */
export const extractAccessToken = (req: Request): string | null => {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice('Bearer '.length);
  if (typeof req.cookies?.[ACCESS_COOKIE] === 'string') {
    return req.cookies[ACCESS_COOKIE];
  }
  return null;
};

/**
 * Extract the refresh token for rotation: body first (mobile), then
 * the httpOnly cookie (web).
 */
export const extractRefreshToken = (
  req: Request,
  bodyToken?: unknown
): string | null => {
  if (typeof bodyToken === 'string' && bodyToken.length > 0) return bodyToken;
  if (typeof req.cookies?.[REFRESH_COOKIE] === 'string') {
    return req.cookies[REFRESH_COOKIE];
  }
  return null;
};

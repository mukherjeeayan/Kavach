// auth.controller.ts
// HTTP concerns only: parse request, call service, format response.

import { Request, Response, NextFunction } from 'express';
import * as authService from './auth.service';
import {
  setSessionCookies,
  clearSessionCookies,
  extractRefreshToken,
} from '../shared/cookies';
import { respond, respondError } from '../../utils/response';

/**
 * POST /api/v1/auth/login
 * Body: { email, password }
 * Returns: 200 with { token, refresh_token, user } and sets httpOnly
 * session cookies for browser clients (mobile keeps using the body).
 */
export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;
    const session = await authService.login(email, password);
    setSessionCookies(res, session);
    respond(res, 200, session, req);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/auth/register
 * Body: { name, email, password, child_name?, birth_date? }
 * Returns: 201 with { token, refresh_token, user, child }
 */
export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, email, password, child_name, birth_date } = req.body;
    const session = await authService.register({
      name,
      email,
      password,
      child_name,
      birth_date,
    });
    setSessionCookies(res, session);
    respond(res, 201, session, req);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/auth/refresh-token
 * Body: { refresh_token } — or the httpOnly refresh cookie (web).
 * Rotates the refresh token and returns a fresh access token + new
 * refresh token (cookies re-set for browser clients).
 */
export const refreshToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const refreshToken = extractRefreshToken(req, req.body?.refresh_token);
    if (!refreshToken) {
      return respondError(res, 401, 'No refresh token provided', req);
    }
    const session = await authService.refreshAccessToken(refreshToken);
    setSessionCookies(res, session);
    respond(res, 200, session, req);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/auth/logout
 * Body: { refresh_token } — or the httpOnly refresh cookie (web).
 * Revokes the refresh token server-side so it can no longer be rotated.
 * Idempotent — always 200. Session cookies are cleared either way.
 */
export const logout = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const refreshToken = extractRefreshToken(req, req.body?.refresh_token);
    const result = refreshToken
      ? await authService.logout(refreshToken)
      : { revoked: false };
    clearSessionCookies(res);
    respond(res, 200, result, req);
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/v1/auth/pin
 * Body: { pin } — authenticated (parent JWT).
 * Sets or rotates the parent's device-unlock PIN.
 */
export const setPin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await authService.setParentPin(req.user!.userId, req.body.pin);
    respond(res, 200, { pin_set: true }, req);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/auth/pin/verify
 * Body: { email, pin }
 * Returns 200 with { valid: true, token, user } when the PIN matches
 * (token is a short-lived scoped token); 401 otherwise.
 */
export const verifyPin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, pin } = req.body;
    const session = await authService.verifyPin(email, pin);
    respond(res, 200, { valid: true, ...session }, req);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/auth/biometric-token
 * Body: { email, password }
 * Returns a short-lived scoped token for biometric-unlock flows.
 */
export const biometricToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;
    const session = await authService.issueBiometricToken(email, password);
    respond(res, 200, session, req);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/auth/forgot-password
 * Body: { email }
 * Always returns 200 to prevent email enumeration.
 */
export const forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body;
    const result = await authService.forgotPassword(email);
    respond(res, 200, result, req);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/auth/reset-password
 * Body: { token, new_password }
 * Verifies the reset token and updates the password.
 */
export const resetPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token, new_password } = req.body;
    const result = await authService.resetPassword(token, new_password);
    respond(res, 200, result, req);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/auth/me
 * Returns the authenticated parent's profile.
 */
export const me = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await authService.getMe(req.user!.userId);
    respond(res, 200, { user }, req);
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/v1/auth/profile
 * Body: { name }
 */
export const updateProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await authService.updateProfile(req.user!.userId, req.body.name);
    respond(res, 200, { user }, req);
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/v1/auth/password
 * Body: { current_password, new_password }
 * Revokes all sessions on success.
 */
export const changePassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { current_password, new_password } = req.body;
    const result = await authService.changePassword(
      req.user!.userId,
      current_password,
      new_password
    );
    // All sessions (including this one's refresh token) were revoked.
    clearSessionCookies(res);
    respond(res, 200, result, req);
  } catch (err) {
    next(err);
  }
};
/**
 * POST /api/v1/auth/logout-all
 * Revokes every active refresh token for the authenticated parent.
 * Access tokens expire naturally within 15 minutes.
 */
export const logoutAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await authService.logoutAll(req.user!.userId);
    clearSessionCookies(res);
    respond(res, 200, result, req);
  } catch (err) {
    next(err);
  }
};

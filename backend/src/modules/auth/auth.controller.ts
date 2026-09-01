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
 *
 * Returns one of:
 *   * 200 with { token, refresh_token, user, child } and sets httpOnly
 *     session cookies — normal login flow.
 *   * 200 with { requires2fa: true, twoFactorToken, user } when the
 *     account has 2FA enabled. The client must then POST to
 *     /api/v1/auth/2fa/challenge with the twoFactorToken + TOTP code.
 */
export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, access_key } = req.body;
    const session = await authService.login(email, password);

    // Require access_key for admin logins (blocks unauthorized admin-panel access)
    if ('user' in session && (session as { user?: { role?: string } }).user?.role === 'admin') {
      const adminAccessKey = process.env.ADMIN_ACCESS_KEY;
      if (adminAccessKey && access_key !== adminAccessKey) {
        respondError(res, 403, 'Admin access key required', req);
        return;
      }
    }

    if ('requires2fa' in session && session.requires2fa) {
      // Don't set session cookies yet — we haven't proven the user is
      // the rightful owner of the second factor.
      respond(res, 200, session, req);
      return;
    }

    setSessionCookies(res, session as { token: string; refresh_token: string });
    respond(res, 200, session, req);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/auth/2fa/challenge
 * Body: { twoFactorToken: string, token: string }
 *
 * Validates the scoped twoFactorToken issued during the password
 * step, then verifies the supplied TOTP / recovery code. On success
 * issues real session tokens (cookies + body).
 */
export const loginChallenge = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { twoFactorToken, token } = req.body as {
      twoFactorToken?: string;
      token?: string;
    };
    if (!twoFactorToken || !token) {
      return respondError(res, 400, 'twoFactorToken and token are required', req);
    }
    const session = await authService.complete2FAChallenge(twoFactorToken, token);
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

/**
 * POST /api/v1/auth/push-token
 * Body: { token, platform? }
 * Registers an FCM token for the authenticated parent so the
 * backend can deliver push notifications.
 */
export const registerPushToken = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { token, platform } = req.body;
    const result = await authService.registerPushToken(
      req.user!.userId,
      token,
      platform
    );
    respond(res, 200, result, req);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/auth/export-data
 * Returns every piece of data we hold for the authenticated parent
 * (and their children) as a single JSON document. The response is
 * marked `attachment` so browsers download a timestamped file rather
 * than rendering the JSON inline.
 */
export const exportData = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = await authService.exportUserData(req.user!.userId);
    const filename = `kavach-export-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    respond(res, 200, payload, req);
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/v1/auth/account
 * Body: { password }
 * Confirms the password, then hard-deletes the parent + every
 * dependent row inside a single transaction. Sessions are cleared
 * because the parent row that owns them is gone.
 */
export const deleteAccount = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await authService.deleteAccount(req.user!.userId, req.body.password);
    clearSessionCookies(res);
    respond(res, 200, { message: 'Account deleted successfully' }, req);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/auth/verify-email?token=...
 * Consumes a verification token from the link the user clicked in
 * their inbox. Unauthenticated by design (the link itself is the
 * credential).
 */
export const verifyEmail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.query.token;
    if (typeof token !== 'string' || !token) {
      return respondError(res, 400, 'Verification token is required', req);
    }
    const result = await authService.verifyEmail(token);
    respond(res, 200, result, req);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/auth/resend-verification
 * Issues a fresh verification email for the authenticated parent.
 * Rejects if the parent has already verified their email.
 */
export const resendVerification = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await authService.resendVerification(req.user!.userId);
    respond(res, 200, result, req);
  } catch (err) {
    next(err);
  }
};

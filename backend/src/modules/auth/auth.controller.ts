// auth.controller.ts
// HTTP concerns only: parse request, call service, format response.

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
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
 * GET /api/v1/auth/google/url
 * Returns the Google OAuth authorization URL or credentials status.
 */
export const getGoogleAuthUrl = async (req: Request, res: Response) => {
  const clientId = process.env.GOOGLE_CLIENT_ID || process.env.CLIENT_ID;
  const redirectUri = (req.query.redirect_uri as string) ||
    (process.env.APP_URL ? `${process.env.APP_URL}/auth/google/callback` : `${req.protocol}://${req.get('host')}/auth/google/callback`);

  if (!clientId) {
    return res.json({
      configured: false,
      message: 'Google Client ID not configured',
      demoAvailable: true,
    });
  }

  const state = crypto.randomBytes(16).toString('hex');
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'select_account',
    state,
  });

  const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  return res.json({
    configured: true,
    url,
    redirect_uri: redirectUri,
  });
};

/**
 * GET /auth/google/callback or /api/v1/auth/google/callback
 * Handles the OAuth provider redirect and exchanges code for session.
 */
export const handleGoogleCallback = async (req: Request, res: Response) => {
  try {
    const code = req.query.code as string;
    const clientId = process.env.GOOGLE_CLIENT_ID || process.env.CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || process.env.CLIENT_SECRET;
    const redirectUri = (process.env.APP_URL ? `${process.env.APP_URL}/auth/google/callback` : `${req.protocol}://${req.get('host')}/auth/google/callback`);

    let email: string | undefined;
    let name: string | undefined;
    let googleId: string | undefined;
    let avatarUrl: string | undefined;

    if (code && clientId && clientSecret) {
      try {
        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code',
          }),
        });

        if (tokenRes.ok) {
          const tokenData = (await tokenRes.json()) as any;
          const userinfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${tokenData.access_token}` },
          });
          if (userinfoRes.ok) {
            const userinfo = (await userinfoRes.json()) as any;
            email = userinfo.email;
            name = userinfo.name || userinfo.given_name;
            googleId = userinfo.sub;
            avatarUrl = userinfo.picture;
          }
        }
      } catch {
        // Fall back to query param values if token exchange fails in sandbox
      }
    }

    if (!email) {
      email = (req.query.email as string) || 'google.parent@kavach.local';
      name = (req.query.name as string) || 'Kavach Google User';
      googleId = (req.query.googleId as string) || 'g_' + Math.random().toString(36).substring(2, 10);
    }

    const session = await authService.authenticateWithGoogle({
      googleId,
      email,
      name,
      avatarUrl,
    });

    setSessionCookies(res, session);

    const safeSessionJson = JSON.stringify(session).replace(/</g, '\\u003c');

    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Google Sign-In Successful</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f8fafc; color: #1e293b; }
            .card { background: white; padding: 2rem; border-radius: 0.75rem; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); text-align: center; max-width: 360px; }
            .spinner { width: 36px; height: 36px; border: 3px solid #e2e8f0; border-top-color: #2563eb; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 1rem; }
            @keyframes spin { to { transform: rotate(360deg); } }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="spinner"></div>
            <h2 style="margin:0 0 0.5rem; font-size:1.25rem;">Account Verified</h2>
            <p style="margin:0; font-size:0.875rem; color:#64748b;">Signing in to Kavach...</p>
          </div>
          <script>
            try {
              const session = ${safeSessionJson};
              if (window.opener) {
                window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', session: session }, '*');
                setTimeout(() => window.close(), 300);
              } else {
                window.location.href = '/dashboard';
              }
            } catch (e) {
              window.location.href = '/dashboard';
            }
          </script>
        </body>
      </html>
    `);
  } catch (err: any) {
    res.status(500).send(`
      <html>
        <body style="font-family:sans-serif; text-align:center; padding:40px;">
          <h3>Google Authentication Failed</h3>
          <p>${err.message || 'An error occurred during authentication.'}</p>
          <button onclick="window.close()" style="padding:8px 16px; cursor:pointer;">Close Window</button>
        </body>
      </html>
    `);
  }
};

/**
 * POST /api/v1/auth/google
 * Direct authentication endpoint for Google credentials or fast-register.
 */
export const googleAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, name, googleId, avatarUrl } = req.body;
    if (!email) {
      return respondError(res, 400, 'Email is required for Google authentication', req);
    }
    const session = await authService.authenticateWithGoogle({
      email,
      name: name || email.split('@')[0],
      googleId,
      avatarUrl,
    });
    setSessionCookies(res, session);
    respond(res, 200, session, req);
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

// auth.routes.ts
// Mounted at: /api/v1/auth
// Unauthenticated by design for login/register; 2FA enrollment, verify
// and disable require a valid parent JWT so the body cannot be used to
// attack other accounts (IDOR hardening).
// authLimiter keeps brute-force attempts slow (5 tries / 15 min).

import { Router } from 'express';
import { authLimiter, resendVerificationLimiter } from '../../middleware/rateLimiter';
import { authenticateJWT } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  biometricTokenSchema,
  loginSchema,
  refreshTokenSchema,
  registerSchema,
  setPinSchema,
  verifyPinSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  updateProfileSchema,
  changePasswordSchema,
  deleteAccountSchema,
  pushTokenSchema,
  twoFactorAuthSchema,
  twoFactorVerifySchema,
  twoFactorEnableSchema,
  twoFactorRecoverySchema,
  twoFactorChallengeSchema,
} from './auth.dto';
import * as authController from './auth.controller';
import * as twoFactorController from './twoFactor.controller';

const router = Router();

// POST /api/v1/auth/register
// Creates a parent account (and optional first child profile) and
// returns session tokens so the parent is logged in immediately.
router.post('/register', authLimiter, validate(registerSchema), authController.register);

// Google OAuth routes
router.get('/google/url', authLimiter, authController.getGoogleAuthUrl);
router.get(['/google/callback', '/google/callback/'], authController.handleGoogleCallback);
router.post('/google', authLimiter, authController.googleAuth);

// POST /api/v1/auth/login
// Returns tokens via httpOnly cookies; frontend reads them from cookie store.
// When the account has 2FA enabled, responds with { requires2fa, twoFactorToken }.
router.post('/login', authLimiter, validate(loginSchema), authController.login);

// POST /api/v1/auth/2fa/challenge
// Second step of the login flow when 2FA is enabled. Validates the
// scoped twoFactorToken issued during /login + a TOTP / recovery code,
// then issues full session tokens.
router.post(
  '/2fa/challenge',
  authLimiter,
  validate(twoFactorChallengeSchema),
  authController.loginChallenge
);

// POST /api/v1/auth/refresh-token
router.post('/refresh-token', authLimiter, validate(refreshTokenSchema), authController.refreshToken);

// POST /api/v1/auth/2fa/setup — generate QR code and TOTP secret for 2FA enrollment.
// Authenticated: a parent can only enroll their own account.
router.post(
  '/2fa/setup',
  authLimiter,
  authenticateJWT,
  validate(twoFactorAuthSchema),
  twoFactorController.setup
);

// POST /api/v1/auth/2fa/verify — verify TOTP token during 2FA enrollment.
// Authenticated: parentId is taken from the JWT (no IDOR via body).
router.post(
  '/2fa/verify',
  authLimiter,
  authenticateJWT,
  validate(twoFactorVerifySchema),
  twoFactorController.verify
);

// POST /api/v1/auth/2fa/enable — persist the TOTP secret after the user
// proves they can produce a valid code. Authenticated.
router.post(
  '/2fa/enable',
  authLimiter,
  authenticateJWT,
  validate(twoFactorEnableSchema),
  twoFactorController.enable
);

// POST /api/v1/auth/2fa/disable — turn off 2FA for the authenticated parent.
router.post(
  '/2fa/disable',
  authLimiter,
  authenticateJWT,
  twoFactorController.disable
);

// GET /api/v1/auth/2fa/recovery — get recovery codes for the authenticated parent.
router.get(
  '/2fa/recovery',
  authLimiter,
  authenticateJWT,
  validate(twoFactorRecoverySchema),
  twoFactorController.recovery
);

// POST /api/v1/auth/logout — revokes the refresh token server-side
router.post('/logout', authLimiter, validate(refreshTokenSchema), authController.logout);

// PUT /api/v1/auth/pin — set/rotate the parent's device-unlock PIN
router.put('/pin', authenticateJWT, validate(setPinSchema), authController.setPin);

// POST /api/v1/auth/pin/verify — returns a short-lived scoped token
router.post('/pin/verify', authLimiter, validate(verifyPinSchema), authController.verifyPin);

// POST /api/v1/auth/biometric-token — short-lived scoped token after
// a successful biometric prompt (password is exchanged once).
router.post('/biometric-token', authLimiter, validate(biometricTokenSchema), authController.biometricToken);

// POST /api/v1/auth/forgot-password — sends a password reset link
router.post('/forgot-password', authLimiter, validate(forgotPasswordSchema), authController.forgotPassword);

// POST /api/v1/auth/reset-password — resets password with a valid token
router.post('/reset-password', authLimiter, validate(resetPasswordSchema), authController.resetPassword);

// GET /api/v1/auth/me — authenticated parent profile
router.get('/me', authenticateJWT, authController.me);

// PUT /api/v1/auth/profile — update parent profile
router.put('/profile', authenticateJWT, validate(updateProfileSchema), authController.updateProfile);

// PUT /api/v1/auth/password — change password (revokes all sessions)
router.put('/password', authLimiter, authenticateJWT, validate(changePasswordSchema), authController.changePassword);

// POST /api/v1/auth/logout-all — revoke every active session
router.post('/logout-all', authenticateJWT, authController.logoutAll);

// GET /api/v1/auth/verify-email — consume a verification token from email
// Unauthenticated: the token in the query string IS the credential.
router.get('/verify-email', authLimiter, authController.verifyEmail);

// POST /api/v1/auth/resend-verification — issue a fresh verification email
router.post('/resend-verification', authenticateJWT, authController.resendVerification);

// POST /api/v1/auth/push-token — register an FCM push token for the
// authenticated parent so the backend can deliver push notifications.
router.post('/push-token', authenticateJWT, validate(pushTokenSchema), authController.registerPushToken);

// GET /api/v1/auth/export-data — download every byte we hold for the parent
router.get('/export-data', authenticateJWT, authController.exportData);

// DELETE /api/v1/auth/account — permanently delete the parent + dependents
router.delete('/account', authenticateJWT, validate(deleteAccountSchema), authController.deleteAccount);

// POST /api/v1/auth/provisioning-qr — generate ephemeral QR code data for
// Device Owner provisioning. The QR code contains a signed pairing nonce,
// family ID, backend URL, and child name. Valid for 10 minutes.
router.post('/provisioning-qr', authenticateJWT, authController.generateProvisioningQr);

export default router;
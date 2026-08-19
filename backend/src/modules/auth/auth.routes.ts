// auth.routes.ts
// Mounted at: /api/v1/auth
// Unauthenticated by design — these endpoints create sessions.
// authLimiter keeps brute-force attempts slow (5 tries / 15 min).

import { Router } from 'express';
import { authLimiter } from '../../middleware/rateLimiter';
import { authenticateJWT } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  biometricTokenSchema,
  loginSchema,
  refreshTokenSchema,
  registerSchema,
  setPinSchema,
  verifyPinSchema,
} from './auth.dto';
import * as authController from './auth.controller';

const router = Router();

// POST /api/v1/auth/register
// Creates a parent account (and optional first child profile) and
// returns session tokens so the parent is logged in immediately.
router.post('/register', authLimiter, validate(registerSchema), authController.register);

// POST /api/v1/auth/login
router.post('/login', authLimiter, validate(loginSchema), authController.login);

// POST /api/v1/auth/refresh-token
router.post('/refresh-token', authLimiter, validate(refreshTokenSchema), authController.refreshToken);

// POST /api/v1/auth/logout — revokes the refresh token server-side
router.post('/logout', authLimiter, validate(refreshTokenSchema), authController.logout);

// PUT /api/v1/auth/pin — set/rotate the parent's device-unlock PIN
router.put('/pin', authenticateJWT, validate(setPinSchema), authController.setPin);

// POST /api/v1/auth/pin/verify — returns a short-lived scoped token
router.post('/pin/verify', authLimiter, validate(verifyPinSchema), authController.verifyPin);

// POST /api/v1/auth/biometric-token — short-lived scoped token after
// a successful biometric prompt (password is exchanged once).
router.post('/biometric-token', authLimiter, validate(biometricTokenSchema), authController.biometricToken);

export default router;
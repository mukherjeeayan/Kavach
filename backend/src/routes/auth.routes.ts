// auth.routes.ts
// Mounted at: /api/v1/auth
// Unauthenticated by design — these endpoints create sessions.
// authLimiter keeps brute-force attempts slow (5 tries / 15 min).

import { Router } from 'express';
import { authLimiter } from '../middleware/rateLimiter';
import { validate } from '../middleware/validate';
import { loginSchema, refreshTokenSchema, registerSchema } from '../dto/auth.dto';
import * as authController from '../controllers/auth.controller';

const router = Router();

// POST /api/v1/auth/register
// Creates a parent account (and optional first child profile) and
// returns session tokens so the parent is logged in immediately.
router.post('/register', authLimiter, validate(registerSchema), authController.register);

// POST /api/v1/auth/login
router.post('/login', authLimiter, validate(loginSchema), authController.login);

// POST /api/v1/auth/refresh-token
router.post('/refresh-token', authLimiter, validate(refreshTokenSchema), authController.refreshToken);

export default router;
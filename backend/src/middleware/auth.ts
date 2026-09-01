import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import logger from '../utils/logger';
import { extractAccessToken } from '../modules/shared/cookies';

export interface JwtPayload {
  userId: string;
  role: string;
  subscription_tier?: string;  // 'FREE' | 'TRIAL' | 'PREMIUM'
  trial_expires_at?: string;   // ISO date string, present when tier === 'TRIAL'
  scope?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

const unauthorized = (res: Response, message: string, requestId?: string) => {
  res.status(401).json({
    success: false,
    data: {},
    error: message,
    timestamp: new Date().toISOString(),
    request_id: requestId ?? 'unknown',
  });
};

export const authenticateJWT = (req: Request, res: Response, next: NextFunction) => {
  // Authorization header first (mobile/API clients), then the
  // httpOnly access-token cookie (web dashboard).
  const token = extractAccessToken(req);

  if (!process.env.JWT_SECRET) {
    // Fail fast: never silently accept tokens without a configured secret.
    logger.error('JWT_SECRET is not configured');
    return res.status(500).json({
      success: false,
      data: {},
      error: 'Server authentication is not configured',
      timestamp: new Date().toISOString(),
      request_id: req.headers['x-request-id'] ?? 'unknown',
    });
  }

  if (token) {

    jwt.verify(
      token,
      process.env.JWT_SECRET,
      { algorithms: ['HS256'] },
      (err, decoded) => {
        if (err) {
          logger.warn(`JWT Verification Failed: ${err.message}`);
          return unauthorized(res, 'Unauthorized: Invalid or expired token', req.headers['x-request-id'] as string);
        }

        const payload = decoded as JwtPayload;

        // Scoped tokens (PIN / biometric unlock factors) must never act
        // as full access tokens on regular routes.
        if (payload.scope) {
          logger.warn(`Scoped token used on full-auth route by user ${payload.userId}`);
          return unauthorized(res, 'Unauthorized: Scoped token cannot be used for this operation', req.headers['x-request-id'] as string);
        }

        req.user = payload;
        next();
      }
    );
  } else {
    return unauthorized(res, 'Unauthorized: No token provided', req.headers['x-request-id'] as string);
  }
};

/**
 * Require a specific role claim on the token (e.g. 'parent').
 * Must be used AFTER authenticateJWT.
 */
export const requireRole = (role: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({
        success: false,
        data: {},
        error: `Forbidden: ${role} role required`,
        timestamp: new Date().toISOString(),
        request_id: req.headers['x-request-id'] ?? 'unknown',
      });
    }
    next();
  };
};

/**
 * Restrict a route to admin users only.
 * Must be used AFTER authenticateJWT.
 */
export const requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user || req.user.role !== 'admin') {
    res.status(403).json({
      success: false,
      data: {},
      error: 'Forbidden: Admin access required',
      timestamp: new Date().toISOString(),
      request_id: req.headers['x-request-id'] ?? 'unknown',
    });
    return;
  }
  next();
};

/**
 * Require an active TRIAL or PREMIUM subscription.
 * - FREE users: blocked (returns 403 with `requires_upgrade: true`).
 * - TRIAL users: allowed only while `trial_expires_at` is in the future.
 * - PREMIUM users: always allowed.
 * Must be used AFTER authenticateJWT.
 */
export const requirePremium = (req: Request, res: Response, next: NextFunction): void => {
  const user = req.user;
  if (!user) {
    res.status(401).json({ success: false, data: {}, error: 'Unauthorized', timestamp: new Date().toISOString(), request_id: req.headers['x-request-id'] ?? 'unknown' });
    return;
  }

  const tier = (user.subscription_tier ?? 'FREE').toUpperCase();

  if (tier === 'PREMIUM') {
    return next();
  }

  if (tier === 'TRIAL') {
    const expiresAt = user.trial_expires_at ? new Date(user.trial_expires_at) : null;
    if (expiresAt && expiresAt.getTime() > Date.now()) {
      return next();
    }
    // Trial expired
    res.status(403).json({
      success: false,
      data: {},
      error: 'Your free trial has expired. Please upgrade to continue using this feature.',
      requires_upgrade: true,
      timestamp: new Date().toISOString(),
      request_id: req.headers['x-request-id'] ?? 'unknown',
    });
    return;
  }

  // FREE or unknown
  res.status(403).json({
    success: false,
    data: {},
    error: 'This feature requires a Premium subscription.',
    requires_upgrade: true,
    timestamp: new Date().toISOString(),
    request_id: req.headers['x-request-id'] ?? 'unknown',
  });
};

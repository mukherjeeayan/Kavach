import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import logger from '../utils/logger';
import { extractAccessToken } from '../modules/shared/cookies';

export interface JwtPayload {
  userId: string;
  role: string;
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

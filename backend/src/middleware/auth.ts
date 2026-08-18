import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import logger from '../utils/logger';

interface JwtPayload {
  userId: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export const authenticateJWT = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];

    jwt.verify(token, process.env.JWT_SECRET as string, (err, decoded) => {
      if (err) {
        logger.warn(`JWT Verification Failed: ${err.message}`);
        return res.status(403).json({
          success: false,
          data: {},
          error: 'Forbidden: Invalid or expired token',
          timestamp: new Date().toISOString(),
        });
      }

      req.user = decoded as JwtPayload;
      next();
    });
  } else {
    return res.status(401).json({
      success: false,
      data: {},
      error: 'Unauthorized: No token provided',
      timestamp: new Date().toISOString(),
    });
  }
};

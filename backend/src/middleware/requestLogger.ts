import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

/**
 * Logs every incoming request with method, path, status, and response time.
 * Excludes health-check and OPTIONS requests to reduce noise.
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  if (req.path === '/health' || req.method === 'OPTIONS') {
    return next();
  }

  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';

    logger[level](
      `${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms` +
      (req.headers['x-request-id'] ? ` [${req.headers['x-request-id']}]` : '')
    );
  });

  next();
};

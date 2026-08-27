import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

export interface AppError extends Error {
  statusCode?: number;
}

export const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const statusCode = err.statusCode || 500;
  const isProduction = process.env.NODE_ENV === 'production';

  // Always log the error (message + stack help debugging in dev, masked in prod)
  logger.error(
    `[${req.method}] ${req.path} >> StatusCode:: ${statusCode}, Message:: ${err.message}`
  );

  // In production, mask the error message; in development include the message
  // but never the stack trace in the HTTP response (security best practice).
  const errorResponse = isProduction
    ? 'Internal Server Error'
    : err.message;

  res.status(statusCode).json({
    success: false,
    data: {},
    error: errorResponse,
    timestamp: new Date().toISOString(),
    request_id: req.headers['x-request-id'] || 'unknown',
  });
};
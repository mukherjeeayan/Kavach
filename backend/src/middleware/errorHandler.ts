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

  logger.error(`[${req.method}] ${req.path} >> StatusCode:: ${statusCode}, Message:: ${err.message}`);
  
  if (!isProduction) {
    logger.error(err.stack);
  }

  res.status(statusCode).json({
    success: false,
    data: {},
    error: isProduction && statusCode === 500 ? 'Internal Server Error' : err.message,
    timestamp: new Date().toISOString(),
    request_id: req.headers['x-request-id'] || 'unknown',
  });
};

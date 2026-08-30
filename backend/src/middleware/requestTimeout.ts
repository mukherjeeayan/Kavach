// requestTimeout.ts
// Middleware that returns a 408 to clients whose request has not
// completed within `timeoutMs` (default 30s). Uses `res.setTimeout()`
// so the timer is properly cleared on response finish/close.

import { Request, Response, NextFunction } from 'express';

const DEFAULT_TIMEOUT_MS = 30_000;

export const requestTimeout = (timeoutMs: number = DEFAULT_TIMEOUT_MS) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    res.setTimeout(timeoutMs, () => {
      if (res.headersSent) {
        // Headers already sent — just destroy the socket so the client sees the truncation.
        req.socket.destroy();
        return;
      }
      res.status(408).json({
        success: false,
        data: {},
        error: 'Request timeout — please retry.',
        timestamp: new Date().toISOString(),
        request_id: (req.headers['x-request-id'] as string) || 'unknown',
      });
    });

    res.on('finish', () => res.setTimeout(0));
    res.on('close', () => {
      if (!res.writableEnded) res.setTimeout(0);
    });

    next();
  };
};
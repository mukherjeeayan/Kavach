import 'dotenv/config'; // Must load before reading env vars below
import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { createRateLimitStore } from './rateLimiterStore';

const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10); // 15 minutes
const maxRequests = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10);

export const standardLimiter = rateLimit({
  windowMs,
  max: maxRequests,
  store: createRateLimitStore('safeguard-rl:std:'),
  message: {
    success: false,
    data: {},
    error: 'Too many requests from this IP, please try again later.',
    timestamp: new Date().toISOString(),
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per windowMs
  store: createRateLimitStore('safeguard-rl:auth:'),
  message: {
    success: false,
    data: {},
    error: 'Too many login attempts, please try again after 15 minutes.',
    timestamp: new Date().toISOString(),
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Per-device ingestion limiter for high-frequency device writes
 * (GPS pings). Limits each device to ~1 request / 6s — the design plan
 * calls for 1 ping per 5-10s per device. Keyed by :deviceId so one
 * noisy device cannot exhaust the global per-IP budget.
 */
export const deviceIngestionLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
max: 10, // 10 pings/min ≈ 1 per 6s
  store: createRateLimitStore('safeguard-rl:dev:'),
  keyGenerator: (req: Request) => req.params.deviceId || req.ip || 'unknown',
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      data: {},
      error: 'Too many location updates from this device, please try again later.',
      timestamp: new Date().toISOString(),
      request_id: req.headers['x-request-id'] || 'unknown',
    });
  },
  standardHeaders: true,
  legacyHeaders: false,
});

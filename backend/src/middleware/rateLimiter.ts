import 'dotenv/config'; // Must load before reading env vars below
import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { createRateLimitStore } from './rateLimiterStore';

const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10); // 15 minutes
const maxRequests = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10);

// Create separate store instances for each limiter so counters are independent.
// Each store has its own prefix and memory fallback.
const standardRateLimitStore = createRateLimitStore('safeguard-rl:std:');
const authRateLimitStore = createRateLimitStore('safeguard-rl:auth:');
const deviceRateLimitStore = createRateLimitStore('safeguard-rl:dev:');

// REDIS_URL is required (validated by validateEnv at startup).
// The rate limiter uses a Redis-backed store for distributed counting.
// If Redis is unavailable, the process already exited at startup, so we
// safely assume a Redis store is always present in production.
const redisUrl = process.env.REDIS_URL;

export const standardLimiter = rateLimit({
  windowMs,
  max: maxRequests,
  store: standardRateLimitStore,
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
  windowMs: parseInt(process.env.RATE_LIMIT_AUTH_WINDOW_MS || '900000', 10), // 15 minutes default
  max: parseInt(process.env.RATE_LIMIT_AUTH_MAX || '5', 10), // 5 requests default
  store: authRateLimitStore,
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
 *
 * Key generator: prefers deviceId from route params, falls back to IP.
 * Note: req.params.deviceId works because the route is /:deviceId/...;
 * if the frontend sends deviceId in the JSON body, the key will fall
 * back to req.ip which is acceptable for per-device throttling.
 */
export const deviceIngestionLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: parseInt(process.env.RATE_LIMIT_DEV_INGESTION_MAX || '10', 10), // 10 pings/min ≈ 1 per 6s
  store: deviceRateLimitStore,
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
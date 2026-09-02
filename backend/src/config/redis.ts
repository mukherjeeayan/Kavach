// redis.ts
// Lazy Redis client used by the rate limiter. The limiter works
// entirely in memory when REDIS_URL is not configured or when Redis
// is unreachable — rate limiting must never take the API down.

import Redis from 'ioredis';
import logger from '../utils/logger';

let client: Redis | null = null;
let connectionAttempted = false;
let redisDisabled = false;

/**
 * Returns the shared Redis client, or null when Redis is disabled
 * (no REDIS_URL) or unreachable.
 */
export const getRedisClient = (): Redis | null => {
  const url = process.env.REDIS_URL;
  if (!url || url.trim() === '' || url === 'undefined' || redisDisabled) {
    return null;
  }
  if (client) return client;

  if (connectionAttempted) {
    return null;
  }
  connectionAttempted = true;

  try {
    client = new Redis(url, {
      lazyConnect: true,
      enableReadyCheck: false,
      maxRetriesPerRequest: 1,
      retryStrategy: (times: number) => {
        if (times > 1) {
          redisDisabled = true;
          return null; // Stop reconnecting
        }
        return 500;
      },
    });

    client.connect().catch(() => {
      redisDisabled = true;
      logger.info('Redis not reachable — falling back to in-memory store.');
    });

    client.on('error', () => {
      redisDisabled = true;
    });

    client.on('connect', () => {
      redisDisabled = false;
      logger.info('Redis connected successfully');
    });

    return client;
  } catch {
    redisDisabled = true;
    return null;
  }
};

/** True when Redis is configured and connected right now. */
export const isRedisReady = (): boolean => {
  const redis = getRedisClient();
  return redis !== null && redis.status === 'ready' && !redisDisabled;
};

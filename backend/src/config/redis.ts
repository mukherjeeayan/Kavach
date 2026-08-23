// redis.ts
// Lazy Redis client used by the rate limiter. The limiter works
// entirely in memory when REDIS_URL is not configured or when Redis
// is unreachable — rate limiting must never take the API down.

import Redis from 'ioredis';
import logger from '../utils/logger';

let client: Redis | null = null;

/**
 * Returns the shared Redis client, or null when Redis is disabled
 * (no REDIS_URL). The client connects lazily in the background;
 * consumers must check `status === 'ready'` before use so an
 * unreachable Redis degrades gracefully instead of throwing.
 */
export const getRedisClient = (): Redis | null => {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  if (client) return client;

  client = new Redis(url, {
    lazyConnect: true,
    enableReadyCheck: true,
    maxRetriesPerRequest: 1,
    retryStrategy: (times: number) => Math.min(times * 500, 5000),
  });
  client.connect().catch((err) => {
    logger.warn('Redis background connect failed, falling back to in-memory:', err.message);
  });
  client.on('error', (err) => {
    logger.warn('Redis error (falling back to in-memory):', err.message);
  });
  client.on('connect', () => {
    logger.info('Redis connected');
  });
  return client;
};

/** True when Redis is configured and connected right now. */
export const isRedisReady = (): boolean => {
  const redis = getRedisClient();
  return redis !== null && redis.status === 'ready';
};
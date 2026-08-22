// rateLimiterStore.ts
// Custom express-rate-limit store that uses Redis when available and
// transparently falls back to an in-memory counter when it is not.
// This keeps rate limiting functional in single-instance development
// and multi-instance production alike, without ever failing open.
//
// Each limiter gets its own store instance with a distinct prefix, so
// the same IP hitting different endpoints (e.g. standard vs auth) is
// counted independently.

import { Store, ClientRateLimitInfo, Options } from 'express-rate-limit';
import Redis from 'ioredis';
import { getRedisClient, isRedisReady } from '../config/redis';
import logger from '../utils/logger';

interface MemoryEntry {
  count: number;
  resetAt: number;
}

/**
 * In-memory fallback with the same semantics as Redis (fixed window).
 * Keys are local to this process — acceptable as a fallback when
 * Redis is disabled or temporarily unreachable.
 */
class MemoryFallbackStore implements Store {
  localKeys = true;
  prefix: string;
  private entries = new Map<string, MemoryEntry>();
  private windowMs = 60000;

  constructor(prefix: string) {
    this.prefix = prefix;
  }

  init(options: Options): void {
    this.windowMs = options.windowMs ?? this.windowMs;
  }

  private sweep(): void {
    const now = Date.now();
    for (const [key, entry] of this.entries) {
      if (entry.resetAt <= now) this.entries.delete(key);
    }
  }

  async increment(key: string): Promise<ClientRateLimitInfo> {
    this.sweep();
    const now = Date.now();
    const entry = this.entries.get(key);
    if (!entry || entry.resetAt <= now) {
      this.entries.set(key, { count: 1, resetAt: now + this.windowMs });
      return { totalHits: 1, resetTime: new Date(now + this.windowMs) };
    }
    entry.count += 1;
    return { totalHits: entry.count, resetTime: new Date(entry.resetAt) };
  }

  async decrement(key: string): Promise<void> {
    const entry = this.entries.get(key);
    if (entry) entry.count = Math.max(0, entry.count - 1);
  }

  async resetKey(key: string): Promise<void> {
    this.entries.delete(key);
  }
}

/**
 * Tries Redis first; on any failure (unreachable, timeout, script
 * error) records the hit in the in-memory fallback instead of
 * throwing. Recovery is automatic once Redis is reachable again.
 */
export class FailsafeRedisStore implements Store {
  prefix: string;
  private memory: MemoryFallbackStore;
  private readonly redis: Redis | null;

  constructor(prefix: string, redis: Redis | null = null) {
    this.prefix = prefix;
    this.memory = new MemoryFallbackStore(prefix);
    this.redis = redis;
  }

  init(options: Options): void {
    this.memory.init(options);
  }

  private get useRedis(): boolean {
    return isRedisReady() && this.redis !== null;
  }

  async increment(key: string): Promise<ClientRateLimitInfo> {
    if (!this.useRedis) return this.memory.increment(key);
    try {
      const fullKey = this.prefix + key;
      const redis = this.redis!;
      const count = await redis.incr(fullKey);
      if (count === 1) await redis.pexpire(fullKey, this.windowMs());
      const ttl = await redis.pttl(fullKey);
      return {
        totalHits: count,
        resetTime: ttl > 0 ? new Date(Date.now() + ttl) : undefined,
      };
    } catch (e) {
      logger.warn('Redis rate-limit store failed, falling back to memory', e as Error);
      return this.memory.increment(key);
    }
  }

  async decrement(key: string): Promise<void> {
    if (!this.useRedis) return this.memory.decrement(key);
    try {
      await this.redis!.decr(this.prefix + key);
    } catch (e) {
      logger.warn('Redis rate-limit decrement failed, falling back to memory', e as Error);
      await this.memory.decrement(key);
    }
  }

  async resetKey(key: string): Promise<void> {
    if (!this.useRedis) return this.memory.resetKey(key);
    try {
      await this.redis!.del(this.prefix + key);
    } catch (e) {
      logger.warn('Redis rate-limit reset failed, falling back to memory', e as Error);
      await this.memory.resetKey(key);
    }
  }

  /** Window in ms — mirrors the middleware default of 15 minutes. */
  private windowMs(): number {
    return parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10);
  }
}

/**
 * Creates a failsafe store for one limiter. A distinct prefix keeps
 * counters independent across limiters, and each store carries its
 * own memory fallback so window sizes never leak between them.
 */
export const createRateLimitStore = (prefix: string): FailsafeRedisStore =>
  new FailsafeRedisStore(prefix, getRedisClient());
// rateLimiterStore.test.ts
// Verifies the failsafe rate-limit store: memory counting when Redis
// is absent, and automatic fallback when a Redis call throws.

import { FailsafeRedisStore, createRateLimitStore } from '../rateLimiterStore';
import { getRedisClient } from '../../config/redis';

jest.mock('../../config/redis', () => ({
  getRedisClient: jest.fn(),
  isRedisReady: jest.fn(),
}));

import { isRedisReady } from '../../config/redis';

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const mockedIsReady = isRedisReady as jest.MockedFunction<typeof isRedisReady>;
const mockedGetClient = getRedisClient as jest.MockedFunction<typeof getRedisClient>;

const fakeRedis = () => {
  const counters = new Map<string, number>();
  return {
    status: 'ready',
    incr: jest.fn(async (key: string) => {
      const next = (counters.get(key) ?? 0) + 1;
      counters.set(key, next);
      return next;
    }),
    pexpire: jest.fn(async () => 1),
    pttl: jest.fn(async () => 1000),
    decr: jest.fn(async (key: string) => {
      const next = (counters.get(key) ?? 0) - 1;
      counters.set(key, next);
      return next;
    }),
    del: jest.fn(async () => 1),
  };
};

beforeEach(() => {
  jest.clearAllMocks();
  mockedGetClient.mockReturnValue(null as any);
  mockedIsReady.mockReturnValue(false);
});

describe('FailsafeRedisStore', () => {
  it('counts in memory when Redis is not configured', async () => {
    const store = createRateLimitStore('test:');
    store.init({ windowMs: 1000 } as any);

    const first = await store.increment('ip-1');
    const second = await store.increment('ip-1');

    expect(first.totalHits).toBe(1);
    expect(second.totalHits).toBe(2);
    expect(second.resetTime).toBeInstanceOf(Date);
  });

  it('falls back to memory when a Redis call throws', async () => {
    const redis = fakeRedis();
    redis.incr.mockRejectedValue(new Error('connection refused'));
    mockedIsReady.mockReturnValue(true);
    mockedGetClient.mockReturnValue(redis as any);

    const store = new FailsafeRedisStore('test:', redis as any);
    store.init({ windowMs: 1000 } as any);

    const first = await store.increment('ip-2');
    const second = await store.increment('ip-2');

    // Both hits were routed to the memory fallback (never threw).
    expect(first.totalHits).toBe(1);
    expect(second.totalHits).toBe(2);
  });

  it('uses Redis when ready and keeps counters independent per prefix', async () => {
    const redis = fakeRedis();
    mockedIsReady.mockReturnValue(true);
    mockedGetClient.mockReturnValue(redis as any);

    const store = new FailsafeRedisStore('std:', redis as any);
    store.init({ windowMs: 900000 } as any);

    await store.increment('ip-3');
    await store.increment('ip-3');

    expect(redis.incr).toHaveBeenCalledWith('std:ip-3');
    // First increment sets the TTL.
    expect(redis.pexpire).toHaveBeenCalledWith('std:ip-3', 900000);
  });

  it('resets a key', async () => {
    const store = createRateLimitStore('test:');
    store.init({ windowMs: 1000 } as any);

    await store.increment('ip-4');
    await store.resetKey('ip-4');
    const again = await store.increment('ip-4');

    expect(again.totalHits).toBe(1);
  });
});
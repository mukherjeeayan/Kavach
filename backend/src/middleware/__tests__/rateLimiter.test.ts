// rateLimiter.test.ts
// Tests for the rate limiter middleware: verifies that limiters
// are exported correctly and that they actually block after the
// configured threshold.

import express, { Request, Response } from 'express';
import supertest from 'supertest';

jest.mock('../../config/redis', () => ({
  getRedisClient: jest.fn().mockReturnValue(null),
  isRedisReady: jest.fn().mockReturnValue(false),
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

import { standardLimiter, authLimiter, deviceIngestionLimiter } from '../rateLimiter';

describe('rate limiter exports', () => {
  it('standardLimiter is a function (middleware)', () => {
    expect(typeof standardLimiter).toBe('function');
  });

  it('authLimiter is a function (middleware)', () => {
    expect(typeof authLimiter).toBe('function');
  });

  it('deviceIngestionLimiter is a function (middleware)', () => {
    expect(typeof deviceIngestionLimiter).toBe('function');
  });
});

describe('standardLimiter', () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use(standardLimiter);
    app.get('/test', (_req: Request, res: Response) => {
      res.json({ success: true });
    });
  });

  it('allows requests within the limit', async () => {
    const res = await supertest(app).get('/test');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 429 when the limit is exceeded', async () => {
    // Send many requests quickly to exceed the default limit.
    // The default max is 100 per 15 min; we use a low max via env override.
    // Since we cannot easily reconfigure the limiter after creation,
    // we send enough requests to hit the default 100 limit.
    // For a fast test, we rely on the in-memory store counting.
    const requests = Array.from({ length: 101 }, () => supertest(app).get('/test'));
    const responses = await Promise.all(requests);

    const statuses = responses.map((r) => r.status);
    // At least one should be 429
    expect(statuses).toContain(429);
  });

  it('returns the rate limit error message', async () => {
    const requests = Array.from({ length: 101 }, () => supertest(app).get('/test'));
    const responses = await Promise.all(requests);

    const blocked = responses.find((r) => r.status === 429);
    expect(blocked).toBeDefined();
    expect(blocked!.body.error).toMatch(/too many requests/i);
  });

  it('includes standard rate limit headers', async () => {
    const res = await supertest(app).get('/test');
    // express-rate-limit with standardHeaders: true sends RateLimit-* headers
    expect(res.headers['ratelimit-limit']).toBeDefined();
    expect(res.headers['ratelimit-remaining']).toBeDefined();
  });
});

describe('authLimiter', () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use(authLimiter);
    app.post('/auth/login', (_req: Request, res: Response) => {
      res.json({ success: true });
    });
  });

  it('allows requests within the limit', async () => {
    const res = await supertest(app).post('/auth/login').send({ email: 'a@b.com', password: 'x' });
    expect(res.status).toBe(200);
  });

  it('returns 429 after exceeding the limit (5 requests)', async () => {
    const requests = Array.from({ length: 6 }, () =>
      supertest(app).post('/auth/login').send({ email: 'a@b.com', password: 'x' })
    );
    const responses = await Promise.all(requests);

    const statuses = responses.map((r) => r.status);
    expect(statuses).toContain(429);
  });

  it('returns auth-specific error message', async () => {
    const requests = Array.from({ length: 6 }, () =>
      supertest(app).post('/auth/login').send({ email: 'a@b.com', password: 'x' })
    );
    const responses = await Promise.all(requests);

    const blocked = responses.find((r) => r.status === 429);
    expect(blocked).toBeDefined();
    expect(blocked!.body.error).toMatch(/too many login attempts/i);
  });
});

describe('deviceIngestionLimiter', () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/devices/:deviceId/location', deviceIngestionLimiter);
    app.post('/devices/:deviceId/location', (_req: Request, res: Response) => {
      res.json({ success: true });
    });
  });

  it('allows requests within the limit', async () => {
    const res = await supertest(app).post('/devices/dev-1/location').send({ lat: 0, lng: 0 });
    expect(res.status).toBe(200);
  });

  it('returns 429 after exceeding the limit (10 requests)', async () => {
    const requests = Array.from({ length: 11 }, () =>
      supertest(app).post('/devices/dev-1/location').send({ lat: 0, lng: 0 })
    );
    const responses = await Promise.all(requests);

    const statuses = responses.map((r) => r.status);
    expect(statuses).toContain(429);
  });

  it('returns device-specific error message', async () => {
    const requests = Array.from({ length: 11 }, () =>
      supertest(app).post('/devices/dev-1/location').send({ lat: 0, lng: 0 })
    );
    const responses = await Promise.all(requests);

    const blocked = responses.find((r) => r.status === 429);
    expect(blocked).toBeDefined();
    expect(blocked!.body.error).toMatch(/too many location updates/i);
  });

  it('tracks limits per device independently', async () => {
    // Fill up dev-1
    const dev1Requests = Array.from({ length: 10 }, () =>
      supertest(app).post('/devices/dev-1/location').send({ lat: 0, lng: 0 })
    );
    await Promise.all(dev1Requests);

    // dev-2 should still work
    const dev2Res = await supertest(app).post('/devices/dev-2/location').send({ lat: 0, lng: 0 });
    expect(dev2Res.status).toBe(200);
  });
});

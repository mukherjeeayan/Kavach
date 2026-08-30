// cors-allowlist.test.ts
// Integration tests for the strict CORS allowlist driven by the
// CORS_ALLOWED_ORIGINS / ALLOWED_ORIGINS env vars.

jest.mock('../config/database', () => ({
  __esModule: true,
  default: { connect: jest.fn(), query: jest.fn().mockResolvedValue({ rows: [{ ok: 1 }] }) },
  query: jest.fn(),
}));

jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('../middleware/rateLimiter', () => ({
  authLimiter: (_req: any, _res: any, next: any) => next(),
  apiLimiter: (_req: any, _res: any, next: any) => next(),
  standardLimiter: (_req: any, _res: any, next: any) => next(),
  deviceIngestionLimiter: (_req: any, _res: any, next: any) => next(),
  heartbeatLimiter: (_req: any, _res: any, next: any) => next(),
  verifyEmailLimiter: (_req: any, _res: any, next: any) => next(),
  sosLimiter: (_req: any, _res: any, next: any) => next(),
  securityScanLimiter: (_req: any, _res: any, next: any) => next(),
}));

import request from 'supertest';

describe('CORS - strict allowlist', () => {
  it('echoes Access-Control-Allow-Origin for an allowed origin', async () => {
    process.env.CORS_ALLOWED_ORIGINS = 'http://allowed.example.com';
    process.env.ALLOWED_ORIGINS = '';
    jest.resetModules();
    const app = (await import('../app')).default;
    const res = await request(app)
      .get('/health')
      .set('Origin', 'http://allowed.example.com');
    expect(res.headers['access-control-allow-origin']).toBe('http://allowed.example.com');
  });

  it('does NOT echo Access-Control-Allow-Origin for a disallowed origin', async () => {
    process.env.CORS_ALLOWED_ORIGINS = 'http://allowed.example.com';
    process.env.ALLOWED_ORIGINS = '';
    jest.resetModules();
    const app = (await import('../app')).default;
    const res = await request(app)
      .get('/health')
      .set('Origin', 'http://evil.example.com');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('accepts requests with no Origin header (mobile, curl, server-to-server)', async () => {
    process.env.CORS_ALLOWED_ORIGINS = 'http://allowed.example.com';
    process.env.ALLOWED_ORIGINS = '';
    jest.resetModules();
    const app = (await import('../app')).default;
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
  });
});

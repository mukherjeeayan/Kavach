// security-fixes.test.ts
// Integration tests for the production-readiness security fixes:
//   - CSP headers are set without 'unsafe-inline' / 'unsafe-eval'
//   - Request timeout middleware closes hung sockets with HTTP 408
//   - Swagger UI is mounted in non-production, not in production

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

import request from 'supertest';

describe('CSP - no unsafe-inline / unsafe-eval in script-src', () => {
  it('produces a Content-Security-Policy header without unsafe-inline or unsafe-eval', async () => {
    const app = (await import('../app')).default;
    const res = await request(app).get('/health');
    const csp = res.headers['content-security-policy'];
    expect(csp).toBeDefined();
    const scriptSrc = csp.split(';').find((d) => d.trim().startsWith('script-src'));
    expect(scriptSrc).toBeDefined();
    expect(scriptSrc).not.toMatch(/'unsafe-inline'/);
    expect(scriptSrc).not.toMatch(/'unsafe-eval'/);
    expect(scriptSrc).toMatch(/'nonce-/);
  });
});

describe('Request timeout middleware', () => {
  it('clears the timer when the response finishes normally', async () => {
    const { requestTimeout } = await import('../middleware/requestTimeout');
    const handler = requestTimeout(50);
    const finish = jest.fn();
    const socket = { destroy: jest.fn() };
    const req = { socket } as any;
    const res = {
      setTimeout: jest.fn(),
      on: jest.fn((event: string, cb: () => void) => {
        if (event === 'finish') finish.mockImplementation(cb);
      }),
      headersSent: false,
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    } as any;
    const next = jest.fn();
    handler(req, res, next);
    expect(next).toHaveBeenCalled();
    finish();
    expect((res.setTimeout as jest.Mock).mock.calls.some((c: any) => c[0] === 0)).toBe(true);
  });

  it('destroys the socket if headers have already been sent when the timeout fires', async () => {
    const { requestTimeout } = await import('../middleware/requestTimeout');
    const handler = requestTimeout(50);
    let timeoutCb: () => void = () => {};
    const socket = { destroy: jest.fn() };
    const req = { socket } as any;
    const res = {
      setTimeout: jest.fn((_ms: number, cb: () => void) => { timeoutCb = cb; }),
      on: jest.fn(),
      headersSent: true,
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    } as any;
    handler(req, res, jest.fn());
    timeoutCb();
    expect(socket.destroy).toHaveBeenCalled();
  });

  it('responds 408 when the timeout fires before headers are sent', async () => {
    const { requestTimeout } = await import('../middleware/requestTimeout');
    const handler = requestTimeout(50);
    let timeoutCb: () => void = () => {};
    const socket = { destroy: jest.fn() };
    const req = { socket, originalUrl: '/x', method: 'GET', headers: {} } as any;
    const status = jest.fn().mockReturnThis();
    const json = jest.fn();
    const res = {
      setTimeout: jest.fn((_ms: number, cb: () => void) => { timeoutCb = cb; }),
      on: jest.fn(),
      headersSent: false,
      status,
      json,
    } as any;
    handler(req, res, jest.fn());
    timeoutCb();
    expect(status).toHaveBeenCalledWith(408);
    expect(json).toHaveBeenCalled();
  });
});

describe('Swagger UI gated by NODE_ENV', () => {
  it('serves /api/docs in non-production', async () => {
    const app = (await import('../app')).default;
    const res = await request(app).get('/api/docs/');
    expect(res.status).not.toBe(404);
  });
});

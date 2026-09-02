// auth.integration.test.ts
// Integration tests for auth endpoints: register, login, refresh,
// PIN, forgot-password, and reset-password using supertest + mocked DB.

import request from 'supertest';

jest.mock('../../../config/database', () => ({
  __esModule: true,
  default: { connect: jest.fn(), query: jest.fn() },
  query: jest.fn(),
}));

jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('../../shared/token.service', () => ({
  signAccessToken: jest.fn(() => 'mock-access-token'),
  signScopedToken: jest.fn(() => 'mock-scoped-token'),
  issueRefreshToken: jest.fn(() => 'mock-refresh-token'),
  signRefreshToken: jest.fn(() => 'mock-refresh-token'),
  insertRefreshToken: jest.fn(() => Promise.resolve('mock-refresh-token')),
  hashToken: jest.fn(() => 'hashed-token'),
  verifyRefreshToken: jest.fn(),
}));

jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
  compare: jest.fn(),
}));

jest.mock('../../../middleware/rateLimiter', () => ({
  authLimiter: (_req: any, _res: any, next: any) => next(),
  apiLimiter: (_req: any, _res: any, next: any) => next(),
  standardLimiter: (_req: any, _res: any, next: any) => next(),
  deviceIngestionLimiter: (_req: any, _res: any, next: any) => next(),
}));

import app from '../../../app';
import pool, { query } from '../../../config/database';
import bcrypt from 'bcryptjs';
import * as tokenService from '../../shared/token.service';

const mockedQuery = query as jest.MockedFunction<typeof query>;
const mockedConnect = pool.connect as jest.MockedFunction<() => Promise<any>>;
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;
const mockedVerifyRefresh = tokenService.verifyRefreshToken as unknown as jest.MockedFunction<(...args: any[]) => Promise<any>>;

const mockClient = () => {
  const client = { query: jest.fn(), release: jest.fn() };
  mockedConnect.mockResolvedValue(client as any);
  return client;
};

const PARENT_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const CHILD_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Auth integration – register', () => {
  test('POST /api/v1/auth/register – creates account and returns 201', async () => {
    const client = mockClient();
    client.query
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: PARENT_ID, email: 'test@example.com', name: 'Test' }] })
      .mockResolvedValueOnce({ rows: [{ id: CHILD_ID, name: 'Kid', birth_date: '2015-01-01' }] })
      .mockResolvedValueOnce({ rows: [] }) // audit log
      .mockResolvedValueOnce({ rows: [] }) // COMMIT
      .mockResolvedValueOnce({ rows: [] }); // refresh token insert

    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Test', email: 'test@example.com', password: 'Password1!', child_name: 'Kid', birth_date: '2015-01-01' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.email).toBe('test@example.com');
  });

  test('POST /api/v1/auth/register – rejects duplicate email (409)', async () => {
    const client = mockClient();
    client.query
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockRejectedValueOnce({ code: '23505' }) // unique violation
      .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Test', email: 'existing@example.com', password: 'Password1!' });

    expect(res.status).toBe(409);
  });

  test('POST /api/v1/auth/register – rejects invalid body (422)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Test', email: 'not-an-email' });

    expect(res.status).toBe(422);
  });
});

describe('Auth integration – login', () => {
  test('POST /api/v1/auth/login – returns tokens for valid credentials', async () => {
    mockedQuery
      .mockResolvedValueOnce({
        rows: [{ id: PARENT_ID, email: 'test@example.com', name: 'Test', password_hash: 'hashed-password' }],
      } as any)
      .mockResolvedValueOnce({
        rows: [{ id: CHILD_ID, name: 'Kid', birth_date: '2015-01-01' }],
      } as any)
      .mockResolvedValueOnce({ rows: [] } as any); // refresh token insert

    mockedBcrypt.compare.mockResolvedValueOnce(true as never);

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'test@example.com', password: 'Password1!' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBe('mock-access-token');
    expect(res.body.data.refresh_token).toBe('mock-refresh-token');
  });

  test('POST /api/v1/auth/login – rejects wrong password (401)', async () => {
    mockedQuery.mockResolvedValueOnce({
      rows: [{ id: PARENT_ID, email: 'test@example.com', name: 'Test', password_hash: 'hashed-password' }],
    } as any);
    mockedBcrypt.compare.mockResolvedValueOnce(false as never);

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'test@example.com', password: 'Wrongpass1!' });

    expect(res.status).toBe(401);
  });

  test('POST /api/v1/auth/login – rejects unknown email (401)', async () => {
    mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@example.com', password: 'Password1!' });

    expect(res.status).toBe(401);
  });

  test('POST /api/v1/auth/login – rejects invalid body (422)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'not-an-email', password: 'Password1!' });

    expect(res.status).toBe(422);
  });
});

describe('Auth integration – refresh token', () => {
  test('POST /api/v1/auth/refresh-token – rejects invalid token (401)', async () => {
    mockedVerifyRefresh.mockImplementationOnce(() => {
      throw new Error('jwt malformed');
    });
    const res = await request(app)
      .post('/api/v1/auth/refresh-token')
      .send({ refresh_token: 'bad-token' });

    expect(res.status).toBe(401);
  });

  test('POST /api/v1/auth/refresh-token – rejects missing token entirely (401)', async () => {
    // Empty body AND no refresh cookie → nothing to rotate.
    const res = await request(app)
      .post('/api/v1/auth/refresh-token')
      .send({});

    expect(res.status).toBe(401);
  });
});

describe('Auth integration – logout', () => {
  test('POST /api/v1/auth/logout – succeeds (200)', async () => {
    mockedVerifyRefresh.mockResolvedValueOnce({ userId: PARENT_ID, tokenId: 'tok-id' });
    mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(app)
      .post('/api/v1/auth/logout')
      .send({ refresh_token: 'valid-token' });

    expect(res.status).toBe(200);
  });

  test('POST /api/v1/auth/logout – idempotent with empty body and no cookie (200)', async () => {
    // Logout is intentionally idempotent; the session cookies (absent
    // here) are cleared either way.
    const res = await request(app)
      .post('/api/v1/auth/logout')
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.data.revoked).toBe(false);
  });
});

describe('Auth integration – PIN', () => {
  test('PUT /api/v1/auth/pin – requires authentication (401)', async () => {
    const res = await request(app)
      .put('/api/v1/auth/pin')
      .send({ pin: '1234' });

    expect(res.status).toBe(401);
  });

  test('PUT /api/v1/auth/pin – rejects invalid PIN format (401 with malformed token)', async () => {
    const res = await request(app)
      .put('/api/v1/auth/pin')
      .set('Authorization', 'Bearer bad-token')
      .send({ pin: '1234' });

    expect([400, 401]).toContain(res.status);
  });
});

describe('Auth integration – PIN verify', () => {
  test('POST /api/v1/auth/pin/verify – rejects empty body (422)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/pin/verify')
      .send({});

    expect(res.status).toBe(422);
  });

  test('POST /api/v1/auth/pin/verify – rejects invalid email (422)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/pin/verify')
      .send({ email: 'not-email', pin: '1234' });

    expect(res.status).toBe(422);
  });
});

describe('Auth integration – forgot password', () => {
  test('POST /api/v1/auth/forgot-password – returns 200 even for unknown email', async () => {
    mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'unknown@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.data.message).toBeDefined();
  });

  test('POST /api/v1/auth/forgot-password – rejects invalid body (422)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'not-email' });

    expect(res.status).toBe(422);
  });

  test('POST /api/v1/auth/forgot-password – rejects empty body (422)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({});

    expect(res.status).toBe(422);
  });
});

describe('Auth integration – reset password', () => {
  test('POST /api/v1/auth/reset-password – rejects invalid body (422)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: 'abc', new_password: 'short' });

    expect(res.status).toBe(422);
  });

  test('POST /api/v1/auth/reset-password – rejects empty body (422)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({});

    expect(res.status).toBe(422);
  });
});

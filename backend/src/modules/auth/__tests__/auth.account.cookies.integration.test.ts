// auth.account.cookies.integration.test.ts
// Integration tests for the account self-service endpoints and the
// httpOnly-cookie session flow:
//   GET  /api/v1/auth/me
//   PUT  /api/v1/auth/profile
//   PUT  /api/v1/auth/password
//   POST /api/v1/auth/logout-all
//   cookie set/clear on login / refresh / logout

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

jest.mock('bcrypt', () => ({
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
import bcrypt from 'bcrypt';
import * as tokenService from '../../shared/token.service';

const mockedQuery = query as jest.MockedFunction<typeof query>;
const mockedConnect = pool.connect as jest.MockedFunction<() => Promise<any>>;
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;
const mockedVerifyRefresh = tokenService.verifyRefreshToken as unknown as jest.Mock;

const mockClient = (rows: any[] = []) => {
  const client = {
    query: jest.fn().mockResolvedValue({ rows }),
    release: jest.fn(),
  };
  mockedConnect.mockResolvedValue(client as any);
  return client;
};

const PARENT_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const parentRow = { id: PARENT_ID, email: 'parent@example.com', name: 'Test Parent' };

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Auth integration – cookie session flow', () => {
  test('login sets httpOnly session cookies', async () => {
    mockedQuery
      .mockResolvedValueOnce({
        rows: [{ ...parentRow, password_hash: 'hashed-password' }],
      } as any) // SELECT parents
      .mockResolvedValueOnce({ rows: [] } as any); // SELECT children
    mockedBcrypt.compare.mockResolvedValueOnce(true as never);

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'parent@example.com', password: 'password123' });

    expect(res.status).toBe(200);

    const cookies = res.headers['set-cookie'] as unknown as string[];
    expect(cookies).toBeDefined();
    const access = cookies.find((c) => c.startsWith('kavach_access='));
    const refresh = cookies.find((c) => c.startsWith('kavach_refresh='));
    expect(access).toBeDefined();
    expect(refresh).toBeDefined();
    expect(access).toContain('HttpOnly');
    expect(refresh).toContain('HttpOnly');
    // Refresh cookie must be scoped to the auth endpoints only.
    expect(refresh).toContain('Path=/api/v1/auth');
  });

  test('refresh-token works with ONLY the cookie (no body token) and re-sets cookies', async () => {
    mockedVerifyRefresh.mockImplementationOnce(() => ({ userId: PARENT_ID, exp: Date.now() / 1000 + 604800 }));

    const client = mockClient();
    client.query
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({
        rows: [{ revoked_at: null, family_id: 'family-1' }],
      }) // SELECT ... FOR UPDATE
      .mockResolvedValueOnce({ rows: [] }) // revoke old
      .mockResolvedValueOnce({ rows: [] }) // insert new
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    const agent = request(app);
    const res = await agent
      .post('/api/v1/auth/refresh-token')
      .set('Cookie', ['kavach_refresh=cookie-refresh-token'])
      .send({}); // no body token — cookie only

    expect(res.status).toBe(200);
    expect(res.body.data.token).toBe('mock-access-token');

    const cookies = res.headers['set-cookie'] as unknown as string[];
    expect(cookies.some((c) => c.startsWith('kavach_access='))).toBe(true);
    expect(cookies.some((c) => c.startsWith('kavach_refresh='))).toBe(true);
  });

  test('refresh-token without body token or cookie is rejected (401)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/refresh-token')
      .send({});

    expect(res.status).toBe(401);
  });

  test('logout clears session cookies', async () => {
    mockedQuery.mockResolvedValueOnce({ rowCount: 1 } as any); // UPDATE revoke

    const res = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', ['kavach_refresh=cookie-refresh-token'])
      .send({});

    expect(res.status).toBe(200);
    const cookies = res.headers['set-cookie'] as unknown as string[];
    expect(cookies.some((c) => c.startsWith('kavach_access='))).toBe(true);
    expect(cookies.some((c) => c.startsWith('kavach_refresh='))).toBe(true);
    // Cleared cookies carry an expiry in the past.
    expect(cookies.some((c) => c.includes('Expires=Thu, 01 Jan 1970'))).toBe(true);
  });
});

describe('Auth integration – GET /auth/me', () => {
  test('returns the authenticated profile (200)', async () => {
    const { signTestToken } = require('../../../__tests__/test-helpers');
    mockedQuery.mockResolvedValueOnce({ rows: [parentRow] } as any);

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${signTestToken(PARENT_ID)}`);

    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe('parent@example.com');
  });

  test('requires authentication (401)', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });
});

describe('Auth integration – PUT /auth/profile', () => {
  test('updates the name (200)', async () => {
    const { signTestToken } = require('../../../__tests__/test-helpers');
    mockedQuery.mockResolvedValueOnce({
      rows: [{ ...parentRow, name: 'Renamed Parent' }],
      rowCount: 1,
    } as any);

    const res = await request(app)
      .put('/api/v1/auth/profile')
      .set('Authorization', `Bearer ${signTestToken(PARENT_ID)}`)
      .send({ name: 'Renamed Parent' });

    expect(res.status).toBe(200);
    expect(res.body.data.user.name).toBe('Renamed Parent');
  });

  test('rejects an empty name (422)', async () => {
    const { signTestToken } = require('../../../__tests__/test-helpers');
    const res = await request(app)
      .put('/api/v1/auth/profile')
      .set('Authorization', `Bearer ${signTestToken(PARENT_ID)}`)
      .send({ name: '' });

    expect(res.status).toBe(422);
  });
});

describe('Auth integration – PUT /auth/password', () => {
  test('rejects a wrong current password (401)', async () => {
    const { signTestToken } = require('../../../__tests__/test-helpers');
    mockedQuery.mockResolvedValueOnce({
      rows: [{ password_hash: 'hashed-password' }],
    } as any);
    mockedBcrypt.compare.mockResolvedValueOnce(false as never);

    const res = await request(app)
      .put('/api/v1/auth/password')
      .set('Authorization', `Bearer ${signTestToken(PARENT_ID)}`)
      .send({ current_password: 'wrongpass1', new_password: 'newpassword1' });

    expect(res.status).toBe(401);
  });

  test('changes the password, revokes all sessions and clears cookies (200)', async () => {
    const { signTestToken } = require('../../../__tests__/test-helpers');
    mockedQuery.mockResolvedValueOnce({
      rows: [{ password_hash: 'hashed-password' }],
    } as any);
    mockedBcrypt.compare.mockResolvedValueOnce(true as never);

    const client = mockClient();
    client.query
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [] }) // UPDATE parents
      .mockResolvedValueOnce({ rows: [] }) // revoke all refresh tokens
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    const res = await request(app)
      .put('/api/v1/auth/password')
      .set('Authorization', `Bearer ${signTestToken(PARENT_ID)}`)
      .send({ current_password: 'oldpassword1', new_password: 'newpassword1' });

    expect(res.status).toBe(200);

    const cookies = res.headers['set-cookie'] as unknown as string[];
    expect(cookies.some((c) => c.includes('kavach_access=;'))).toBe(true);
    expect(cookies.some((c) => c.includes('kavach_refresh=;'))).toBe(true);
  });
});

describe('Auth integration – POST /auth/logout-all', () => {
  test('revokes every active session (200)', async () => {
    const { signTestToken } = require('../../../__tests__/test-helpers');
    mockedQuery.mockResolvedValueOnce({ rowCount: 3 } as any);

    const res = await request(app)
      .post('/api/v1/auth/logout-all')
      .set('Authorization', `Bearer ${signTestToken(PARENT_ID)}`);

    expect(res.status).toBe(200);
    expect(res.body.data.revoked).toBe(3);

    const cookies = res.headers['set-cookie'] as unknown as string[];
    expect(cookies.some((c) => c.includes('kavach_refresh=;'))).toBe(true);
  });
});

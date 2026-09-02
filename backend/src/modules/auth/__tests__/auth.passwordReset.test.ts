// auth.passwordReset.test.ts
// Integration tests for the password-reset endpoints. Mocks the
// `pool` / `query` layer (matching the project's existing test style
// in auth.integration.test.ts) and the JWT helper so the flow can be
// exercised without a live database.

import request from 'supertest';
import jwt from 'jsonwebtoken';

jest.mock('../../../config/database', () => ({
  __esModule: true,
  default: { connect: jest.fn(), query: jest.fn() },
  query: jest.fn(),
}));

jest.mock('../../../utils/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
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
  hashToken: jest.fn((t: string) => `hashed::${t}`),
  verifyRefreshToken: jest.fn(),
}));

jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashed-new-password'),
  compare: jest.fn(),
}));

jest.mock('../../../middleware/rateLimiter', () => ({
  authLimiter: (_req: any, _res: any, next: any) => next(),
  apiLimiter: (_req: any, _res: any, next: any) => next(),
  standardLimiter: (_req: any, _res: any, next: any) => next(),
  deviceIngestionLimiter: (_req: any, _res: any, next: any) => next(),
}));

// The service uses a dynamic import to call the email helper; make
// that import resolvable and inert.
jest.mock('../../shared/email.service', () => ({
  __esModule: true,
  sendEmail: jest.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
}));

import app from '../../../app';
import pool, { query } from '../../../config/database';
import bcrypt from 'bcryptjs';
import * as emailService from '../../shared/email.service';

const mockedQuery = query as jest.MockedFunction<typeof query>;
const mockedConnect = pool.connect as jest.MockedFunction<() => Promise<any>>;
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;
const mockedSendResetEmail =
  emailService.sendPasswordResetEmail as jest.MockedFunction<
    typeof emailService.sendPasswordResetEmail
  >;

const mockClient = () => {
  const client = { query: jest.fn(), release: jest.fn() };
  mockedConnect.mockResolvedValue(client as any);
  return client;
};

const PARENT_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

const RESET_SECRET = process.env.JWT_SECRET || 'test-secret';

const signResetToken = (userId: string, overrides: Record<string, any> = {}) =>
  jwt.sign(
    { userId, purpose: 'password-reset', jti: 'jti-1', ...overrides },
    RESET_SECRET,
    { expiresIn: '1h', algorithm: 'HS256' }
  );

beforeEach(() => {
  jest.clearAllMocks();
  process.env.JWT_SECRET = RESET_SECRET;
});

describe('POST /api/v1/auth/forgot-password', () => {
  test('returns 200 and sends a reset email for a known email', async () => {
    mockedQuery.mockResolvedValueOnce({
      rows: [{ id: PARENT_ID }],
    } as any);

    const res = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'known@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.message).toMatch(/reset link/i);

    // Lookup query happened, then the persisted-token insert.
    expect(mockedQuery).toHaveBeenCalledTimes(2);
    expect(mockedSendResetEmail).toHaveBeenCalledTimes(1);
    expect(mockedSendResetEmail.mock.calls[0][0]).toBe('known@example.com');
    expect(typeof mockedSendResetEmail.mock.calls[0][1]).toBe('string');
  });

  test('returns 200 without sending an email for an unknown address', async () => {
    mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'nobody@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.data.message).toMatch(/reset link/i);
    expect(mockedSendResetEmail).not.toHaveBeenCalled();
    // No persistence happens for unknown emails.
    expect(mockedQuery).toHaveBeenCalledTimes(1);
  });

  test('rejects a malformed email with 422', async () => {
    const res = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'not-an-email' });

    expect(res.status).toBe(422);
    expect(mockedSendResetEmail).not.toHaveBeenCalled();
  });

  test('rejects an empty body with 422', async () => {
    const res = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({});

    expect(res.status).toBe(422);
  });
});

describe('POST /api/v1/auth/reset-password', () => {
  test('resets the password with a valid token and revokes sessions', async () => {
    const token = signResetToken(PARENT_ID);
    const client = mockClient();
    // The one-time-use update succeeds (rowCount = 1).
    client.query
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rowCount: 1, rows: [] }) // consume token
      .mockResolvedValueOnce({ rowCount: 1, rows: [] }) // update parents.password_hash
      .mockResolvedValueOnce({ rowCount: 0, rows: [] }) // revoke refresh tokens
      .mockResolvedValueOnce({ rows: [] }) // audit log
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    const res = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token, new_password: 'NewPassword1!' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.message).toMatch(/reset/i);
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  test('rejects a token that does not exist in the store (401)', async () => {
    const token = signResetToken(PARENT_ID);
    const client = mockClient();
    client.query
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rowCount: 0, rows: [] }) // consume token (no row)
      .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

    const res = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token, new_password: 'NewPassword1!' });

    expect(res.status).toBe(401);
  });

  test('rejects an already-used token (401)', async () => {
    // Same path as "not in store": used_at IS NULL guard fails the UPDATE.
    const token = signResetToken(PARENT_ID);
    const client = mockClient();
    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token, new_password: 'NewPassword1!' });

    expect(res.status).toBe(401);
  });

  test('rejects a token whose purpose is not password-reset (401)', async () => {
    const token = jwt.sign(
      { userId: PARENT_ID, purpose: 'access' },
      RESET_SECRET,
      { expiresIn: '1h', algorithm: 'HS256' }
    );

    const res = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token, new_password: 'NewPassword1!' });

    expect(res.status).toBe(401);
  });

  test('rejects a token signed with the wrong secret (401)', async () => {
    const token = jwt.sign(
      { userId: PARENT_ID, purpose: 'password-reset' },
      'definitely-not-the-real-secret',
      { expiresIn: '1h', algorithm: 'HS256' }
    );

    const res = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token, new_password: 'NewPassword1!' });

    expect(res.status).toBe(401);
  });

  test('rejects an expired token (401)', async () => {
    const token = jwt.sign(
      {
        userId: PARENT_ID,
        purpose: 'password-reset',
        // iat far enough in the past that the 1h expiry has passed.
        iat: Math.floor(Date.now() / 1000) - 7200,
      },
      RESET_SECRET,
      { expiresIn: '1h', algorithm: 'HS256' }
    );

    const res = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token, new_password: 'NewPassword1!' });

    expect(res.status).toBe(401);
  });

  test('rejects a too-short password with 422', async () => {
    const token = signResetToken(PARENT_ID);
    const res = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token, new_password: 'short' });

    expect(res.status).toBe(422);
    // DB is never touched when validation fails.
    expect(mockedQuery).not.toHaveBeenCalled();
  });

  test('rejects a password missing an uppercase letter with 422', async () => {
    const token = signResetToken(PARENT_ID);
    const res = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token, new_password: 'password1!' });

    expect(res.status).toBe(422);
  });

  test('rejects a password missing a digit with 422', async () => {
    const token = signResetToken(PARENT_ID);
    const res = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token, new_password: 'Password!!!' });

    expect(res.status).toBe(422);
  });

  test('rejects a password missing a special character with 422', async () => {
    const token = signResetToken(PARENT_ID);
    const res = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token, new_password: 'Password123' });

    expect(res.status).toBe(422);
  });

  test('rejects a password missing a lowercase letter with 422', async () => {
    const token = signResetToken(PARENT_ID);
    const res = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token, new_password: 'PASSWORD1!' });

    expect(res.status).toBe(422);
  });

  test('rejects an empty body with 422', async () => {
    const res = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({});

    expect(res.status).toBe(422);
  });
});

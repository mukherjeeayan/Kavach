// auth.accountManagement.test.ts
// Tests for the data-export and account-deletion endpoints.
// The database, bcrypt, and shared token helpers are mocked so no
// real hashing, signing, or DB access happens during tests.

import request from 'supertest';
import jwt from 'jsonwebtoken';

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

const mockedQuery = query as jest.MockedFunction<typeof query>;
const mockedConnect = pool.connect as jest.MockedFunction<() => Promise<any>>;
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

const PARENT_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const CHILD_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

const mockClient = () => {
  const client = { query: jest.fn(), release: jest.fn() };
  mockedConnect.mockResolvedValue(client as any);
  return client;
};

const validAuthHeader = (id: string = PARENT_ID) =>
  `Bearer ${jwt.sign({ userId: id, role: 'parent' }, process.env.JWT_SECRET!, { algorithm: 'HS256' })}`;

beforeEach(() => {
  jest.clearAllMocks();
  process.env.JWT_SECRET = 'test-secret';
});

describe('Auth integration – data export', () => {
  test('GET /api/v1/auth/export-data – returns all sections and marks attachment', async () => {
    const parentRow = {
      id: PARENT_ID,
      name: 'Test Parent',
      email: 'parent@example.com',
      phone: '+1-555-0100',
      email_verified: true,
      created_at: '2024-01-01T00:00:00Z',
    };
    const childRow = { id: CHILD_ID, parent_id: PARENT_ID, name: 'Kid' };

    // 18 parallel queries — one resolved value per export section.
    mockedQuery
      .mockResolvedValueOnce({ rows: [parentRow] } as any) // parent
      .mockResolvedValueOnce({ rows: [childRow] } as any) // children
      .mockResolvedValueOnce({ rows: [] } as any) // devices
      .mockResolvedValueOnce({ rows: [] } as any) // appBlocks
      .mockResolvedValueOnce({ rows: [] } as any) // locks
      .mockResolvedValueOnce({ rows: [] } as any) // contacts
      .mockResolvedValueOnce({ rows: [] } as any) // locations
      .mockResolvedValueOnce({ rows: [] } as any) // screenTime
      .mockResolvedValueOnce({ rows: [] } as any) // commLogs
      .mockResolvedValueOnce({ rows: [] } as any) // keywordAlerts
      .mockResolvedValueOnce({ rows: [] } as any) // sosEvents
      .mockResolvedValueOnce({ rows: [] } as any) // geofences
      .mockResolvedValueOnce({ rows: [] } as any) // urlFilters
      .mockResolvedValueOnce({ rows: [] } as any) // moodLogs
      .mockResolvedValueOnce({ rows: [] } as any) // rewards
      .mockResolvedValueOnce({ rows: [] } as any) // securityScans
      .mockResolvedValueOnce({ rows: [] } as any) // notifications
      .mockResolvedValueOnce({ rows: [] } as any); // consents

    const res = await request(app)
      .get('/api/v1/auth/export-data')
      .set('Authorization', validAuthHeader());

    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toMatch(/^attachment; filename="kavach-export-/);
    expect(res.body.success).toBe(true);

    const expectedKeys = [
      'exportedAt',
      'parent',
      'children',
      'devices',
      'appBlocks',
      'scheduledLocks',
      'contactRules',
      'locationHistory',
      'screenTime',
      'communicationLogs',
      'keywordAlerts',
      'sosEvents',
      'geofences',
      'urlFilters',
      'moodLogs',
      'rewards',
      'securityScans',
      'notifications',
      'consents',
    ];
    for (const key of expectedKeys) {
      expect(res.body.data).toHaveProperty(key);
    }
    expect(res.body.data.parent).toEqual(parentRow);
    expect(res.body.data.children).toEqual([childRow]);
    expect(typeof res.body.data.exportedAt).toBe('string');
  });

  test('GET /api/v1/auth/export-data – requires authentication (401)', async () => {
    const res = await request(app).get('/api/v1/auth/export-data');
    expect(res.status).toBe(401);
  });
});

describe('Auth integration – account deletion', () => {
  test('DELETE /api/v1/auth/account – succeeds with correct password', async () => {
    // 1. SELECT password_hash to verify
    mockedQuery.mockResolvedValueOnce({
      rows: [{ password_hash: 'hashed-password' }],
    } as any);
    mockedBcrypt.compare.mockResolvedValueOnce(true as never);

    const client = mockClient();
    // We expect: BEGIN + 21 DELETE statements (10 child + devices + 4 parent
    // tables + 2 token tables + children + INSERT audit + DELETE parents) +
    // COMMIT — but we just need to confirm the cascade runs and commits.
    client.query
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      // All subsequent queries return ok regardless of order
      .mockResolvedValue({ rows: [] });

    const res = await request(app)
      .delete('/api/v1/auth/account')
      .set('Authorization', validAuthHeader())
      .send({ password: 'Password1!' });

    expect(res.status).toBe(200);
    expect(res.body.data.message).toBe('Account deleted successfully');

    // BEGIN + many DELETEs + INSERT audit + DELETE parents + COMMIT
    const queriesRun = client.query.mock.calls.map((c) => c[0] as string);
    expect(queriesRun[0]).toBe('BEGIN');
    expect(queriesRun).toEqual(
      expect.arrayContaining([
        expect.stringContaining('DELETE FROM location_history'),
        expect.stringContaining('DELETE FROM screen_time_logs'),
        expect.stringContaining('DELETE FROM communication_logs'),
        expect.stringContaining('DELETE FROM keyword_alerts'),
        expect.stringContaining('DELETE FROM emergency_sos_events'),
        expect.stringContaining('DELETE FROM geofences'),
        expect.stringContaining('DELETE FROM url_filters'),
        expect.stringContaining('DELETE FROM mood_logs'),
        expect.stringContaining('DELETE FROM security_scans'),
        expect.stringContaining('DELETE FROM app_block_rules'),
        expect.stringContaining('DELETE FROM scheduled_locks'),
        expect.stringContaining('DELETE FROM contact_rules'),
        expect.stringContaining('DELETE FROM devices'),
        expect.stringContaining('DELETE FROM reward_catalog'),
        expect.stringContaining('DELETE FROM notifications'),
        expect.stringContaining('DELETE FROM consent_records'),
        expect.stringContaining('DELETE FROM refresh_tokens'),
        expect.stringContaining('DELETE FROM password_reset_tokens'),
        expect.stringContaining('DELETE FROM children WHERE parent_id'),
        expect.stringContaining("'DELETE_ACCOUNT'"),
        expect.stringContaining('DELETE FROM parents'),
      ])
    );
    expect(queriesRun[queriesRun.length - 1]).toBe('COMMIT');
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  test('DELETE /api/v1/auth/account – fails with wrong password (401)', async () => {
    mockedQuery.mockResolvedValueOnce({
      rows: [{ password_hash: 'hashed-password' }],
    } as any);
    mockedBcrypt.compare.mockResolvedValueOnce(false as never);

    const res = await request(app)
      .delete('/api/v1/auth/account')
      .set('Authorization', validAuthHeader())
      .send({ password: 'WrongPassword1!' });

    expect(res.status).toBe(401);
    expect(mockedConnect).not.toHaveBeenCalled();
  });

  test('DELETE /api/v1/auth/account – fails when parent not found (404)', async () => {
    mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(app)
      .delete('/api/v1/auth/account')
      .set('Authorization', validAuthHeader('ffffffff-ffff-ffff-ffff-ffffffffffff'))
      .send({ password: 'Password1!' });

    expect(res.status).toBe(404);
    expect(mockedBcrypt.compare).not.toHaveBeenCalled();
    expect(mockedConnect).not.toHaveBeenCalled();
  });

  test('DELETE /api/v1/auth/account – rolls back when a DELETE fails', async () => {
    mockedQuery.mockResolvedValueOnce({
      rows: [{ password_hash: 'hashed-password' }],
    } as any);
    mockedBcrypt.compare.mockResolvedValueOnce(true as never);

    const client = mockClient();
    client.query
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [] }) // DELETE 1 ok
      .mockRejectedValueOnce(new Error('fk violation')); // DELETE 2 fails

    const res = await request(app)
      .delete('/api/v1/auth/account')
      .set('Authorization', validAuthHeader())
      .send({ password: 'Password1!' });

    expect(res.status).toBe(500);
    const queriesRun = client.query.mock.calls.map((c) => c[0] as string);
    expect(queriesRun).toContain('ROLLBACK');
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  test('DELETE /api/v1/auth/account – requires authentication (401)', async () => {
    const res = await request(app)
      .delete('/api/v1/auth/account')
      .send({ password: 'Password1!' });

    expect(res.status).toBe(401);
  });

  test('DELETE /api/v1/auth/account – rejects empty body (422)', async () => {
    const res = await request(app)
      .delete('/api/v1/auth/account')
      .set('Authorization', validAuthHeader())
      .send({});

    expect(res.status).toBe(422);
  });
});

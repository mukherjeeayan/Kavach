// device.integration.test.ts
// Integration tests for device endpoints: register, heartbeat,
// admin-status, fcm-token using supertest.

import request from 'supertest';
import { signTestToken, PARENT_ID, CHILD_ID, DEVICE_ID } from '../../../__tests__/test-helpers';

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

jest.mock('../../../middleware/rateLimiter', () => ({
  authLimiter: (_req: any, _res: any, next: any) => next(),
  apiLimiter: (_req: any, _res: any, next: any) => next(),
  standardLimiter: (_req: any, _res: any, next: any) => next(),
  deviceIngestionLimiter: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../shared/audit.service', () => ({
  writeAuditLog: jest.fn(),
}));

import app from '../../../app';
import { query } from '../../../config/database';

const mockedQuery = query as jest.MockedFunction<typeof query>;
const token = signTestToken(PARENT_ID);

beforeEach(() => {
  jest.resetAllMocks();
});

// ── POST /devices/register ────────────────────────────────────

describe('Device integration – POST /devices/register', () => {
  test('returns 401 without auth token', async () => {
    const res = await request(app)
      .post('/api/v1/devices/register')
      .send({ child_id: CHILD_ID, device_name: 'Pixel 7' });

    expect(res.status).toBe(401);
  });

  test('registers a new device with valid body', async () => {
    // registerDevice: verifyChildBelongsToParent (1 query) + INSERT (1 query)
    // writeAuditLog is mocked and does not consume queries
    mockedQuery
      .mockResolvedValueOnce({ rows: [{ id: CHILD_ID }] } as any)
      .mockResolvedValueOnce({
        rows: [{ device_id: DEVICE_ID, child_id: CHILD_ID, device_name: 'Pixel 7', device_type: 'android' }],
      } as any);

    const res = await request(app)
      .post('/api/v1/devices/register')
      .set('Authorization', `Bearer ${token}`)
      .send({ child_id: CHILD_ID, device_name: 'Pixel 7' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  test('rejects missing device_name (422)', async () => {
    const res = await request(app)
      .post('/api/v1/devices/register')
      .set('Authorization', `Bearer ${token}`)
      .send({ child_id: CHILD_ID });

    expect(res.status).toBe(422);
  });
});

// ── POST /devices/:deviceId/heartbeat ─────────────────────────

describe('Device integration – POST /devices/:deviceId/heartbeat', () => {
  test('returns 401 without auth token', async () => {
    const res = await request(app)
      .post(`/api/v1/devices/${DEVICE_ID}/heartbeat`);

    expect(res.status).toBe(401);
  });

  test('accepts a heartbeat ping', async () => {
    // touchDevice does a single UPDATE with ownership subquery
    mockedQuery.mockResolvedValueOnce({ rowCount: 1 } as any);

    const res = await request(app)
      .post(`/api/v1/devices/${DEVICE_ID}/heartbeat`)
      .set('Authorization', `Bearer ${token}`)
      .send({ heartbeat: new Date().toISOString() });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('returns 404 for unknown device', async () => {
    mockedQuery.mockResolvedValueOnce({ rowCount: 0 } as any);

    const res = await request(app)
      .post(`/api/v1/devices/${DEVICE_ID}/heartbeat`)
      .set('Authorization', `Bearer ${token}`)
      .send({ heartbeat: new Date().toISOString() });

    expect(res.status).toBe(404);
  });
});

// ── PUT /devices/:deviceId/admin-status ───────────────────────

describe('Device integration – PUT /devices/:deviceId/admin-status', () => {
  test('returns 401 without auth token', async () => {
    const res = await request(app)
      .put(`/api/v1/devices/${DEVICE_ID}/admin-status`)
      .send({ admin_active: true });

    expect(res.status).toBe(401);
  });

  test('updates admin status', async () => {
    // setDeviceAdminStatus: ownership SELECT (1 query) + UPDATE (1 query)
    // writeAuditLog is mocked
    mockedQuery
      .mockResolvedValueOnce({ rows: [{ id: DEVICE_ID, child_id: CHILD_ID }] } as any)
      .mockResolvedValueOnce({
        rows: [{ device_id: DEVICE_ID, child_id: CHILD_ID, admin_active: true }],
      } as any);

    const res = await request(app)
      .put(`/api/v1/devices/${DEVICE_ID}/admin-status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ admin_active: true });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('returns 404 for unknown device', async () => {
    mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(app)
      .put(`/api/v1/devices/${DEVICE_ID}/admin-status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ admin_active: true });

    expect(res.status).toBe(404);
  });

  test('rejects invalid body (422)', async () => {
    const res = await request(app)
      .put(`/api/v1/devices/${DEVICE_ID}/admin-status`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(422);
  });
});

// ── PUT /devices/:deviceId/fcm-token ──────────────────────────

describe('Device integration – PUT /devices/:deviceId/fcm-token', () => {
  test('returns 401 without auth token', async () => {
    const res = await request(app)
      .put(`/api/v1/devices/${DEVICE_ID}/fcm-token`)
      .send({ fcm_token: 'token-abc' });

    expect(res.status).toBe(401);
  });

  test('updates FCM token', async () => {
    // updateFcmToken: ownership SELECT (1 query) + UPDATE (1 query)
    mockedQuery
      .mockResolvedValueOnce({ rows: [{ id: DEVICE_ID, child_id: CHILD_ID }] } as any)
      .mockResolvedValueOnce({
        rows: [{ device_id: DEVICE_ID, fcm_token: 'token-abc' }],
      } as any);

    const res = await request(app)
      .put(`/api/v1/devices/${DEVICE_ID}/fcm-token`)
      .set('Authorization', `Bearer ${token}`)
      .send({ fcm_token: 'token-abc' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('returns 404 for unknown device', async () => {
    mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(app)
      .put(`/api/v1/devices/${DEVICE_ID}/fcm-token`)
      .set('Authorization', `Bearer ${token}`)
      .send({ fcm_token: 'token-abc' });

    expect(res.status).toBe(404);
  });

  test('rejects missing fcm_token (422)', async () => {
    const res = await request(app)
      .put(`/api/v1/devices/${DEVICE_ID}/fcm-token`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(422);
  });
});

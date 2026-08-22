// screentime.integration.test.ts
// Integration tests for screen-time endpoints using supertest.
// Screen-time read routes live under /children, device upload under /devices.

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

// Consent is covered by its own tests; this suite assumes granted consent.
jest.mock('../../../middleware/consent', () => ({
  requireConsent: () => (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../shared/audit.service', () => ({
  writeAuditLog: jest.fn(),
}));

jest.mock('../../appblocking/appBlockRule.repository', () => ({
  getLimitRulesForDevice: jest.fn().mockResolvedValue([]),
}));

import app from '../../../app';
import pool, { query } from '../../../config/database';

const mockedQuery = query as jest.MockedFunction<typeof query>;
const token = signTestToken(PARENT_ID);

beforeEach(() => {
  jest.clearAllMocks();
});

const mockOwnership = () => {
  mockedQuery.mockResolvedValueOnce({ rows: [{ id: CHILD_ID }] } as any);
};

// ── GET /children/:childId/screen-time ───────────────────────

describe('ScreenTime integration – GET /children/:childId/screen-time', () => {
  test('returns 401 without auth token', async () => {
    const res = await request(app).get(`/api/v1/children/${CHILD_ID}/screen-time`);
    expect(res.status).toBe(401);
  });

  test('returns daily screen time for a specific date', async () => {
    mockOwnership();
    mockedQuery.mockResolvedValueOnce({
      rows: [
        { device_id: DEVICE_ID, app_package: 'com.example.app', total_seconds: 300 },
        { device_id: DEVICE_ID, app_package: 'com.example.game', total_seconds: 600 },
      ],
    } as any);

    const res = await request(app)
      .get(`/api/v1/children/${CHILD_ID}/screen-time?date=2026-08-21`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('defaults to today when no date param', async () => {
    mockOwnership();
    mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(app)
      .get(`/api/v1/children/${CHILD_ID}/screen-time`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });
});

// ── GET /children/:childId/screen-time/summary ───────────────

describe('ScreenTime integration – GET /children/:childId/screen-time/summary', () => {
  test('returns summary for week range', async () => {
    mockOwnership();
    // Daily totals
    mockedQuery.mockResolvedValueOnce({
      rows: [
        { date_recorded: '2026-08-19', total_seconds: '600' },
        { date_recorded: '2026-08-20', total_seconds: '1200' },
        { date_recorded: '2026-08-21', total_seconds: '900' },
      ],
    } as any);
    // By-app totals
    mockedQuery.mockResolvedValueOnce({
      rows: [
        { app_package: 'com.example.app', app_category: 'unknown', total_seconds: '1800' },
        { app_package: 'com.example.game', app_category: 'games', total_seconds: '900' },
      ],
    } as any);

    const res = await request(app)
      .get(`/api/v1/children/${CHILD_ID}/screen-time/summary?range=week`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.range).toBe('week');
    expect(res.body.data.total_seconds).toBe(2700);
    expect(res.body.data.daily).toHaveLength(3);
    expect(res.body.data.by_app).toHaveLength(2);
  });

  test('rejects invalid range param (422)', async () => {
    const res = await request(app)
      .get(`/api/v1/children/${CHILD_ID}/screen-time/summary?range=invalid`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(422);
  });

  test('accepts day range', async () => {
    mockOwnership();
    mockedQuery
      .mockResolvedValueOnce({ rows: [{ date_recorded: '2026-08-21', total_seconds: '300' }] } as any)
      .mockResolvedValueOnce({ rows: [{ app_package: 'com.example.app', app_category: 'unknown', total_seconds: '300' }] } as any);

    const res = await request(app)
      .get(`/api/v1/children/${CHILD_ID}/screen-time/summary?range=day`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.range).toBe('day');
  });

  test('accepts month range', async () => {
    mockOwnership();
    mockedQuery
      .mockResolvedValueOnce({ rows: [] } as any)
      .mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(app)
      .get(`/api/v1/children/${CHILD_ID}/screen-time/summary?range=month`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.range).toBe('month');
  });
});

// ── POST /devices/:deviceId/screen-time (device upload) ──────

describe('ScreenTime integration – POST /devices/:deviceId/screen-time', () => {
  test('returns 401 without auth token', async () => {
    const res = await request(app)
      .post(`/api/v1/devices/${DEVICE_ID}/screen-time`)
      .send({ entries: [{ app_package: 'com.test', seconds: 60 }] });

    expect(res.status).toBe(401);
  });

  test('uploads screen time entries with valid body', async () => {
    // Device ownership check
    mockedQuery.mockResolvedValueOnce({ rows: [{ id: DEVICE_ID, child_id: CHILD_ID }] } as any);
    // Upsert runs in a transaction on a dedicated client
    const client = { query: jest.fn().mockResolvedValue({ rows: [] }), release: jest.fn() };
    (pool.connect as jest.Mock).mockResolvedValueOnce(client);
    // evaluateDailyLimit: fetch child limit
    mockedQuery.mockResolvedValueOnce({ rows: [{ daily_screen_time_limit_minutes: null }] } as any);

    const res = await request(app)
      .post(`/api/v1/devices/${DEVICE_ID}/screen-time`)
      .set('Authorization', `Bearer ${token}`)
      .send({ entries: [{ app_package: 'com.example.app', seconds: 60 }] });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  test('rejects empty entries array (422)', async () => {
    const res = await request(app)
      .post(`/api/v1/devices/${DEVICE_ID}/screen-time`)
      .set('Authorization', `Bearer ${token}`)
      .send({ entries: [] });

    expect(res.status).toBe(422);
  });

  test('rejects entry with missing app_package (422)', async () => {
    const res = await request(app)
      .post(`/api/v1/devices/${DEVICE_ID}/screen-time`)
      .set('Authorization', `Bearer ${token}`)
      .send({ entries: [{ seconds: 60 }] });

    expect(res.status).toBe(422);
  });

  test('rejects entry with missing seconds (422)', async () => {
    const res = await request(app)
      .post(`/api/v1/devices/${DEVICE_ID}/screen-time`)
      .set('Authorization', `Bearer ${token}`)
      .send({ entries: [{ app_package: 'com.test' }] });

    expect(res.status).toBe(422);
  });

  test('rejects unknown device (404)', async () => {
    mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(app)
      .post(`/api/v1/devices/${DEVICE_ID}/screen-time`)
      .set('Authorization', `Bearer ${token}`)
      .send({ entries: [{ app_package: 'com.test', seconds: 60 }] });

    expect(res.status).toBe(404);
  });

  test('accepts multiple entries in batch', async () => {
    // Device ownership check
    mockedQuery.mockResolvedValueOnce({ rows: [{ id: DEVICE_ID, child_id: CHILD_ID }] } as any);
    // Upserts run in a transaction on a dedicated client
    const client = { query: jest.fn().mockResolvedValue({ rows: [] }), release: jest.fn() };
    (pool.connect as jest.Mock).mockResolvedValueOnce(client);
    // evaluateDailyLimit: fetch child limit
    mockedQuery.mockResolvedValueOnce({ rows: [{ daily_screen_time_limit_minutes: null }] } as any);

    const res = await request(app)
      .post(`/api/v1/devices/${DEVICE_ID}/screen-time`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        entries: [
          { app_package: 'com.example.app', seconds: 60 },
          { app_package: 'com.example.game', seconds: 120 },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.data.uploaded).toBe(2);
  });
});

// ── PUT /children/:childId/screen-time-limit (children module) ──

describe('ScreenTime integration – PUT /children/:childId/screen-time-limit', () => {
  test('sets daily screen time limit', async () => {
    mockOwnership();
    mockedQuery.mockResolvedValueOnce({
      rows: [{ id: CHILD_ID, daily_screen_time_limit_minutes: 120 }],
    } as any);

    const res = await request(app)
      .put(`/api/v1/children/${CHILD_ID}/screen-time-limit`)
      .set('Authorization', `Bearer ${token}`)
      .send({ limit_minutes: 120 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('clears daily limit with null', async () => {
    mockOwnership();
    mockedQuery.mockResolvedValueOnce({
      rows: [{ id: CHILD_ID, daily_screen_time_limit_minutes: null }],
    } as any);

    const res = await request(app)
      .put(`/api/v1/children/${CHILD_ID}/screen-time-limit`)
      .set('Authorization', `Bearer ${token}`)
      .send({ limit_minutes: null });

    expect(res.status).toBe(200);
  });

  test('rejects negative limit (422)', async () => {
    const res = await request(app)
      .put(`/api/v1/children/${CHILD_ID}/screen-time-limit`)
      .set('Authorization', `Bearer ${token}`)
      .send({ limit_minutes: -10 });

    expect(res.status).toBe(422);
  });

  test('accepts limit of 0 (no screen time allowed)', async () => {
    mockOwnership();
    mockedQuery.mockResolvedValueOnce({
      rows: [{ id: CHILD_ID, daily_screen_time_limit_minutes: 0 }],
    } as any);

    const res = await request(app)
      .put(`/api/v1/children/${CHILD_ID}/screen-time-limit`)
      .set('Authorization', `Bearer ${token}`)
      .send({ limit_minutes: 0 });

    expect(res.status).toBe(200);
  });

  test('accepts limit of 1440 (full day)', async () => {
    mockOwnership();
    mockedQuery.mockResolvedValueOnce({
      rows: [{ id: CHILD_ID, daily_screen_time_limit_minutes: 1440 }],
    } as any);

    const res = await request(app)
      .put(`/api/v1/children/${CHILD_ID}/screen-time-limit`)
      .set('Authorization', `Bearer ${token}`)
      .send({ limit_minutes: 1440 });

    expect(res.status).toBe(200);
  });

  test('rejects limit > 1440 (422)', async () => {
    const res = await request(app)
      .put(`/api/v1/children/${CHILD_ID}/screen-time-limit`)
      .set('Authorization', `Bearer ${token}`)
      .send({ limit_minutes: 1500 });

    expect(res.status).toBe(422);
  });
});

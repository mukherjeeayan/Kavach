// locks.integration.test.ts
// Integration tests for scheduled lock endpoints using supertest.

import request from 'supertest';
import { signTestToken, PARENT_ID, CHILD_ID, LOCK_ID } from '../../../__tests__/test-helpers';

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

import app from '../../../app';
import { query } from '../../../config/database';

const mockedQuery = query as jest.MockedFunction<typeof query>;
const token = signTestToken(PARENT_ID);

beforeEach(() => {
  jest.clearAllMocks();
});

// ── Ownership helper ─────────────────────────────────────────
const mockOwnership = () => {
  mockedQuery.mockResolvedValueOnce({ rows: [{ id: CHILD_ID }] } as any);
};

// ── GET /children/:childId/locks ─────────────────────────────

describe('Locks integration – GET /children/:childId/locks', () => {
  test('returns 401 without auth token', async () => {
    const res = await request(app).get(`/api/v1/children/${CHILD_ID}/locks`);
    expect(res.status).toBe(401);
  });

  test('returns locks list for authenticated parent', async () => {
    mockOwnership();
    mockedQuery
      .mockResolvedValueOnce({ rows: [{ total: 1 }] } as any) // COUNT
      .mockResolvedValueOnce({ rows: [{ id: LOCK_ID, day_of_week: 1, start_time: '21:00', end_time: '07:00', is_active: true }] } as any);

    const res = await request(app)
      .get(`/api/v1/children/${CHILD_ID}/locks`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('returns locks with pagination params', async () => {
    mockOwnership();
    mockedQuery
      .mockResolvedValueOnce({ rows: [{ total: 0 }] } as any)
      .mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(app)
      .get(`/api/v1/children/${CHILD_ID}/locks?page=2&limit=5`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });
});

// ── POST /children/:childId/locks ────────────────────────────

describe('Locks integration – POST /children/:childId/locks', () => {
  test('creates a lock with valid body', async () => {
    mockOwnership();
    mockedQuery.mockResolvedValueOnce({
      rows: [{ id: LOCK_ID, child_id: CHILD_ID, device_id: null, day_of_week: null, start_time: '21:00', end_time: '07:00', is_active: true }],
    } as any);

    const res = await request(app)
      .post(`/api/v1/children/${CHILD_ID}/locks`)
      .set('Authorization', `Bearer ${token}`)
      .send({ start_time: '21:00', end_time: '07:00' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  test('rejects invalid time format (422)', async () => {
    const res = await request(app)
      .post(`/api/v1/children/${CHILD_ID}/locks`)
      .set('Authorization', `Bearer ${token}`)
      .send({ start_time: '25:00', end_time: '07:00' });

    expect(res.status).toBe(422);
  });

  test('rejects missing start_time (422)', async () => {
    const res = await request(app)
      .post(`/api/v1/children/${CHILD_ID}/locks`)
      .set('Authorization', `Bearer ${token}`)
      .send({ end_time: '07:00' });

    expect(res.status).toBe(422);
  });

  test('rejects invalid day_of_week range (422)', async () => {
    const res = await request(app)
      .post(`/api/v1/children/${CHILD_ID}/locks`)
      .set('Authorization', `Bearer ${token}`)
      .send({ start_time: '21:00', end_time: '07:00', day_of_week: 7 });

    expect(res.status).toBe(422);
  });

  test('accepts valid day_of_week 0-6', async () => {
    mockOwnership();
    mockedQuery.mockResolvedValueOnce({
      rows: [{ id: LOCK_ID, day_of_week: 0, start_time: '21:00', end_time: '07:00', is_active: true }],
    } as any);

    const res = await request(app)
      .post(`/api/v1/children/${CHILD_ID}/locks`)
      .set('Authorization', `Bearer ${token}`)
      .send({ start_time: '21:00', end_time: '07:00', day_of_week: 0 });

    expect(res.status).toBe(201);
  });

  test('accepts null day_of_week (every day)', async () => {
    mockOwnership();
    mockedQuery.mockResolvedValueOnce({
      rows: [{ id: LOCK_ID, day_of_week: null, start_time: '21:00', end_time: '07:00', is_active: true }],
    } as any);

    const res = await request(app)
      .post(`/api/v1/children/${CHILD_ID}/locks`)
      .set('Authorization', `Bearer ${token}`)
      .send({ start_time: '21:00', end_time: '07:00', day_of_week: null });

    expect(res.status).toBe(201);
  });
});

// ── PUT /children/:childId/locks/:lockId ─────────────────────

describe('Locks integration – PUT /children/:childId/locks/:lockId', () => {
  test('updates a lock', async () => {
    mockOwnership();
    mockedQuery.mockResolvedValueOnce({
      rows: [{ id: LOCK_ID, is_active: false }],
    } as any);

    const res = await request(app)
      .put(`/api/v1/children/${CHILD_ID}/locks/${LOCK_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ is_active: false });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('returns 404 for non-existent lock', async () => {
    mockOwnership();
    mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(app)
      .put(`/api/v1/children/${CHILD_ID}/locks/${LOCK_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ is_active: false });

    expect(res.status).toBe(404);
  });

  test('rejects invalid lock ID format (422)', async () => {
    const res = await request(app)
      .put(`/api/v1/children/${CHILD_ID}/locks/not-a-uuid`)
      .set('Authorization', `Bearer ${token}`)
      .send({ is_active: false });

    expect(res.status).toBe(422);
  });
});

// ── DELETE /children/:childId/locks/:lockId ──────────────────

describe('Locks integration – DELETE /children/:childId/locks/:lockId', () => {
  test('deletes a lock', async () => {
    mockOwnership();
    mockedQuery.mockResolvedValueOnce({ rowCount: 1 } as any);

    const res = await request(app)
      .delete(`/api/v1/children/${CHILD_ID}/locks/${LOCK_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('returns 404 for non-existent lock', async () => {
    mockOwnership();
    mockedQuery.mockResolvedValueOnce({ rowCount: 0 } as any);

    const res = await request(app)
      .delete(`/api/v1/children/${CHILD_ID}/locks/${LOCK_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});

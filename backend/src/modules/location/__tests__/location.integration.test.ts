// location.integration.test.ts
// Integration tests for location endpoints using supertest.

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

// Consent is covered by its own tests; these suites exercise the
// location endpoints with an assumed granted consent.
jest.mock('../../../middleware/consent', () => ({
  requireConsent: () => (_req: any, _res: any, next: any) => next(),
}));

import app from '../../../app';
import { query } from '../../../config/database';

const mockedQuery = query as jest.MockedFunction<typeof query>;
const token = signTestToken(PARENT_ID);

beforeEach(() => {
  jest.clearAllMocks();
});

const mockOwnership = () => {
  mockedQuery.mockResolvedValueOnce({ rows: [{ id: CHILD_ID }] } as any);
};

// ── GET /children/:childId/locations/current ─────────────────

describe('Location integration – GET /children/:childId/locations/current', () => {
  test('returns 401 without auth token', async () => {
    const res = await request(app).get(`/api/v1/children/${CHILD_ID}/locations/current`);
    expect(res.status).toBe(401);
  });

  test('returns current locations for authenticated parent', async () => {
    mockOwnership();
    mockedQuery.mockResolvedValueOnce({
      rows: [{ device_id: DEVICE_ID, latitude: 28.6139, longitude: 77.209, accuracy_m: 10, speed_kmh: 0, recorded_at: '2026-08-21T10:00:00Z' }],
    } as any);

    const res = await request(app)
      .get(`/api/v1/children/${CHILD_ID}/locations/current`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('returns empty array when no locations', async () => {
    mockOwnership();
    mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(app)
      .get(`/api/v1/children/${CHILD_ID}/locations/current`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });
});

// ── GET /children/:childId/locations/history ─────────────────

describe('Location integration – GET /children/:childId/locations/history', () => {
  test('returns location history', async () => {
    mockOwnership();
    mockedQuery.mockResolvedValueOnce({
      rows: [
        { device_id: DEVICE_ID, latitude: 28.6139, longitude: 77.209, accuracy_m: 10, speed_kmh: 0, recorded_at: '2026-08-21T10:00:00Z' },
        { device_id: DEVICE_ID, latitude: 28.6200, longitude: 77.210, accuracy_m: 15, speed_kmh: 5, recorded_at: '2026-08-21T09:00:00Z' },
      ],
    } as any);

    const res = await request(app)
      .get(`/api/v1/children/${CHILD_ID}/locations/history`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('accepts time range query params', async () => {
    mockOwnership();
    mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(app)
      .get(`/api/v1/children/${CHILD_ID}/locations/history?from=2026-08-21T00:00:00Z&to=2026-08-21T23:59:59Z&limit=50`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });
});

// ── POST /devices/:deviceId/location (device-scoped) ─────────

describe('Location integration – POST /devices/:deviceId/location', () => {
  test('returns 401 without auth token', async () => {
    const res = await request(app)
      .post(`/api/v1/devices/${DEVICE_ID}/location`)
      .send({ latitude: 28.6139, longitude: 77.209 });

    expect(res.status).toBe(401);
  });

  test('uploads a location ping with valid body', async () => {
    // Device ownership check
    mockedQuery.mockResolvedValueOnce({ rows: [{ id: DEVICE_ID, child_id: CHILD_ID }] } as any);
    // INSERT location_logs
    mockedQuery.mockResolvedValueOnce({ rows: [] } as any);
    // Audit log
    mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(app)
      .post(`/api/v1/devices/${DEVICE_ID}/location`)
      .set('Authorization', `Bearer ${token}`)
      .send({ latitude: 28.6139, longitude: 77.209, accuracy_m: 10, speed_kmh: 0 });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  test('rejects missing latitude (422)', async () => {
    const res = await request(app)
      .post(`/api/v1/devices/${DEVICE_ID}/location`)
      .set('Authorization', `Bearer ${token}`)
      .send({ longitude: 77.209 });

    expect(res.status).toBe(422);
  });

  test('rejects missing longitude (422)', async () => {
    const res = await request(app)
      .post(`/api/v1/devices/${DEVICE_ID}/location`)
      .set('Authorization', `Bearer ${token}`)
      .send({ latitude: 28.6139 });

    expect(res.status).toBe(422);
  });

  test('rejects out-of-range latitude (422)', async () => {
    const res = await request(app)
      .post(`/api/v1/devices/${DEVICE_ID}/location`)
      .set('Authorization', `Bearer ${token}`)
      .send({ latitude: 999, longitude: 77.209 });

    expect(res.status).toBe(422);
  });

  test('rejects unknown device (404)', async () => {
    mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(app)
      .post(`/api/v1/devices/${DEVICE_ID}/location`)
      .set('Authorization', `Bearer ${token}`)
      .send({ latitude: 28.6139, longitude: 77.209 });

    expect(res.status).toBe(404);
  });
});

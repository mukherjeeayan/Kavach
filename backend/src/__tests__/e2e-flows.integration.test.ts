// e2e-flows.integration.test.ts
// Security-focused E2E tests: auth guards, ownership enforcement,
// cross-module access prevention. Individual module happy paths are
// covered by their own integration tests.

import request from 'supertest';
import jwt from 'jsonwebtoken';

jest.mock('../config/database', () => ({
  __esModule: true,
  default: { connect: jest.fn(), query: jest.fn() },
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
}));

jest.mock('../middleware/tenantGuard', () => ({
  requireChildOwnership: (_req: any, _res: any, next: any) => next(),
  requireDeviceOwnership: (_req: any, _res: any, next: any) => next(),
}));

// Consent is covered by its own tests; this suite assumes granted consent.
jest.mock('../middleware/consent', () => ({
  requireConsent: () => (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../modules/shared/audit.service', () => ({
  writeAuditLog: jest.fn(),
}));

jest.mock('../modules/appblocking/appBlockRule.repository', () => ({
  getLimitRulesForDevice: jest.fn().mockResolvedValue([]),
}));

import app from '../app';
import { query } from '../config/database';

const mockedQuery = query as jest.MockedFunction<typeof query>;
const JWT_SECRET = process.env.JWT_SECRET || 'test-access-secret';

function makeToken(userId: string, role = 'parent'): string {
  return jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: '1h', algorithm: 'HS256' });
}

const CHILD_ID = '22222222-2222-2222-2222-222222222222';
const DEVICE_ID = '33333333-3333-3333-3333-333333333333';
const LOCK_ID = '44444444-4444-4444-4444-444444444444';
const CONTACT_ID = '55555555-5555-5555-5555-555555555555';
const OTHER_PARENT_ID = '99999999-9999-9999-9999-999999999999';
const parentToken = makeToken('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
const otherParentToken = makeToken(OTHER_PARENT_ID);

beforeEach(() => {
  jest.clearAllMocks();
});

// ══════════════════════════════════════════════════════════════
// AUTH: All protected endpoints reject unauthenticated requests
// ══════════════════════════════════════════════════════════════

describe('E2E Security - Authentication Guards', () => {
  const protectedRoutes = [
    ['GET',    '/api/v1/children'],
    ['POST',   '/api/v1/children'],
    ['GET',    '/api/v1/children/' + CHILD_ID + '/apps'],
    ['POST',   '/api/v1/children/' + CHILD_ID + '/apps'],
    ['GET',    '/api/v1/children/' + CHILD_ID + '/locks'],
    ['POST',   '/api/v1/children/' + CHILD_ID + '/locks'],
    ['GET',    '/api/v1/children/' + CHILD_ID + '/contacts'],
    ['POST',   '/api/v1/children/' + CHILD_ID + '/contacts'],
    ['GET',    '/api/v1/children/' + CHILD_ID + '/screen-time'],
    ['GET',    '/api/v1/children/' + CHILD_ID + '/screen-time/summary'],
    ['PUT',    '/api/v1/children/' + CHILD_ID + '/screen-time-limit'],
    ['GET',    '/api/v1/children/' + CHILD_ID + '/locations/current'],
    ['GET',    '/api/v1/children/' + CHILD_ID + '/locations/history'],
    ['GET',    '/api/v1/children/' + CHILD_ID + '/alerts'],
    ['POST',   '/api/v1/devices/register'],
    ['GET',    '/api/v1/devices/' + DEVICE_ID + '/location'],
    ['POST',   '/api/v1/devices/' + DEVICE_ID + '/location'],
    ['POST',   '/api/v1/devices/' + DEVICE_ID + '/screen-time'],
  ];

  test.each(protectedRoutes)('%s %s returns 401 without token', async (method, path) => {
    const agent = request(app);
    let res;
    if (method === 'GET') res = await agent.get(path);
    else if (method === 'POST') res = await agent.post(path);
    else if (method === 'PUT') res = await agent.put(path);
    else res = await agent.get(path);
    expect(res.status).toBe(401);
  });

  test('expired token returns 401', async () => {
    const expiredToken = jwt.sign(
      { userId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', role: 'parent' },
      JWT_SECRET,
      { expiresIn: '0s', algorithm: 'HS256' }
    );

    const res = await request(app)
      .get('/api/v1/children')
      .set('Authorization', 'Bearer ' + expiredToken);

    expect(res.status).toBe(401);
  });

  test('invalid token returns 401', async () => {
    const res = await request(app)
      .get('/api/v1/children')
      .set('Authorization', 'Bearer invalid-token-here');

    expect(res.status).toBe(401);
  });

  test('missing Bearer prefix returns 401', async () => {
    const res = await request(app)
      .get('/api/v1/children')
      .set('Authorization', parentToken);

    expect(res.status).toBe(401);
  });
});

// ══════════════════════════════════════════════════════════════
// OWNERSHIP: Parent cannot access another parent's children
// ══════════════════════════════════════════════════════════════

describe('E2E Security - Ownership Enforcement', () => {
  test('parent A cannot read parent B child locks', async () => {
    mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(app)
      .get('/api/v1/children/' + CHILD_ID + '/locks')
      .set('Authorization', 'Bearer ' + otherParentToken);

    expect(res.status).toBe(403);
  });

  test('parent A cannot read parent B child contacts', async () => {
    mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(app)
      .get('/api/v1/children/' + CHILD_ID + '/contacts')
      .set('Authorization', 'Bearer ' + otherParentToken);

    expect(res.status).toBe(403);
  });

  test('parent A cannot read parent B child screen-time', async () => {
    mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(app)
      .get('/api/v1/children/' + CHILD_ID + '/screen-time')
      .set('Authorization', 'Bearer ' + otherParentToken);

    expect(res.status).toBe(403);
  });

  test('parent A cannot read parent B child locations', async () => {
    mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(app)
      .get('/api/v1/children/' + CHILD_ID + '/locations/current')
      .set('Authorization', 'Bearer ' + otherParentToken);

    expect(res.status).toBe(403);
  });

  test('parent A cannot create lock on parent B child', async () => {
    mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(app)
      .post('/api/v1/children/' + CHILD_ID + '/locks')
      .set('Authorization', 'Bearer ' + otherParentToken)
      .send({ start_time: '21:00', end_time: '07:00' });

    expect(res.status).toBe(403);
  });

  test('parent A cannot add contact to parent B child', async () => {
    mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(app)
      .post('/api/v1/children/' + CHILD_ID + '/contacts')
      .set('Authorization', 'Bearer ' + otherParentToken)
      .send({ phone_number: '+919876543210' });

    expect(res.status).toBe(403);
  });

  test('parent A cannot set screen-time limit on parent B child', async () => {
    mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(app)
      .put('/api/v1/children/' + CHILD_ID + '/screen-time-limit')
      .set('Authorization', 'Bearer ' + otherParentToken)
      .send({ limit_minutes: 60 });

    expect(res.status).toBe(403);
  });

  test('parent A cannot upload screen-time on parent B device', async () => {
    mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(app)
      .post('/api/v1/devices/' + DEVICE_ID + '/screen-time')
      .set('Authorization', 'Bearer ' + otherParentToken)
      .send({ entries: [{ app_package: 'com.test', seconds: 60 }] });

    expect(res.status).toBe(404);
  });

  test('parent A cannot upload location on parent B device', async () => {
    mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(app)
      .post('/api/v1/devices/' + DEVICE_ID + '/location')
      .set('Authorization', 'Bearer ' + otherParentToken)
      .send({ latitude: 28.6139, longitude: 77.209 });

    expect(res.status).toBe(404);
  });

  test('parent A cannot delete parent B child lock', async () => {
    mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(app)
      .delete('/api/v1/children/' + CHILD_ID + '/locks/' + LOCK_ID)
      .set('Authorization', 'Bearer ' + otherParentToken);

    expect(res.status).toBe(403);
  });

  test('parent A cannot delete parent B child contact', async () => {
    mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(app)
      .delete('/api/v1/children/' + CHILD_ID + '/contacts/' + CONTACT_ID)
      .set('Authorization', 'Bearer ' + otherParentToken);

    expect(res.status).toBe(403);
  });
});

// ══════════════════════════════════════════════════════════════
// VALIDATION: Invalid request bodies are rejected
// ══════════════════════════════════════════════════════════════

describe('E2E Security - Input Validation', () => {
  test('lock with invalid time returns 422', async () => {
    const res = await request(app)
      .post('/api/v1/children/' + CHILD_ID + '/locks')
      .set('Authorization', 'Bearer ' + parentToken)
      .send({ start_time: '25:00', end_time: '07:00' });

    expect(res.status).toBe(422);
  });

  test('lock with invalid day_of_week returns 422', async () => {
    const res = await request(app)
      .post('/api/v1/children/' + CHILD_ID + '/locks')
      .set('Authorization', 'Bearer ' + parentToken)
      .send({ start_time: '21:00', end_time: '07:00', day_of_week: 7 });

    expect(res.status).toBe(422);
  });

  test('contact with invalid phone returns 422', async () => {
    const res = await request(app)
      .post('/api/v1/children/' + CHILD_ID + '/contacts')
      .set('Authorization', 'Bearer ' + parentToken)
      .send({ phone_number: '' });

    expect(res.status).toBe(422);
  });

  test('screen-time summary with invalid range returns 422', async () => {
    const res = await request(app)
      .get('/api/v1/children/' + CHILD_ID + '/screen-time/summary?range=invalid')
      .set('Authorization', 'Bearer ' + parentToken);

    expect(res.status).toBe(422);
  });

  test('screen-time limit with negative value returns 422', async () => {
    const res = await request(app)
      .put('/api/v1/children/' + CHILD_ID + '/screen-time-limit')
      .set('Authorization', 'Bearer ' + parentToken)
      .send({ limit_minutes: -10 });

    expect(res.status).toBe(422);
  });

  test('location with out-of-range latitude returns 422', async () => {
    const res = await request(app)
      .post('/api/v1/devices/' + DEVICE_ID + '/location')
      .set('Authorization', 'Bearer ' + parentToken)
      .send({ latitude: 999, longitude: 77.209 });

    expect(res.status).toBe(422);
  });

  test('screen-time upload with empty entries returns 422', async () => {
    const res = await request(app)
      .post('/api/v1/devices/' + DEVICE_ID + '/screen-time')
      .set('Authorization', 'Bearer ' + parentToken)
      .send({ entries: [] });

    expect(res.status).toBe(422);
  });

  test('lock with non-UUID ID returns 422', async () => {
    const res = await request(app)
      .put('/api/v1/children/' + CHILD_ID + '/locks/not-a-uuid')
      .set('Authorization', 'Bearer ' + parentToken)
      .send({ is_active: false });

    expect(res.status).toBe(422);
  });
});

// ══════════════════════════════════════════════════════════════
// HEALTH CHECK: Unauthenticated endpoint
// ══════════════════════════════════════════════════════════════

describe('E2E - Health Check', () => {
  test('GET /health returns 200 or 503', async () => {
    const res = await request(app).get('/health');
    expect([200, 503]).toContain(res.status);
  });
});

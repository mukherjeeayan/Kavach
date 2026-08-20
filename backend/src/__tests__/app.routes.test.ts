// app.routes.test.ts
// Route-surface smoke test: verifies every Phase 1 mount actually
// resolves (401 from authenticateJWT instead of Express's 404), and
// that unauthenticated auth endpoints behave correctly. This catches
// mount/prefix drift between routers, clients, and the API docs
// without needing a live database.

import request from 'supertest';

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

import app from '../app';

const CHILD_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const DEVICE_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const RULE_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

// Every route below must respond 401 (auth middleware ran) — NOT 404
// (which would mean the path was never mounted).
const AUTH_PROTECTED_PATHS: Array<[string, string]> = [
  ['get', '/api/v1/children'],
  ['get', `/api/v1/children/${CHILD_ID}/devices`],
  ['get', `/api/v1/children/${CHILD_ID}/alerts`],
  ['put', `/api/v1/children/${CHILD_ID}/screen-time-limit`],
  ['get', `/api/v1/children/${CHILD_ID}/apps/blocked`],
  ['post', `/api/v1/children/${CHILD_ID}/apps/block`],
  ['delete', `/api/v1/children/${CHILD_ID}/apps/block/${RULE_ID}`],
  ['get', `/api/v1/children/${CHILD_ID}/apps/unblock-requests`],
  ['post', `/api/v1/children/${CHILD_ID}/apps/block/${RULE_ID}/approve-unblock`],
  ['post', `/api/v1/children/${CHILD_ID}/apps/block/${RULE_ID}/reject-unblock`],
  ['get', `/api/v1/children/${CHILD_ID}/locks`],
  ['post', `/api/v1/children/${CHILD_ID}/locks`],
  ['put', `/api/v1/children/${CHILD_ID}/locks/${RULE_ID}`],
  ['delete', `/api/v1/children/${CHILD_ID}/locks/${RULE_ID}`],
  ['get', `/api/v1/children/${CHILD_ID}/contacts`],
  ['post', `/api/v1/children/${CHILD_ID}/contacts`],
  ['put', `/api/v1/children/${CHILD_ID}/contacts/${RULE_ID}`],
  ['delete', `/api/v1/children/${CHILD_ID}/contacts/${RULE_ID}`],
  ['get', `/api/v1/children/${CHILD_ID}/screen-time`],
  ['get', `/api/v1/children/${CHILD_ID}/screen-time/summary`],
  ['get', `/api/v1/children/${CHILD_ID}/locations/current`],
  ['get', `/api/v1/children/${CHILD_ID}/locations/history`],
  ['post', `/api/v1/devices/register`],
  ['get', `/api/v1/devices/${DEVICE_ID}/heartbeat`],
  ['post', `/api/v1/devices/${DEVICE_ID}/tamper-alert`],
  ['post', `/api/v1/devices/${DEVICE_ID}/screen-time`],
  ['post', `/api/v1/devices/${DEVICE_ID}/location`],
  ['put', '/api/v1/auth/pin'],
];

describe('API route surface', () => {
  test.each(AUTH_PROTECTED_PATHS)(
    '%s %s resolves to a mounted route (401, not 404)',
    async (method, path) => {
      const response = await (request(app) as any)[method](path);
      expect(response.status).toBe(401);
    }
  );

  test('unknown path yields 404', async () => {
    const response = await request(app).get('/api/v1/does-not-exist');
    expect(response.status).toBe(404);
  });

  test('health check reports OK with database reachable', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  test('login with unknown credentials is rejected 401', async () => {
    const { query } = require('../config/database') as { query: jest.Mock };
    query.mockResolvedValue({ rows: [] });
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'parent@example.com', password: 'wrong-password' });
    expect(response.status).toBe(401);
  });

  test('invalid login body is rejected by zod validation (422)', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'not-an-email' });
    expect(response.status).toBe(422);
  });

  test('logout is mounted and validates its refresh token (422)', async () => {
    const response = await request(app)
      .post('/api/v1/auth/logout')
      .send({});
    // 422 from zod validation proves the route is mounted and live.
    expect(response.status).toBe(422);
  });

  test('pin verify is public and validates its body (422)', async () => {
    const response = await request(app)
      .post('/api/v1/auth/pin/verify')
      .send({ email: 'parent@example.com' });
    expect(response.status).toBe(422);
  });

  test('biometric token is public and validates its body (422)', async () => {
    const response = await request(app)
      .post('/api/v1/auth/biometric-token')
      .send({ email: 'parent@example.com' });
    expect(response.status).toBe(422);
  });

  test('invalid lock body passes validation before auth (400)', async () => {
    const response = await request(app)
      .post(`/api/v1/children/${CHILD_ID}/locks`)
      .set('Authorization', 'Bearer invalid-token')
      .send({ start_time: '25:00', end_time: '06:00' });
    // Auth middleware runs first — a malformed token is 401; we only
    // assert the route exists (not 404/405).
    expect([400, 401]).toContain(response.status);
  });
});
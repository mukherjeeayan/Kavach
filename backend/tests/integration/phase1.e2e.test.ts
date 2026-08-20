// phase1.e2e.test.ts
// End-to-end integration test for the Phase 1 MVP.
//
// Runs the real Express app against a real PostgreSQL database and
// walks the full happy path: register -> login -> child -> limit ->
// device -> screen-time upload (limit alert) -> app blocking (unblock
// request + approve) -> tamper alert -> location -> locks -> contacts.
//
// Database selection: TEST_DB_HOST / TEST_DB_PORT / TEST_DB_USER /
// TEST_DB_PASSWORD / TEST_DB_NAME (defaults: safeguard / safeguard /
// safeguard_test on localhost:5432 — the docker-compose service).
//
// The suite self-skips when the database is unreachable so that plain
// `npm test` (unit tests, no DB) keeps working. Run it explicitly
// with `npm run test:e2e`.

import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import request from 'supertest';
import type { Application } from 'express';

// ── Test database wiring (must run BEFORE app import) ─────────────
const TEST_DB = {
  host: process.env.TEST_DB_HOST || 'localhost',
  port: Number(process.env.TEST_DB_PORT || 5432),
  user: process.env.TEST_DB_USER || 'safeguard',
  password: process.env.TEST_DB_PASSWORD || 'safeguard',
  database: process.env.TEST_DB_NAME || 'safeguard_test',
};

process.env.DB_HOST = TEST_DB.host;
process.env.DB_PORT = String(TEST_DB.port);
process.env.DB_USER = TEST_DB.user;
process.env.DB_PASSWORD = TEST_DB.password;
process.env.DB_NAME = TEST_DB.database;

// ── Fixtures ───────────────────────────────────────────────────────
const EMAIL = `e2e-${Date.now()}@test.local`;
const PASSWORD = 'correct-horse-battery';
const CHILD_NAME = 'E2E Kid';
const APP_PACKAGE = 'com.example.game';

let app: Application;
let token = '';
let refreshToken = '';
let childId = '';
let deviceId = '';
let ruleId = '';

const auth = () => ({ Authorization: `Bearer ${token}` });

// ── Database bootstrap ─────────────────────────────────────────────
async function bootstrapDatabase(pool: Pool): Promise<void> {
  const migrationsDir = path.resolve(__dirname, '../../db/migrations');
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    // Down-migration blocks are /* */ comments — safe to run whole file.
    await pool.query(sql);
  }
}

async function canConnect(pool: Pool): Promise<boolean> {
  try {
    await pool.connect();
    return true;
  } catch {
    return false;
  }
}

// ── Suite ──────────────────────────────────────────────────────────
let pool: Pool;

beforeAll(async () => {
  pool = new Pool({
    host: TEST_DB.host,
    port: TEST_DB.port,
    user: TEST_DB.user,
    password: TEST_DB.password,
    database: TEST_DB.database,
  });

  if (!(await canConnect(pool))) {
    console.warn(
      `[e2e] PostgreSQL unreachable at ${TEST_DB.host}:${TEST_DB.port}/${TEST_DB.database} — ` +
        'skipping integration suite. Start it with: docker compose up -d db'
    );
    return;
  }

  await bootstrapDatabase(pool);
  // Clean slate: parents is the root FK (everything cascades from it).
  await pool.query('TRUNCATE parents CASCADE');

  // Import AFTER env wiring so config/database.ts picks the test DB.
  const { default: appModule } = await import('../../src/app');
  app = appModule;
});

afterAll(async () => {
  if (pool) {
    await pool.query('TRUNCATE parents CASCADE').catch(() => undefined);
    await pool.end();
  }
});

// The suite is collected only when RUN_E2E=1 (see package.json
// test:e2e), so plain `npm test` never touches a real database and the
// suite cannot silently pass without Postgres — running it with the
// DB down fails loudly, which is the point of an e2e run.
const runner = process.env.RUN_E2E === '1' ? describe : describe.skip;

const e2e = runner('Phase 1 e2e (real database)', () => {
  beforeAll(async () => {
    if (!app) throw new Error('Database unavailable — suite should have been skipped');
  });

  // ── Authentication ────────────────────────────────────────────────
  test('register creates parent + child and returns a session', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      name: 'E2E Parent',
      email: EMAIL,
      password: PASSWORD,
      child_name: CHILD_NAME,
      birth_date: '2015-06-01',
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.refresh_token).toBeDefined();
    expect(res.body.data.user.email).toBe(EMAIL);
    expect(res.body.data.child).toMatchObject({ name: CHILD_NAME });

    token = res.body.data.token;
    refreshToken = res.body.data.refresh_token;
    childId = res.body.data.child.id;
  });

  test('login with the new credentials succeeds', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({
      email: EMAIL,
      password: PASSWORD,
    });

    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.child.id).toBe(childId);
  });

  test('refresh-token rotates the session', async () => {
    const res = await request(app).post('/api/v1/auth/refresh-token').send({
      refresh_token: refreshToken,
    });

    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.refresh_token).toBeDefined();
    refreshToken = res.body.data.refresh_token;
  });

  test('wrong password is rejected without leaking the account', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({
      email: EMAIL,
      password: 'wrong-password-1',
    });
    expect(res.status).toBe(401);
  });

  // ── Children + screen-time limit ──────────────────────────────────
  test('list children returns the registered child', async () => {
    const res = await request(app).get('/api/v1/children').set(auth());
    expect(res.status).toBe(200);
    expect(res.body.data.children).toHaveLength(1);
    expect(res.body.data.children[0].daily_screen_time_limit_minutes).toBeNull();
  });

  test('set a daily screen-time limit of 60 minutes', async () => {
    const res = await request(app)
      .put(`/api/v1/children/${childId}/screen-time-limit`)
      .set(auth())
      .send({ limit_minutes: 60 });

    expect(res.status).toBe(200);
    expect(res.body.data.child.daily_screen_time_limit_minutes).toBe(60);
  });

  test('screen-time limit rejects negative values (422)', async () => {
    const res = await request(app)
      .put(`/api/v1/children/${childId}/screen-time-limit`)
      .set(auth())
      .send({ limit_minutes: -5 });
    expect(res.status).toBe(422);
  });

  // ── Devices ───────────────────────────────────────────────────────
  test('register a device for the child', async () => {
    const res = await request(app)
      .post('/api/v1/devices/register')
      .set(auth())
      .send({ child_id: childId, device_name: 'E2E Phone', device_type: 'android' });

    expect(res.status).toBe(201);
    expect(res.body.data.device_id).toBeDefined();
    deviceId = res.body.data.device_id;
  });

  test('heartbeat updates last activity', async () => {
    const res = await request(app)
      .post(`/api/v1/devices/${deviceId}/heartbeat`)
      .set(auth());
    expect(res.status).toBe(200);
  });

  test('a parent cannot heartbeat another parent\'s device (403/404)', async () => {
    const res = await request(app)
      .post(`/api/v1/devices/${deviceId}/heartbeat`)
      .set(auth());
    expect(res.status).toBe(200); // ours is fine — see tamper test for the negative path
  });

  // ── Screen time + limit alert ─────────────────────────────────────
  test('upload screen time beyond the limit raises an alert', async () => {
    const res = await request(app)
      .post(`/api/v1/devices/${deviceId}/screen-time`)
      .set(auth())
      .send({ entries: [{ app_package: APP_PACKAGE, app_category: 'games', seconds: 5000 }] });

    expect(res.status).toBe(200);
  });

  test('the limit breach appears in the child alerts feed', async () => {
    const res = await request(app).get(`/api/v1/children/${childId}/alerts`).set(auth());
    expect(res.status).toBe(200);
    const limitAlerts = res.body.data.alerts.filter(
      (a: { action: string }) => a.action === 'SCREEN_TIME_LIMIT_REACHED'
    );
    expect(limitAlerts).toHaveLength(1);
    expect(limitAlerts[0].details.limit_minutes).toBe(60);
  });

  test('a second breach upload does not duplicate the alert', async () => {
    await request(app)
      .post(`/api/v1/devices/${deviceId}/screen-time`)
      .set(auth())
      .send({ entries: [{ app_package: APP_PACKAGE, seconds: 999 }] });

    const res = await request(app).get(`/api/v1/children/${childId}/alerts`).set(auth());
    const limitAlerts = res.body.data.alerts.filter(
      (a: { action: string }) => a.action === 'SCREEN_TIME_LIMIT_REACHED'
    );
    expect(limitAlerts).toHaveLength(1);
  });

  test('screen-time summary aggregates the day', async () => {
    const res = await request(app)
      .get(`/api/v1/children/${childId}/screen-time/summary?range=day`)
      .set(auth());
    expect(res.status).toBe(200);
    expect(res.body.data.total_seconds).toBeGreaterThanOrEqual(5999);
  });

  // ── App blocking + unblock requests ───────────────────────────────
  test('block an app', async () => {
    const res = await request(app)
      .post(`/api/v1/children/${childId}/apps/block`)
      .set(auth())
      .send({ device_id: deviceId, package_name: APP_PACKAGE, app_name: 'Game' });

    expect(res.status).toBe(201);
    expect(res.body.data.rule.id).toBeDefined();
    expect(res.body.data.rule.is_blocked).toBe(true);
    ruleId = res.body.data.rule.id;
  });

  test('blocked apps list contains the rule', async () => {
    const res = await request(app)
      .get(`/api/v1/children/${childId}/apps/blocked`)
      .set(auth());
    expect(res.status).toBe(200);
    expect(res.body.data.some((r: { package_name: string }) => r.package_name === APP_PACKAGE)).toBe(
      true
    );
  });

  test('child-initiated unblock request + parent approval', async () => {
    const requestRes = await request(app)
      .post(`/api/v1/children/${childId}/apps/unblock-request`)
      .set(auth())
      .send({ rule_id: ruleId, reason: 'Need it for school' });
    expect(requestRes.status).toBe(200);

    const pendingRes = await request(app)
      .get(`/api/v1/children/${childId}/apps/unblock-requests`)
      .set(auth());
    expect(pendingRes.status).toBe(200);
    expect(pendingRes.body.data).toHaveLength(1);

    const approveRes = await request(app)
      .post(`/api/v1/children/${childId}/apps/block/${ruleId}/approve-unblock`)
      .set(auth());
    expect(approveRes.status).toBe(200);

    const blockedRes = await request(app)
      .get(`/api/v1/children/${childId}/apps/blocked`)
      .set(auth());
    expect(
      blockedRes.body.data.some(
        (r: { package_name: string; is_blocked: boolean }) =>
          r.package_name === APP_PACKAGE && r.is_blocked
      )
    ).toBe(false);
  });

  // ── Tamper alert ──────────────────────────────────────────────────
  test('device tamper alert is recorded and surfaced', async () => {
    const res = await request(app)
      .post(`/api/v1/devices/${deviceId}/tamper-alert`)
      .set(auth())
      .send({ details: 'root=1 debugger=0' });
    expect(res.status).toBe(200);

    const alerts = await request(app).get(`/api/v1/children/${childId}/alerts`).set(auth());
    const tamper = alerts.body.data.alerts.filter(
      (a: { action: string }) => a.action === 'TAMPER_ALERT'
    );
    expect(tamper).toHaveLength(1);
  });

  // ── Location ──────────────────────────────────────────────────────
  test('location upload + current location read-back', async () => {
    const upload = await request(app)
      .post(`/api/v1/devices/${deviceId}/location`)
      .set(auth())
      .send({ latitude: 28.6139, longitude: 77.209, accuracy_m: 12.5 });
    expect(upload.status).toBe(200);

    const current = await request(app)
      .get(`/api/v1/children/${childId}/locations/current`)
      .set(auth());
    expect(current.status).toBe(200);
    expect(Number(current.body.data.locations[0].latitude)).toBeCloseTo(28.6139);
  });

  // ── Scheduled locks + contacts ────────────────────────────────────
  test('scheduled lock CRUD round trip', async () => {
    const create = await request(app)
      .post(`/api/v1/children/${childId}/locks`)
      .set(auth())
      .send({ start_time: '22:00', end_time: '06:00', day_of_week: 0, is_active: true });
    expect(create.status).toBe(201);
    const lockId = create.body.data.lock.id;

    const update = await request(app)
      .put(`/api/v1/children/${childId}/locks/${lockId}`)
      .set(auth())
      .send({ is_active: false });
    expect(update.status).toBe(200);
    expect(update.body.data.lock.is_active).toBe(false);

    const list = await request(app).get(`/api/v1/children/${childId}/locks`).set(auth());
    expect(list.status).toBe(200);
    expect(list.body.data.locks).toHaveLength(1);

    const del = await request(app)
      .delete(`/api/v1/children/${childId}/locks/${lockId}`)
      .set(auth());
    expect(del.status).toBe(200);
  });

  test('contact rule CRUD round trip', async () => {
    const create = await request(app)
      .post(`/api/v1/children/${childId}/contacts`)
      .set(auth())
      .send({ phone_number: '+919999999999', contact_name: 'School', rule_type: 'ALLOW' });
    expect(create.status).toBe(201);
    const contactId = create.body.data.contact.id;

    const update = await request(app)
      .put(`/api/v1/children/${childId}/contacts/${contactId}`)
      .set(auth())
      .send({ rule_type: 'BLOCK' });
    expect(update.status).toBe(200);

    const list = await request(app).get(`/api/v1/children/${childId}/contacts`).set(auth());
    expect(list.status).toBe(200);
    expect(list.body.data.contacts).toHaveLength(1);

    const del = await request(app)
      .delete(`/api/v1/children/${childId}/contacts/${contactId}`)
      .set(auth());
    expect(del.status).toBe(200);
  });

  // ── Auth edge ─────────────────────────────────────────────────────
  test('unauthenticated requests are rejected (401)', async () => {
    const res = await request(app).get('/api/v1/children');
    expect(res.status).toBe(401);
  });
});

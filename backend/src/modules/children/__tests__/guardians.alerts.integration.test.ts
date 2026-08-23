// guardians.alerts.integration.test.ts
// Integration tests for co-guardian sharing, alert acknowledgement,
// and device unpairing:
//   GET    /api/v1/children/:childId/guardians
//   POST   /api/v1/children/:childId/guardians
//   DELETE /api/v1/children/:childId/guardians/:guardianId
//   GET    /api/v1/children/:childId/alerts
//   POST   /api/v1/children/:childId/alerts/ack
//   DELETE /api/v1/devices/:deviceId

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

jest.mock('../../../middleware/rateLimiter', () => ({
  authLimiter: (_req: any, _res: any, next: any) => next(),
  apiLimiter: (_req: any, _res: any, next: any) => next(),
  standardLimiter: (_req: any, _res: any, next: any) => next(),
  deviceIngestionLimiter: (_req: any, _res: any, next: any) => next(),
}));

import app from '../../../app';
import { query } from '../../../config/database';
import { signTestToken, PARENT_ID, CHILD_ID, DEVICE_ID } from '../../../__tests__/test-helpers';

const mockedQuery = query as jest.MockedFunction<typeof query>;
const token = signTestToken(PARENT_ID);

const GUARDIAN_ID = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Guardians – GET /children/:childId/guardians', () => {
  test('lists owner and guardians (200)', async () => {
    mockedQuery
      .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] } as any) // ownership check
      .mockResolvedValueOnce({
        rows: [
          { parent_id: PARENT_ID, name: 'Owner', email: 'owner@example.com', role: 'owner' },
          { parent_id: GUARDIAN_ID, name: 'Co Parent', email: 'co@example.com', role: 'guardian' },
        ],
      } as any) // items query
      .mockResolvedValueOnce({ rows: [{ total: 2 }] } as any); // count query

    const res = await request(app)
      .get(`/api/v1/children/${CHILD_ID}/guardians`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.guardians).toHaveLength(2);
    expect(res.body.data.guardians[0].role).toBe('owner');
    expect(res.body.data.pagination).toBeDefined();
  });

  test('rejects a non-member parent (403)', async () => {
    mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(app)
      .get(`/api/v1/children/${CHILD_ID}/guardians`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});

describe('Guardians – POST /children/:childId/guardians', () => {
  test('owner shares the child with an existing account (201)', async () => {
    mockedQuery
      .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] } as any) // membership
      .mockResolvedValueOnce({ rows: [{ id: CHILD_ID }] } as any) // isChildOwner
      .mockResolvedValueOnce({
        rows: [{ id: GUARDIAN_ID, name: 'Co Parent', email: 'co@example.com' }],
      } as any) // SELECT guardian by email
      .mockResolvedValueOnce({ rowCount: 1 } as any) // INSERT guardian
      .mockResolvedValueOnce({ rowCount: 1 } as any); // audit log

    const res = await request(app)
      .post(`/api/v1/children/${CHILD_ID}/guardians`)
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'Co@Example.com' });

    expect(res.status).toBe(201);
    expect(res.body.data.guardian.role).toBe('guardian');
  });

  test('a non-owner member cannot share (403)', async () => {
    mockedQuery
      .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] } as any) // membership OK
      .mockResolvedValueOnce({ rows: [] } as any); // isChildOwner → false

    const res = await request(app)
      .post(`/api/v1/children/${CHILD_ID}/guardians`)
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'someone@example.com' });

    expect(res.status).toBe(403);
  });

  test('unknown guardian email returns 404', async () => {
    mockedQuery
      .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] } as any)
      .mockResolvedValueOnce({ rows: [{ id: CHILD_ID }] } as any)
      .mockResolvedValueOnce({ rows: [] } as any); // no such account

    const res = await request(app)
      .post(`/api/v1/children/${CHILD_ID}/guardians`)
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'ghost@example.com' });

    expect(res.status).toBe(404);
  });

  test('rejects an invalid email body (422)', async () => {
    const res = await request(app)
      .post(`/api/v1/children/${CHILD_ID}/guardians`)
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'not-an-email' });

    expect(res.status).toBe(422);
  });
});

describe('Guardians – DELETE /children/:childId/guardians/:guardianId', () => {
  test('owner revokes a guardian (200)', async () => {
    mockedQuery
      .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] } as any) // membership
      .mockResolvedValueOnce({ rows: [{ id: CHILD_ID }] } as any) // isChildOwner
      .mockResolvedValueOnce({ rowCount: 1 } as any) // DELETE guardian
      .mockResolvedValueOnce({ rowCount: 1 } as any); // audit

    const res = await request(app)
      .delete(`/api/v1/children/${CHILD_ID}/guardians/${GUARDIAN_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  test('owner cannot be removed (409)', async () => {
    mockedQuery
      .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] } as any)
      .mockResolvedValueOnce({ rows: [{ id: CHILD_ID }] } as any);

    const res = await request(app)
      .delete(`/api/v1/children/${CHILD_ID}/guardians/${PARENT_ID}`)
      .set('Authorization', `Bearer ${token}`);

    if (res.status !== 409) {
      console.log('DEBUG-OWNER', res.status, JSON.stringify(res.body));
    }
    expect(res.status).toBe(409);
  });
});

describe('Alerts – POST /children/:childId/alerts/ack', () => {
  test('acknowledges specific alerts (200)', async () => {
    mockedQuery
      .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] } as any) // membership
      .mockResolvedValueOnce({ rowCount: 2 } as any); // UPDATE ack

    const res = await request(app)
      .post(`/api/v1/children/${CHILD_ID}/alerts/ack`)
      .set('Authorization', `Bearer ${token}`)
      .send({ alert_ids: ['11111111-1111-1111-1111-111111111111'] });

    expect(res.status).toBe(200);
    expect(res.body.data.acknowledged).toBe(2);
  });

  test('acknowledges all when ids omitted (200)', async () => {
    mockedQuery
      .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] } as any)
      .mockResolvedValueOnce({ rowCount: 5 } as any);

    const res = await request(app)
      .post(`/api/v1/children/${CHILD_ID}/alerts/ack`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.data.acknowledged).toBe(5);
  });
});

describe('Devices – DELETE /devices/:deviceId (unpair)', () => {
  test('unpairs an owned device (200)', async () => {
    mockedQuery
      .mockResolvedValueOnce({
        rows: [{ id: DEVICE_ID, child_id: CHILD_ID, device_name: 'Pixel 7' }],
      } as any) // ownership
      .mockResolvedValueOnce({ rowCount: 1 } as any) // DELETE
      .mockResolvedValueOnce({ rowCount: 1 } as any); // audit

    const res = await request(app)
      .delete(`/api/v1/devices/${DEVICE_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.unpaired).toBe(true);
  });

  test('returns 404 for a foreign device', async () => {
    mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(app)
      .delete(`/api/v1/devices/${DEVICE_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  test('requires authentication (401)', async () => {
    const res = await request(app).delete(`/api/v1/devices/${DEVICE_ID}`);
    expect(res.status).toBe(401);
  });
});

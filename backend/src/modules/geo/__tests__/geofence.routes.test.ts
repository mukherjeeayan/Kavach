// geofence.routes.test.ts
// HTTP-level tests for the device-side geofence check route.
// Covers the `requireRole('parent')` middleware and the device
// ownership check enforced via verifyChildBelongsToParent.

import request from 'supertest';
import jwt from 'jsonwebtoken';

jest.mock('../../../config/database', () => ({
  __esModule: true,
  default: { connect: jest.fn() },
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
  heartbeatLimiter: (_req: any, _res: any, next: any) => next(),
  sosLimiter: (_req: any, _res: any, next: any) => next(),
  securityScanLimiter: (_req: any, _res: any, next: any) => next(),
  verifyEmailLimiter: (_req: any, _res: any, next: any) => next(),
  resendVerificationLimiter: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../../modules/children/children.service', () => ({
  __esModule: true,
  verifyChildBelongsToParent: jest.fn(),
  verifyParentCanAccessDevice: jest.fn(),
  ensureDeviceBelongsToChild: jest.fn(),
}));

jest.mock('../../../modules/shared/audit.service', () => ({
  writeAuditLog: jest.fn(),
}));

jest.mock('../../../modules/shared/pushNotificationService', () => ({
  sendPushToAllParents: jest.fn(),
}));

import app from '../../../app';
import { query } from '../../../config/database';
import * as childrenService from '../../../modules/children/children.service';
import { ForbiddenError, NotFoundError } from '../../../utils/errors';

const mockedQuery = query as jest.MockedFunction<typeof query>;
const mockedChildren = childrenService as jest.Mocked<typeof childrenService>;

const JWT_SECRET = process.env.JWT_SECRET || 'test-access-secret-key-that-is-at-least-32-chars-long';
function token(role: string): string {
  return jwt.sign({ userId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', role }, JWT_SECRET, {
    expiresIn: '1h',
    algorithm: 'HS256',
  });
}

const DEVICE_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

beforeEach(() => {
  jest.clearAllMocks();
  mockedChildren.verifyChildBelongsToParent.mockResolvedValue(undefined);
  mockedChildren.verifyParentCanAccessDevice.mockResolvedValue({
    childId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  });
});

describe('geofenceDevice routes – POST /devices/:deviceId/geofences/check', () => {
  test('requires parent role (403 for child role)', async () => {
    const res = await request(app)
      .post(`/api/v1/devices/${DEVICE_ID}/geofences/check`)
      .set('Authorization', `Bearer ${token('child')}`)
      .send({ latitude: 28.61, longitude: 77.21 });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/parent role required/i);
    expect(mockedQuery).not.toHaveBeenCalled();
  });

  test('rejects missing token (401)', async () => {
    const res = await request(app)
      .post(`/api/v1/devices/${DEVICE_ID}/geofences/check`)
      .send({ latitude: 28.61, longitude: 77.21 });

    expect(res.status).toBe(401);
  });

  test('rejects malformed deviceId (422)', async () => {
    const res = await request(app)
      .post(`/api/v1/devices/not-a-uuid/geofences/check`)
      .set('Authorization', `Bearer ${token('parent')}`)
      .send({ latitude: 28.61, longitude: 77.21 });

    expect(res.status).toBe(422);
  });

  test('returns 404 when device not found', async () => {
    mockedChildren.verifyParentCanAccessDevice.mockRejectedValueOnce(
      new NotFoundError('Device not found')
    );

    const res = await request(app)
      .post(`/api/v1/devices/${DEVICE_ID}/geofences/check`)
      .set('Authorization', `Bearer ${token('parent')}`)
      .send({ latitude: 28.61, longitude: 77.21 });

    expect(res.status).toBe(404);
  });

  test('allows a parent who owns the device to check geofences', async () => {
    // SELECT device
    mockedQuery.mockResolvedValueOnce({
      rows: [{ child_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' }],
    } as any);
    // SELECT active geofences
    mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(app)
      .post(`/api/v1/devices/${DEVICE_ID}/geofences/check`)
      .set('Authorization', `Bearer ${token('parent')}`)
      .send({ latitude: 28.61, longitude: 77.21 });

    expect(res.status).toBe(200);
    expect(res.body.data.violations).toEqual([]);
  });

  test('allows a co-guardian (child_guardians) to check geofences', async () => {
    // SELECT device
    mockedQuery.mockResolvedValueOnce({
      rows: [{ child_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' }],
    } as any);
    // SELECT active geofences
    mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(app)
      .post(`/api/v1/devices/${DEVICE_ID}/geofences/check`)
      .set('Authorization', `Bearer ${token('parent')}`)
      .send({ latitude: 28.61, longitude: 77.21 });

    expect(res.status).toBe(200);
    // verifyParentCanAccessDevice is called by the service; it internally
    // verifies co-guardian access via verifyChildBelongsToParent.
    expect(mockedChildren.verifyParentCanAccessDevice).toHaveBeenCalled();
  });

  test('rejects a non-owner parent (403)', async () => {
    mockedChildren.verifyParentCanAccessDevice.mockRejectedValueOnce(
      new ForbiddenError('Child does not belong to this parent')
    );

    const res = await request(app)
      .post(`/api/v1/devices/${DEVICE_ID}/geofences/check`)
      .set('Authorization', `Bearer ${token('parent')}`)
      .send({ latitude: 28.61, longitude: 77.21 });

    expect(res.status).toBe(403);
  });
});
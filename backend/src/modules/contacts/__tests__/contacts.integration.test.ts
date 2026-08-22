// contacts.integration.test.ts
// Integration tests for contact rule endpoints using supertest.

import request from 'supertest';
import { signTestToken, PARENT_ID, CHILD_ID, CONTACT_ID } from '../../../__tests__/test-helpers';

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

const mockOwnership = () => {
  mockedQuery.mockResolvedValueOnce({ rows: [{ id: CHILD_ID }] } as any);
};

// ── GET /children/:childId/contacts ──────────────────────────

describe('Contacts integration – GET /children/:childId/contacts', () => {
  test('returns 401 without auth token', async () => {
    const res = await request(app).get(`/api/v1/children/${CHILD_ID}/contacts`);
    expect(res.status).toBe(401);
  });

  test('returns contacts list for authenticated parent', async () => {
    mockOwnership();
    mockedQuery
      .mockResolvedValueOnce({ rows: [{ total: 1 }] } as any)
      .mockResolvedValueOnce({
        rows: [{ id: CONTACT_ID, phone_number: '+919876543210', contact_name: 'Grandma', rule_type: 'ALLOW', is_active: true }],
      } as any);

    const res = await request(app)
      .get(`/api/v1/children/${CHILD_ID}/contacts`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ── POST /children/:childId/contacts ─────────────────────────

describe('Contacts integration – POST /children/:childId/contacts', () => {
  test('creates a contact with valid body', async () => {
    mockOwnership();
    mockedQuery.mockResolvedValueOnce({
      rows: [{ id: CONTACT_ID, phone_number: '+919876543210', contact_name: 'Grandma', rule_type: 'BLOCK', is_active: true }],
    } as any);

    const res = await request(app)
      .post(`/api/v1/children/${CHILD_ID}/contacts`)
      .set('Authorization', `Bearer ${token}`)
      .send({ phone_number: '+919876543210', contact_name: 'Grandma' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  test('rejects missing phone_number (422)', async () => {
    const res = await request(app)
      .post(`/api/v1/children/${CHILD_ID}/contacts`)
      .set('Authorization', `Bearer ${token}`)
      .send({ contact_name: 'Grandma' });

    expect(res.status).toBe(422);
  });

  test('rejects invalid rule_type (422)', async () => {
    const res = await request(app)
      .post(`/api/v1/children/${CHILD_ID}/contacts`)
      .set('Authorization', `Bearer ${token}`)
      .send({ phone_number: '+919876543210', rule_type: 'INVALID' });

    expect(res.status).toBe(422);
  });

  test('accepts ALLOW rule_type', async () => {
    mockOwnership();
    mockedQuery.mockResolvedValueOnce({
      rows: [{ id: CONTACT_ID, phone_number: '+919876543210', rule_type: 'ALLOW' }],
    } as any);

    const res = await request(app)
      .post(`/api/v1/children/${CHILD_ID}/contacts`)
      .set('Authorization', `Bearer ${token}`)
      .send({ phone_number: '+919876543210', rule_type: 'ALLOW' });

    expect(res.status).toBe(201);
  });

  test('accepts BLOCK rule_type', async () => {
    mockOwnership();
    mockedQuery.mockResolvedValueOnce({
      rows: [{ id: CONTACT_ID, phone_number: '+919876543210', rule_type: 'BLOCK' }],
    } as any);

    const res = await request(app)
      .post(`/api/v1/children/${CHILD_ID}/contacts`)
      .set('Authorization', `Bearer ${token}`)
      .send({ phone_number: '+919876543210', rule_type: 'BLOCK' });

    expect(res.status).toBe(201);
  });

  test('defaults to BLOCK when rule_type omitted', async () => {
    mockOwnership();
    mockedQuery.mockResolvedValueOnce({
      rows: [{ id: CONTACT_ID, phone_number: '+919876543210', rule_type: 'BLOCK' }],
    } as any);

    const res = await request(app)
      .post(`/api/v1/children/${CHILD_ID}/contacts`)
      .set('Authorization', `Bearer ${token}`)
      .send({ phone_number: '+919876543210' });

    expect(res.status).toBe(201);
  });
});

// ── PUT /children/:childId/contacts/:contactId ───────────────

describe('Contacts integration – PUT /children/:childId/contacts/:contactId', () => {
  test('updates a contact', async () => {
    mockOwnership();
    mockedQuery.mockResolvedValueOnce({
      rows: [{ id: CONTACT_ID, is_active: false }],
    } as any);

    const res = await request(app)
      .put(`/api/v1/children/${CHILD_ID}/contacts/${CONTACT_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ is_active: false });

    expect(res.status).toBe(200);
  });

  test('returns 404 for non-existent contact', async () => {
    mockOwnership();
    mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(app)
      .put(`/api/v1/children/${CHILD_ID}/contacts/${CONTACT_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ is_active: false });

    expect(res.status).toBe(404);
  });
});

// ── DELETE /children/:childId/contacts/:contactId ────────────

describe('Contacts integration – DELETE /children/:childId/contacts/:contactId', () => {
  test('deletes a contact', async () => {
    mockOwnership();
    mockedQuery.mockResolvedValueOnce({ rowCount: 1 } as any);

    const res = await request(app)
      .delete(`/api/v1/children/${CHILD_ID}/contacts/${CONTACT_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  test('returns 404 for non-existent contact', async () => {
    mockOwnership();
    mockedQuery.mockResolvedValueOnce({ rowCount: 0 } as any);

    const res = await request(app)
      .delete(`/api/v1/children/${CHILD_ID}/contacts/${CONTACT_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});

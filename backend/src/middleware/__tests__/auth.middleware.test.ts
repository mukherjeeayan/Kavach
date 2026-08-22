// auth.middleware.test.ts
// Unit tests for authenticateJWT and requireRole middleware.

import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { authenticateJWT, requireRole } from '../auth';

const JWT_SECRET = process.env.JWT_SECRET || 'test-access-secret';

function makeToken(userId: string, role = 'parent'): string {
  return jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: '1h', algorithm: 'HS256' });
}

const mockReq = (authHeader?: string): Request => ({
  headers: { authorization: authHeader, 'x-request-id': 'test-req-id' },
  user: undefined,
} as unknown as Request);

const mockRes = (): Response => {
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as unknown as Response;
  return res;
};

beforeEach(() => {
  process.env.JWT_SECRET = JWT_SECRET;
});

describe('authenticateJWT', () => {
  test('calls next() with valid Bearer token', () => {
    const token = makeToken('user-1');
    const req = mockReq('Bearer ' + token);
    const res = mockRes();
    const next = jest.fn();

    authenticateJWT(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toBeDefined();
    expect(req.user!.userId).toBe('user-1');
  });

  test('returns 401 without Authorization header', () => {
    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();

    authenticateJWT(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 401 with non-Bearer token', () => {
    const req = mockReq('Basic abc123');
    const res = mockRes();
    const next = jest.fn();

    authenticateJWT(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('returns 401 with invalid token', () => {
    const req = mockReq('Bearer invalid-token');
    const res = mockRes();
    const next = jest.fn();

    authenticateJWT(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('returns 401 with expired token', () => {
    const token = jwt.sign({ userId: 'u1', role: 'parent' }, JWT_SECRET, {
      expiresIn: '0s',
      algorithm: 'HS256',
    });
    const req = mockReq('Bearer ' + token);
    const res = mockRes();
    const next = jest.fn();

    authenticateJWT(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('returns 500 when JWT_SECRET is not set', () => {
    delete process.env.JWT_SECRET;
    const token = makeToken('user-1');
    const req = mockReq('Bearer ' + token);
    const res = mockRes();
    const next = jest.fn();

    authenticateJWT(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('requireRole', () => {
  test('calls next() when user has the required role', () => {
    const req = mockReq();
    (req as any).user = { userId: 'u1', role: 'parent' };
    const res = mockRes();
    const next = jest.fn();

    requireRole('parent')(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  test('returns 403 when user has wrong role', () => {
    const req = mockReq();
    (req as any).user = { userId: 'u1', role: 'child' };
    const res = mockRes();
    const next = jest.fn();

    requireRole('parent')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 403 when user is undefined', () => {
    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();

    requireRole('parent')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
  });
});

// token.service.test.ts
// Unit tests for JWT signing, hashing, and refresh-token persistence.

jest.mock('../../../config/database', () => ({
  __esModule: true,
  default: { connect: jest.fn(), query: jest.fn() },
  query: jest.fn(),
}));

import jwt from 'jsonwebtoken';
import { query } from '../../../config/database';
import {
  signAccessToken,
  signRefreshToken,
  signScopedToken,
  hashToken,
  verifyRefreshToken,
  issueRefreshToken,
} from '../token.service';

const mockedQuery = query as jest.MockedFunction<typeof query>;
const TEST_USER_ID = 'test-user-id';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('token.service', () => {
  describe('signAccessToken', () => {
    test('produces a valid HS256 JWT with userId and role', () => {
      const token = signAccessToken(TEST_USER_ID, 'parent');
      const decoded = jwt.decode(token) as { userId: string; role: string };

      expect(decoded.userId).toBe(TEST_USER_ID);
      expect(decoded.role).toBe('parent');
    });

    test('token is verifiable with JWT_SECRET', () => {
      const token = signAccessToken(TEST_USER_ID, 'parent');
      const decoded = jwt.verify(token, process.env.JWT_SECRET!, { algorithms: ['HS256'] });
      expect(decoded).toBeDefined();
    });
  });

  describe('signRefreshToken', () => {
    test('produces a valid refresh JWT with userId and jti', () => {
      const token = signRefreshToken(TEST_USER_ID);
      const decoded = jwt.decode(token) as { userId: string; jti: string };

      expect(decoded.userId).toBe(TEST_USER_ID);
      expect(decoded.jti).toBeDefined();
      expect(typeof decoded.jti).toBe('string');
    });

    test('each call produces a unique jti', () => {
      const t1 = signRefreshToken(TEST_USER_ID);
      const t2 = signRefreshToken(TEST_USER_ID);
      const d1 = jwt.decode(t1) as { jti: string };
      const d2 = jwt.decode(t2) as { jti: string };

      expect(d1.jti).not.toBe(d2.jti);
    });
  });

  describe('signScopedToken', () => {
    test('includes scope claim in the token', () => {
      const token = signScopedToken(TEST_USER_ID, 'parent', 'pin-verify');
      const decoded = jwt.decode(token) as { userId: string; scope: string };

      expect(decoded.userId).toBe(TEST_USER_ID);
      expect(decoded.scope).toBe('pin-verify');
    });

    test('respects custom expiresIn', () => {
      const token = signScopedToken(TEST_USER_ID, 'parent', 'test', '5m');
      const decoded = jwt.decode(token) as { exp: number; iat: number };

      const diff = decoded.exp - decoded.iat;
      expect(diff).toBeGreaterThanOrEqual(299);
      expect(diff).toBeLessThanOrEqual(301);
    });
  });

  describe('hashToken', () => {
    test('produces a 64-char hex SHA-256 hash', () => {
      const hash = hashToken('my-refresh-token');
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    test('same input always produces same hash', () => {
      const h1 = hashToken('test-token');
      const h2 = hashToken('test-token');
      expect(h1).toBe(h2);
    });

    test('different inputs produce different hashes', () => {
      const h1 = hashToken('token-a');
      const h2 = hashToken('token-b');
      expect(h1).not.toBe(h2);
    });
  });

  describe('verifyRefreshToken', () => {
    test('returns userId for valid refresh token', () => {
      const token = signRefreshToken(TEST_USER_ID);
      const result = verifyRefreshToken(token);

      expect(result.userId).toBe(TEST_USER_ID);
      expect(result.exp).toBeGreaterThan(0);
    });

    test('throws for invalid token', () => {
      expect(() => verifyRefreshToken('garbage-token')).toThrow();
    });

    test('throws for expired token', () => {
      const token = jwt.sign(
        { userId: TEST_USER_ID, jti: 'test' },
        process.env.JWT_REFRESH_SECRET!,
        { algorithm: 'HS256', expiresIn: '0s' }
      );
      expect(() => verifyRefreshToken(token)).toThrow();
    });
  });

  describe('issueRefreshToken', () => {
    test('persists hash to DB and returns raw token', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

      const token = await issueRefreshToken(TEST_USER_ID);

      expect(typeof token).toBe('string');
      expect(mockedQuery).toHaveBeenCalledTimes(1);

      const [sql, params] = mockedQuery.mock.calls[0] as [string, any[]];
      expect(sql).toContain('INSERT INTO refresh_tokens');
      expect(params[0]).toBe(TEST_USER_ID);
      expect(params[1]).toMatch(/^[a-f0-9]{64}$/);
    });
  });
});

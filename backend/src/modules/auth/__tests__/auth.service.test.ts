// auth.service.test.ts
// Unit tests for credential verification, registration, and token issuance.
// The database, bcrypt, and jsonwebtoken are mocked so no real hashing,
// signing, or DB access happens during tests.

import * as authService from '../auth.service';
import pool, { query } from '../../../config/database';
import { UnauthorizedError, ConflictError } from '../../../utils/errors';

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

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
  compare: jest.fn(),
}));

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(() => 'signed-token'),
  verify: jest.fn(),
  decode: jest.fn(() => ({ exp: Math.floor(Date.now() / 1000) + 604800 })),
}));

const mockedQuery = query as jest.MockedFunction<typeof query>;
const mockedConnect = pool.connect as jest.MockedFunction<() => Promise<any>>;

const PARENT_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

const mockClient = () => {
  const client = { query: jest.fn(), release: jest.fn() };
  mockedConnect.mockResolvedValue(client as any);
  return client;
};

const mockParentRow = {
  id: PARENT_ID,
  email: 'parent@example.com',
  name: 'Test Parent',
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('auth.service', () => {
  describe('register', () => {
    it('should create parent and child in one transaction and return a session', async () => {
      const client = mockClient();
      client.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [mockParentRow] }) // INSERT parents
        .mockResolvedValueOnce({
          rows: [{ id: 'child-id', name: 'Kid', birth_date: '2015-01-01' }],
        }) // INSERT children
        .mockResolvedValueOnce({ rows: [] }) // INSERT audit_logs (CREATE_CHILD)
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const result = await authService.register({
        name: 'Test Parent',
        email: 'Parent@Example.com ',
        password: 'password123',
        child_name: 'Kid',
        birth_date: '2015-01-01',
      });

      expect(mockedConnect).toHaveBeenCalledTimes(1);
      // Email is normalized before insert
      expect(client.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO parents'),
        ['parent@example.com', 'hashed-password', 'Test Parent']
      );
      expect(client.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO children'),
        [PARENT_ID, 'Kid', '2015-01-01']
      );
      // BEGIN, INSERT parents, INSERT children, INSERT audit_logs, COMMIT
      expect(client.query).toHaveBeenCalledTimes(5);
      expect(client.release).toHaveBeenCalledTimes(1);

      expect(result.token).toBe('signed-token');
      expect(result.refresh_token).toBe('signed-token');
      expect(result.user).toEqual(mockParentRow);
      expect(result.child).toEqual({ id: 'child-id', name: 'Kid', birth_date: '2015-01-01' });
    });

    it('should skip child creation when child_name is omitted', async () => {
      const client = mockClient();
      client.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [mockParentRow] }) // INSERT parents
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const result = await authService.register({
        name: 'Test Parent',
        email: 'parent@example.com',
        password: 'password123',
      });

      expect(result.child).toBeNull();
      expect(client.query).toHaveBeenCalledTimes(3);
    });

    it('should throw ConflictError and rollback on duplicate email', async () => {
      const client = mockClient();
      client.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockRejectedValueOnce({ code: '23505' }) // unique violation
        .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

      await expect(
        authService.register({
          name: 'Test Parent',
          email: 'parent@example.com',
          password: 'password123',
        })
      ).rejects.toThrow(ConflictError);

      expect(client.query).toHaveBeenCalledWith('ROLLBACK');
      expect(client.release).toHaveBeenCalledTimes(1);
    });

    it('should rollback when a non-unique DB error occurs', async () => {
      const client = mockClient();
      client.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockRejectedValueOnce(new Error('connection lost'))
        .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

      await expect(
        authService.register({
          name: 'Test Parent',
          email: 'parent@example.com',
          password: 'password123',
        })
      ).rejects.toThrow('connection lost');

      expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });

  describe('login', () => {
    it('should return tokens, user and child for valid credentials', async () => {
      mockedQuery
        .mockResolvedValueOnce({
          rows: [{ ...mockParentRow, password_hash: 'hashed-password' }],
        } as any) // SELECT parents
        .mockResolvedValueOnce({
          rows: [{ id: 'child-id', name: 'Kid', birth_date: '2015-01-01' }],
        } as any); // SELECT children (first child)

      const bcrypt = jest.requireMock('bcrypt');
      bcrypt.compare.mockResolvedValueOnce(true);

      const result = await authService.login('parent@example.com', 'password123');

      expect(result.user.id).toBe(PARENT_ID);
      expect(result.token).toBe('signed-token');
      expect(result.child).toEqual({ id: 'child-id', name: 'Kid', birth_date: '2015-01-01' });
      // Email is normalized before lookup
      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('FROM parents WHERE email = $1'),
        ['parent@example.com']
      );
    });

    it('should return a null child when the parent has no children', async () => {
      mockedQuery
        .mockResolvedValueOnce({
          rows: [{ ...mockParentRow, password_hash: 'hashed-password' }],
        } as any) // SELECT parents
        .mockResolvedValueOnce({ rows: [] } as any); // SELECT children (empty)

      const bcrypt = jest.requireMock('bcrypt');
      bcrypt.compare.mockResolvedValueOnce(true);

      const result = await authService.login('parent@example.com', 'password123');

      expect(result.child).toBeNull();
    });

    it('should throw UnauthorizedError for a wrong password', async () => {
      mockedQuery.mockResolvedValueOnce({
        rows: [{ ...mockParentRow, password_hash: 'hashed-password' }],
      } as any);
      const bcrypt = jest.requireMock('bcrypt');
      bcrypt.compare.mockResolvedValueOnce(false);

      await expect(
        authService.login('parent@example.com', 'wrong-password')
      ).rejects.toThrow(UnauthorizedError);
    });

    it('should throw UnauthorizedError for an unknown email', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

      await expect(
        authService.login('nobody@example.com', 'password123')
      ).rejects.toThrow(UnauthorizedError);
    });
  });

  describe('refreshAccessToken', () => {
    it('should rotate a valid refresh token and issue a new pair', async () => {
      const jwt = jest.requireMock('jsonwebtoken');
      jwt.verify.mockReturnValueOnce({ userId: PARENT_ID, exp: Date.now() / 1000 + 604800 });
      // SELECT refresh_tokens (active)
      mockedQuery.mockResolvedValueOnce({ rows: [{ revoked_at: null }] } as any);
      // UPDATE revoke old token
      mockedQuery.mockResolvedValueOnce({ rows: [] } as any);
      // INSERT new refresh token
      mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

      const result = await authService.refreshAccessToken('valid-refresh-token');

      expect(result.token).toBe('signed-token');
      expect(result.refresh_token).toBe('signed-token');
      expect(jwt.verify).toHaveBeenCalledWith(
        'valid-refresh-token',
        expect.any(String),
        { algorithms: ['HS256'] }
      );
      // The old token must be revoked during rotation
      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE refresh_tokens'),
        expect.anything()
      );
    });

    it('should reject a revoked refresh token', async () => {
      const jwt = jest.requireMock('jsonwebtoken');
      jwt.verify.mockReturnValueOnce({ userId: PARENT_ID, exp: Date.now() / 1000 + 604800 });
      mockedQuery.mockResolvedValueOnce({ rows: [{ revoked_at: new Date().toISOString() }] } as any);

      await expect(authService.refreshAccessToken('revoked-token')).rejects.toThrow(
        UnauthorizedError
      );
      // No rotation queries may run for a revoked token
      expect(mockedQuery).toHaveBeenCalledTimes(1);
    });

    it('should reject a refresh token that was never issued', async () => {
      const jwt = jest.requireMock('jsonwebtoken');
      jwt.verify.mockReturnValueOnce({ userId: PARENT_ID, exp: Date.now() / 1000 + 604800 });
      mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

      await expect(authService.refreshAccessToken('forged-token')).rejects.toThrow(
        UnauthorizedError
      );
    });

    it('should throw UnauthorizedError for an invalid refresh token', async () => {
      const jwt = jest.requireMock('jsonwebtoken');
      jwt.verify.mockImplementationOnce(() => {
        throw new Error('invalid token');
      });

      await expect(authService.refreshAccessToken('bad-token')).rejects.toThrow(
        UnauthorizedError
      );
    });
  });
});
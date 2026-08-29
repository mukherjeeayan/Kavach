// auth.emailVerification.test.ts
// Unit tests for the email-verification flow: token issuance at
// registration, verification, resend, and the email_verified flag on
// the returned AuthUser.

import * as authService from '../auth.service';
import pool, { query } from '../../../config/database';
import { BadRequestError, NotFoundError } from '../../../utils/errors';
import { sendEmail } from '../../shared/email.service';

jest.mock('../../../config/database', () => ({
  __esModule: true,
  default: { connect: jest.fn() },
  query: jest.fn(),
}));

jest.mock('../../../utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('../../shared/email.service', () => ({
  __esModule: true,
  sendEmail: jest.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../shared/token.service', () => ({
  signAccessToken: jest.fn(() => 'access-token'),
  signScopedToken: jest.fn(() => 'scoped-token'),
  issueRefreshToken: jest.fn(() => Promise.resolve('refresh-token')),
  insertRefreshToken: jest.fn(() => Promise.resolve('refresh-token')),
  hashToken: jest.fn((t: string) => `hashed:${t}`),
  verifyRefreshToken: jest.fn(),
}));

jest.mock('../../shared/audit.service', () => ({
  writeAuditLog: jest.fn().mockResolvedValue(undefined),
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
const mockedSendEmail = sendEmail as jest.MockedFunction<typeof sendEmail>;
const bcrypt = jest.requireMock('bcrypt');

const PARENT_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const TOKEN_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const RAW_TOKEN = 'a'.repeat(64);
const TOKEN_HASH = `bcrypt-hash-of-${RAW_TOKEN}`;

const mockClient = () => {
  const client = { query: jest.fn(), release: jest.fn() };
  mockedConnect.mockResolvedValue(client as any);
  return client;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockedSendEmail.mockResolvedValue(undefined);
  bcrypt.hash.mockImplementation(async (val: string) => `bcrypt-hash-of-${val}`);
  bcrypt.compare.mockImplementation(async (val: string, hash: string) => hash === `bcrypt-hash-of-${val}`);
});

describe('auth.service — email verification', () => {
  describe('register', () => {
    it('sends a verification email and returns email_verified: false', async () => {
      const client = mockClient();
      client.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({
          rows: [{ id: PARENT_ID, email: 'parent@example.com', name: 'Test Parent' }],
        }) // INSERT parents
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      // The verification token insert runs on the pool (outside the tx)
      mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

      const result = await authService.register({
        name: 'Test Parent',
        email: 'parent@example.com',
        password: 'password123',
      });

      // Verification token row inserted on the pool
      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO email_verifications'),
        expect.arrayContaining([PARENT_ID, expect.any(String)])
      );

      // Email was sent with a verify-email link
      expect(mockedSendEmail).toHaveBeenCalledTimes(1);
      const emailArg = mockedSendEmail.mock.calls[0][0];
      expect(emailArg.to).toBe('parent@example.com');
      expect(emailArg.subject).toMatch(/verify/i);
      expect(emailArg.html).toContain('/verify-email?token=');
      // The raw token in the URL must NOT be the bcrypt-hashed value
      const urlMatch = emailArg.html.match(/token=([a-f0-9]+)/);
      expect(urlMatch).not.toBeNull();
      expect(urlMatch![1]).not.toBe(`bcrypt-hash-of-${urlMatch![1]}`);

      expect(result.user.email_verified).toBe(false);
      expect(result.user.email).toBe('parent@example.com');
    });

    it('does not fail registration when the verification email cannot be sent', async () => {
      const client = mockClient();
      client.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({
          rows: [{ id: PARENT_ID, email: 'parent@example.com', name: 'Test Parent' }],
        }) // INSERT parents
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      mockedQuery.mockResolvedValueOnce({ rows: [] } as any);
      mockedSendEmail.mockRejectedValueOnce(new Error('SMTP down'));

      const result = await authService.register({
        name: 'Test Parent',
        email: 'parent@example.com',
        password: 'password123',
      });

      expect(result.user.id).toBe(PARENT_ID);
      expect(result.user.email_verified).toBe(false);
    });
  });

  describe('verifyEmail', () => {
    it('marks the parent as verified and consumes the token on a valid raw token', async () => {
      // First call: scan for live tokens
      mockedQuery.mockResolvedValueOnce({
        rows: [
          {
            id: TOKEN_ID,
            user_id: PARENT_ID,
            token_hash: TOKEN_HASH,
          },
        ],
      } as any);

      const client = mockClient();
      client.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rowCount: 1, rows: [] }) // UPDATE token verified_at (consume)
        .mockResolvedValueOnce({ rows: [] }) // UPDATE burn other live tokens for user
        .mockResolvedValueOnce({ rows: [] }) // UPDATE parents SET email_verified
        .mockResolvedValueOnce({ rows: [] }) // INSERT audit log
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const result = await authService.verifyEmail(RAW_TOKEN);

      expect(result).toEqual({ message: 'Email verified successfully' });
      expect(client.query).toHaveBeenCalledWith('BEGIN');
      expect(client.query).toHaveBeenCalledWith('COMMIT');
      expect(client.query).toHaveBeenCalledWith(
        expect.stringMatching(/UPDATE parents\s+SET email_verified\s*=\s*TRUE/i),
        [PARENT_ID]
      );
      expect(client.query).toHaveBeenCalledWith(
        expect.stringContaining('EMAIL_VERIFIED'),
        [PARENT_ID]
      );
    });

    it('throws BadRequestError when no live token matches the raw token', async () => {
      mockedQuery.mockResolvedValue({
        rows: [
          { id: TOKEN_ID, user_id: PARENT_ID, token_hash: 'some-other-hash' },
        ],
      } as any);

      await expect(authService.verifyEmail(RAW_TOKEN)).rejects.toThrow(BadRequestError);
      await expect(authService.verifyEmail(RAW_TOKEN)).rejects.toThrow(
        'Invalid or expired verification token'
      );
    });

    it('throws BadRequestError when there are no live tokens at all', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

      await expect(authService.verifyEmail(RAW_TOKEN)).rejects.toThrow(BadRequestError);
    });

    it('treats an expired token (filtered by SQL) as invalid', async () => {
      // The WHERE clause in the service already excludes expired rows.
      // We simulate "no live rows" → BadRequestError.
      mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

      await expect(authService.verifyEmail(RAW_TOKEN)).rejects.toThrow(BadRequestError);
    });

    it('throws BadRequestError when the raw token is empty or non-string', async () => {
      await expect(authService.verifyEmail('')).rejects.toThrow(BadRequestError);
      await expect(authService.verifyEmail(undefined as unknown as string)).rejects.toThrow(
        BadRequestError
      );
    });
  });

  describe('resendVerification', () => {
    it('sends a new verification email for a parent who has not verified', async () => {
      mockedQuery.mockResolvedValueOnce({
        rows: [
          {
            id: PARENT_ID,
            email: 'parent@example.com',
            name: 'Test Parent',
            email_verified: false,
          },
        ],
      } as any);

      const result = await authService.resendVerification(PARENT_ID);

      expect(result).toEqual({ message: 'Verification email sent' });
      expect(mockedSendEmail).toHaveBeenCalledTimes(1);
      const emailArg = mockedSendEmail.mock.calls[0][0];
      expect(emailArg.to).toBe('parent@example.com');
      expect(emailArg.html).toContain('/verify-email?token=');

      // A new row was inserted into email_verifications
      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO email_verifications'),
        expect.arrayContaining([PARENT_ID, expect.any(String)])
      );
    });

    it('throws BadRequestError when the parent has already verified', async () => {
      mockedQuery.mockResolvedValue({
        rows: [
          {
            id: PARENT_ID,
            email: 'parent@example.com',
            name: 'Test Parent',
            email_verified: true,
          },
        ],
      } as any);

      await expect(authService.resendVerification(PARENT_ID)).rejects.toThrow(BadRequestError);
      await expect(authService.resendVerification(PARENT_ID)).rejects.toThrow(
        'Email is already verified'
      );
      expect(mockedSendEmail).not.toHaveBeenCalled();
    });

    it('throws NotFoundError when the parent does not exist', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

      await expect(authService.resendVerification(PARENT_ID)).rejects.toThrow(NotFoundError);
      expect(mockedSendEmail).not.toHaveBeenCalled();
    });
  });

  describe('getMe', () => {
    it('returns email_verified: true when the parent is verified', async () => {
      mockedQuery.mockResolvedValueOnce({
        rows: [
          {
            id: PARENT_ID,
            email: 'parent@example.com',
            name: 'Test Parent',
            email_verified: true,
          },
        ],
      } as any);

      const user = await authService.getMe(PARENT_ID);

      expect(user).toEqual({
        id: PARENT_ID,
        email: 'parent@example.com',
        name: 'Test Parent',
        email_verified: true,
      });
    });

    it('returns email_verified: false when the parent has not verified', async () => {
      mockedQuery.mockResolvedValueOnce({
        rows: [
          {
            id: PARENT_ID,
            email: 'parent@example.com',
            name: 'Test Parent',
            email_verified: false,
          },
        ],
      } as any);

      const user = await authService.getMe(PARENT_ID);

      expect(user.email_verified).toBe(false);
    });
  });
});

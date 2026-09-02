// twoFactor.test.ts
// Unit + integration tests for the 2FA flow:
//   * RFC 6238 TOTP generation / verification (valid, invalid, expired)
//   * IDOR rejection on /2fa/* endpoints
//   * Secret persistence on enable
//   * Login flow with the 2FA challenge step
//   * Validation of 6-digit codes + base32 secrets

import request from 'supertest';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

jest.mock('../../../config/database', () => ({
  __esModule: true,
  default: { connect: jest.fn(), query: jest.fn() },
  query: jest.fn(),
}));

jest.mock('../../../utils/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('../../shared/token.service', () => ({
  signAccessToken: jest.fn(() => 'mock-access-token'),
  signScopedToken: jest.fn(() => 'mock-scoped-token'),
  issueRefreshToken: jest.fn(() => Promise.resolve('mock-refresh-token')),
  signRefreshToken: jest.fn(() => 'mock-refresh-token'),
  insertRefreshToken: jest.fn(() => Promise.resolve('mock-refresh-token')),
  hashToken: jest.fn((t: string) => `hashed::${t}`),
  verifyRefreshToken: jest.fn(),
}));

jest.mock('../../shared/audit.service', () => ({
  writeAuditLog: jest.fn().mockResolvedValue(undefined),
  extractIpFromRequest: jest.fn(() => undefined),
}));

jest.mock('../../shared/email.service', () => ({
  __esModule: true,
  sendEmail: jest.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
  compare: jest.fn(),
}));

jest.mock('../../../middleware/rateLimiter', () => ({
  authLimiter: (_req: any, _res: any, next: any) => next(),
  apiLimiter: (_req: any, _res: any, next: any) => next(),
  standardLimiter: (_req: any, _res: any, next: any) => next(),
  deviceIngestionLimiter: (_req: any, _res: any, next: any) => next(),
  verifyEmailLimiter: (_req: any, _res: any, next: any) => next(),
  securityScanLimiter: (_req: any, _res: any, next: any) => next(),
  heartbeatLimiter: (_req: any, _res: any, next: any) => next(),
  sosLimiter: (_req: any, _res: any, next: any) => next(),
  resendVerificationLimiter: (_req: any, _res: any, next: any) => next(),
}));

import app from '../../../app';
import pool, { query } from '../../../config/database';
import bcrypt from 'bcryptjs';
import * as twoFactorService from '../twoFactor.service';

const mockedQuery = query as jest.MockedFunction<typeof query>;
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

const PARENT_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const OTHER_PARENT_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const VALID_PASSWORD = 'Password1!abc';

const validAuthHeader = (id: string = PARENT_ID) =>
  `Bearer ${jwt.sign(
    { userId: id, role: 'parent' },
    process.env.JWT_SECRET!,
    { algorithm: 'HS256', expiresIn: '15m' }
  )}`;

const generateTotpAt = (secret: string, when: number): string => {
  const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const cleaned = secret.replace(/=+$/g, '').toUpperCase();
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const ch of cleaned) {
    const idx = BASE32.indexOf(ch);
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((value >> bits) & 0xff);
    }
  }
  const counter = Math.floor(when / 1000 / 30);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', Buffer.from(bytes)).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const bin =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return (bin % 10 ** 6).toString().padStart(6, '0');
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('twoFactor.service — RFC 6238 TOTP', () => {
  test('generateTotpSecret produces a 32-char base32 string (160 bits)', () => {
    const secret = twoFactorService.generateTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]+$/);
    expect(secret.length).toBeGreaterThanOrEqual(32);
  });

  test('generateTotpSecret returns a different value each call', () => {
    const a = twoFactorService.generateTotpSecret();
    const b = twoFactorService.generateTotpSecret();
    expect(a).not.toBe(b);
  });

  test('verifyTotpToken accepts a freshly-generated code (current window)', () => {
    const secret = twoFactorService.generateTotpSecret();
    const code = generateTotpAt(secret, Date.now());
    expect(twoFactorService.verifyTotpToken(secret, code)).toBe(true);
  });

  test('verifyTotpToken accepts codes from the previous 30s window', () => {
    const secret = twoFactorService.generateTotpSecret();
    const code = generateTotpAt(secret, Date.now() - 30_000);
    expect(twoFactorService.verifyTotpToken(secret, code)).toBe(true);
  });

  test('verifyTotpToken accepts codes from the next 30s window', () => {
    const secret = twoFactorService.generateTotpSecret();
    const code = generateTotpAt(secret, Date.now() + 30_000);
    expect(twoFactorService.verifyTotpToken(secret, code)).toBe(true);
  });

  test('verifyTotpToken rejects a code from 2 windows ago (expired)', () => {
    const secret = twoFactorService.generateTotpSecret();
    const code = generateTotpAt(secret, Date.now() - 120_000);
    expect(twoFactorService.verifyTotpToken(secret, code)).toBe(false);
  });

  test('verifyTotpToken rejects a totally wrong code', () => {
    const secret = twoFactorService.generateTotpSecret();
    expect(twoFactorService.verifyTotpToken(secret, '000000')).toBe(false);
  });

  test('verifyTotpToken rejects when the token is not 6 digits', () => {
    const secret = twoFactorService.generateTotpSecret();
    expect(twoFactorService.verifyTotpToken(secret, 'abc123')).toBe(false);
    expect(twoFactorService.verifyTotpToken(secret, '12345')).toBe(false);
    expect(twoFactorService.verifyTotpToken(secret, '1234567')).toBe(false);
    expect(twoFactorService.verifyTotpToken(secret, '')).toBe(false);
  });

  test('verifyTotpToken rejects when the secret is null', () => {
    expect(twoFactorService.verifyTotpToken(null, '123456')).toBe(false);
  });

  test('verifyTotpToken rejects an invalid base32 secret', () => {
    expect(twoFactorService.verifyTotpToken('not-base32!!!', '123456')).toBe(false);
  });

  test('verifyTotpToken rejects the wrong secret for a real code', () => {
    const a = twoFactorService.generateTotpSecret();
    const b = twoFactorService.generateTotpSecret();
    const code = generateTotpAt(a, Date.now());
    expect(twoFactorService.verifyTotpToken(b, code)).toBe(false);
  });
});

describe('twoFactor.service — secret persistence & recovery', () => {
  test('enable2FA persists secret, flips enabled flag, mints recovery codes', async () => {
    const secret = twoFactorService.generateTotpSecret();
    const code = generateTotpAt(secret, Date.now());

    mockedQuery
      .mockResolvedValueOnce({ rows: [{ id: PARENT_ID }] } as any)
      .mockResolvedValueOnce({ rows: [] } as any);

    const result = await twoFactorService.enable2FA(PARENT_ID, secret, code);
    expect(result.success).toBe(true);
    expect(result.recoveryCodes).toHaveLength(8);
    expect(result.recoveryCodes.every((c) => /^[0-9A-F]{8}$/.test(c))).toBe(true);

    const updateCall = mockedQuery.mock.calls.find(
      (call) => typeof call[0] === 'string' && (call[0] as string).includes('UPDATE parents')
    );
    expect(updateCall).toBeDefined();
    expect(updateCall![0]).toMatch(/two_factor_secret\s*=\s*\$1/);
    expect(updateCall![0]).toMatch(/two_factor_enabled\s*=\s*TRUE/);
    expect(updateCall![0]).toMatch(/two_factor_recovery_codes\s*=\s*\$2/);
  });

  test('enable2FA throws BadRequestError when the token does not validate', async () => {
    const secret = twoFactorService.generateTotpSecret();
    await expect(
      twoFactorService.enable2FA(PARENT_ID, secret, '000000')
    ).rejects.toThrow('Invalid TOTP token');
    expect(mockedQuery).not.toHaveBeenCalled();
  });

  test('enable2FA throws NotFoundError when the parent does not exist', async () => {
    const secret = twoFactorService.generateTotpSecret();
    const code = generateTotpAt(secret, Date.now());
    mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

    await expect(
      twoFactorService.enable2FA('nonexistent-parent-id', secret, code)
    ).rejects.toThrow('Parent not found');
  });

  test('disable2FA wipes secret, enabled flag, and recovery codes', async () => {
    mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

    await twoFactorService.disable2FA(PARENT_ID);

    const updateCall = mockedQuery.mock.calls[0];
    expect(updateCall![0]).toMatch(/two_factor_enabled\s*=\s*FALSE/);
    expect(updateCall![0]).toMatch(/two_factor_secret\s*=\s*NULL/);
    expect(updateCall![0]).toMatch(/two_factor_recovery_codes\s*=\s*NULL/);
  });

  test('consumeRecoveryCode removes the matching code from storage', async () => {
    const codes = ['AAAAAA11', 'BBBBBB22', 'CCCCCC33'];
    mockedQuery
      .mockResolvedValueOnce({ rows: [{ two_factor_recovery_codes: JSON.stringify(codes) }] } as any)
      .mockResolvedValueOnce({ rows: [] } as any);

    expect(await twoFactorService.consumeRecoveryCode(PARENT_ID, 'bbbbbb22')).toBe(true);

    const updateCall = mockedQuery.mock.calls[1];
    const persisted = JSON.parse(updateCall![1]![0] as string);
    expect(persisted).toEqual(['AAAAAA11', 'CCCCCC33']);
  });

  test('consumeRecoveryCode returns false for a non-matching code', async () => {
    const codes = ['AAAAAA11'];
    mockedQuery.mockResolvedValueOnce({
      rows: [{ two_factor_recovery_codes: JSON.stringify(codes) }],
    } as any);

    expect(await twoFactorService.consumeRecoveryCode(PARENT_ID, 'not-a-code')).toBe(false);
    expect(mockedQuery).toHaveBeenCalledTimes(1);
  });

  test('is2FAEnabled returns true only when the parent row has two_factor_enabled=true', async () => {
    mockedQuery.mockResolvedValueOnce({
      rows: [{ two_factor_enabled: true }],
    } as any);
    expect(await twoFactorService.is2FAEnabled(PARENT_ID)).toBe(true);

    mockedQuery.mockResolvedValueOnce({
      rows: [{ two_factor_enabled: false }],
    } as any);
    expect(await twoFactorService.is2FAEnabled(PARENT_ID)).toBe(false);

    mockedQuery.mockResolvedValueOnce({ rows: [] } as any);
    expect(await twoFactorService.is2FAEnabled(PARENT_ID)).toBe(false);
  });
});

describe('twoFactor.controller — IDOR hardening', () => {
  test('POST /2fa/setup requires authentication (401)', async () => {
    const res = await request(app).post('/api/v1/auth/2fa/setup').send({});
    expect(res.status).toBe(401);
  });

  test('POST /2fa/setup uses the JWT user — never trusts a body parentId', async () => {
    const res = await request(app)
      .post('/api/v1/auth/2fa/setup')
      .set('Authorization', validAuthHeader(PARENT_ID))
      .send({ parentId: OTHER_PARENT_ID });

    expect(res.status).toBe(200);
    expect(res.body.data.secret).toMatch(/^[A-Z2-7]+$/);
    expect(res.body.data.parentId).toBe(PARENT_ID);
    expect(res.body.data.parentId).not.toBe(OTHER_PARENT_ID);
  });

  test('POST /2fa/enable rejects an invalid 6-digit token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/2fa/enable')
      .set('Authorization', validAuthHeader(PARENT_ID))
      .send({ secret: 'JBSWY3DPEHPK3PXP', token: 'not-a-code' });

    expect(res.status).toBe(422);
  });

  test('POST /2fa/disable requires authentication (401)', async () => {
    const res = await request(app).post('/api/v1/auth/2fa/disable').send({});
    expect(res.status).toBe(401);
  });

  test('POST /2fa/disable wipes 2FA for the JWT user, not anyone else', async () => {
    mockedQuery.mockResolvedValueOnce({ rows: [] } as any);
    const res = await request(app)
      .post('/api/v1/auth/2fa/disable')
      .set('Authorization', validAuthHeader(PARENT_ID))
      .send({ parentId: OTHER_PARENT_ID });

    expect(res.status).toBe(200);
    const call = mockedQuery.mock.calls[0];
    const params = call![1] as unknown[];
    expect(params[params.length - 1]).toBe(PARENT_ID);
    expect(params).not.toContain(OTHER_PARENT_ID);
  });

  test('GET /2fa/recovery requires authentication (401)', async () => {
    const res = await request(app).get('/api/v1/auth/2fa/recovery').send({});
    expect(res.status).toBe(401);
  });

  test('GET /2fa/recovery looks up the JWT user only', async () => {
    mockedQuery.mockResolvedValueOnce({
      rows: [{ two_factor_recovery_codes: JSON.stringify(['AABBCC11']) }],
    } as any);
    const res = await request(app)
      .get('/api/v1/auth/2fa/recovery')
      .set('Authorization', validAuthHeader(PARENT_ID))
      .send({ parentId: OTHER_PARENT_ID });

    expect(res.status).toBe(200);
    const call = mockedQuery.mock.calls[0];
    const params = call![1] as unknown[];
    expect(params[0]).toBe(PARENT_ID);
  });
});

describe('twoFactor.controller — login challenge', () => {
  test('POST /api/v1/auth/login with 2FA enabled returns requires2fa + twoFactorToken', async () => {
    mockedQuery
      .mockResolvedValueOnce({
        rows: [
          {
            id: PARENT_ID,
            email: 'parent@example.com',
            name: 'Test',
            password_hash: 'hashed-password',
            failed_login_attempts: 0,
            login_locked_until: null,
            two_factor_enabled: true,
          },
        ],
      } as any)
      .mockResolvedValueOnce({ rows: [] } as any);

    mockedBcrypt.compare.mockResolvedValueOnce(true as never);

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'parent@example.com', password: VALID_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.data.requires2fa).toBe(true);
    expect(res.body.data.twoFactorToken).toBeDefined();
    expect(res.body.data.token).toBeUndefined();
    expect(res.body.data.refresh_token).toBeUndefined();
    const cookies = res.headers['set-cookie'] as unknown as string[] | undefined;
    if (cookies) {
      expect(cookies.find((c) => c.startsWith('kavach_access='))).toBeUndefined();
      expect(cookies.find((c) => c.startsWith('kavach_refresh='))).toBeUndefined();
    }
  });

  test('POST /api/v1/auth/login without 2FA returns normal session tokens', async () => {
    mockedQuery
      .mockResolvedValueOnce({
        rows: [
          {
            id: PARENT_ID,
            email: 'parent@example.com',
            name: 'Test',
            password_hash: 'hashed-password',
            failed_login_attempts: 0,
            login_locked_until: null,
            two_factor_enabled: false,
          },
        ],
      } as any)
      .mockResolvedValueOnce({ rows: [] } as any)
      .mockResolvedValueOnce({ rows: [] } as any);

    mockedBcrypt.compare.mockResolvedValueOnce(true as never);

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'parent@example.com', password: VALID_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.data.requires2fa).toBeUndefined();
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.refresh_token).toBeDefined();
  });

  test('POST /api/v1/auth/2fa/challenge rejects an expired / invalid twoFactorToken', async () => {
    const res = await request(app)
      .post('/api/v1/auth/2fa/challenge')
      .send({ twoFactorToken: 'this-is-not-a-jwt', token: '123456' });

    expect(res.status).toBe(401);
  });

  test('POST /api/v1/auth/2fa/challenge rejects a scoped token that is not a 2FA token', async () => {
    const pinToken = jwt.sign(
      { userId: PARENT_ID, role: 'parent', scope: 'pin' },
      process.env.JWT_SECRET!,
      { algorithm: 'HS256', expiresIn: '5m' }
    );

    const res = await request(app)
      .post('/api/v1/auth/2fa/challenge')
      .send({ twoFactorToken: pinToken, token: '123456' });

    expect(res.status).toBe(401);
  });

  test('POST /api/v1/auth/2fa/challenge rejects a wrong TOTP code (401)', async () => {
    const twoFactorToken = jwt.sign(
      { userId: PARENT_ID, role: 'parent', scope: 'two-factor' },
      process.env.JWT_SECRET!,
      { algorithm: 'HS256', expiresIn: '5m' }
    );

    mockedQuery
      .mockResolvedValueOnce({
        rows: [
          { two_factor_secret: 'JBSWY3DPEHPK3PXP', two_factor_enabled: true },
        ],
      } as any)
      .mockResolvedValueOnce({
        rows: [{ two_factor_recovery_codes: null }],
      } as any);

    const res = await request(app)
      .post('/api/v1/auth/2fa/challenge')
      .send({ twoFactorToken, token: '000000' });

    expect(res.status).toBe(401);
  });

  test('POST /api/v1/auth/2fa/challenge accepts a valid TOTP and issues real session tokens', async () => {
    const secret = twoFactorService.generateTotpSecret();
    const code = generateTotpAt(secret, Date.now());

    const twoFactorToken = jwt.sign(
      { userId: PARENT_ID, role: 'parent', scope: 'two-factor' },
      process.env.JWT_SECRET!,
      { algorithm: 'HS256', expiresIn: '5m' }
    );

    mockedQuery
      .mockResolvedValueOnce({
        rows: [{ two_factor_secret: secret, two_factor_enabled: true }],
      } as any)
      .mockResolvedValueOnce({
        rows: [
          {
            id: PARENT_ID,
            email: 'parent@example.com',
            name: 'Test',
            email_verified: true,
          },
        ],
      } as any)
      .mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(app)
      .post('/api/v1/auth/2fa/challenge')
      .send({ twoFactorToken, token: code });

    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.refresh_token).toBeDefined();
    expect(res.body.data.user.id).toBe(PARENT_ID);

    const cookies = res.headers['set-cookie'] as unknown as string[] | undefined;
    expect(cookies).toBeDefined();
    expect(cookies!.find((c) => c.startsWith('kavach_access='))).toBeDefined();
    expect(cookies!.find((c) => c.startsWith('kavach_refresh='))).toBeDefined();
  });

  test('POST /api/v1/auth/2fa/challenge rejects an invalid 6-digit code via Zod (422)', async () => {
    const twoFactorToken = jwt.sign(
      { userId: PARENT_ID, role: 'parent', scope: 'two-factor' },
      process.env.JWT_SECRET!,
      { algorithm: 'HS256', expiresIn: '5m' }
    );

    const res = await request(app)
      .post('/api/v1/auth/2fa/challenge')
      .send({ twoFactorToken, token: 'abc' });

    expect(res.status).toBe(422);
  });
});
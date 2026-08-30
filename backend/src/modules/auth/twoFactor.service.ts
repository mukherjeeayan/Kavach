// twoFactor.service.ts
// Two-Factor Authentication service for parent accounts.
// TOTP per RFC 6238 (SHA-1, 30-second step, 6 digits, ±1 window).
// No external `speakeasy` / `qrcode` dependencies — pure node:crypto.
//
// Verification model:
//   * setup() generates a fresh 160-bit base32 secret + otpauth URL.
//   * The frontend shows the QR (we hand back the otpauth URL as a data
//     URI; production would render a real QR via the device camera).
//   * enable() verifies the first TOTP against the secret, persists the
//     secret on parents.two_factor_secret, flips two_factor_enabled=true,
//     and mints recovery codes.
//   * verify2FAChallenge() runs during the post-password step in login.
//   * Recovery codes are single-use; consumption strips the used code
//     from the stored JSON array.

import crypto from 'crypto';
import { query } from '../../config/database';
import {
  BadRequestError,
  NotFoundError,
  UnauthorizedError,
} from '../../utils/errors';

const TOTP_ISSUER = 'Kavach';
const TOTP_DIGITS = 6;
const TOTP_PERIOD = 30; // seconds
const TOTP_WINDOW = 1; // accept codes from the previous or next 30s window
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

const base32Decode = (input: string): Buffer => {
  const cleaned = input.replace(/=+$/g, '').toUpperCase();
  if (!/^[A-Z2-7]+$/.test(cleaned)) {
    throw new Error('Invalid base32');
  }

  let bits = 0;
  let value = 0;
  const out: number[] = [];

  for (const ch of cleaned) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx === -1) throw new Error('Invalid base32 character');
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out.push((value >> bits) & 0xff);
    }
  }

  return Buffer.from(out);
};

const base32Encode = (bytes: Buffer): string => {
  let bits = 0;
  let value = 0;
  let out = '';

  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out += BASE32_ALPHABET[(value >> bits) & 0x1f];
    }
  }
  if (bits > 0) {
    out += BASE32_ALPHABET[(value << (5 - bits)) & 0x1f];
  }
  return out;
};

export const generateTotpSecret = (): string => {
  return base32Encode(crypto.randomBytes(20));
};

export const generateTotpQrCode = (
  secret: string,
  accountName: string = 'Kavach parent'
): string => {
  const encodedAccountName = encodeURIComponent(accountName);
  const otpauthUrl =
    `otpauth://totp/${TOTP_ISSUER}:${encodedAccountName}` +
    `?secret=${secret}&issuer=${TOTP_ISSUER}` +
    `&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_PERIOD}`;
  return `data:image/svg+xml;base64,${Buffer.from(otpauthUrl).toString('base64')}`;
};

const totpAtCounter = (secret: Buffer, counter: number): string => {
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeBigUInt64BE(BigInt(counter));

  const hmac = crypto.createHmac('sha1', secret).update(counterBuf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const code = (binary % 10 ** TOTP_DIGITS).toString().padStart(TOTP_DIGITS, '0');
  return code;
};

export const verifyTotpToken = (secret: string | null, token: string): boolean => {
  if (!secret) return false;
  if (!token || !/^\d{6}$/.test(token)) return false;

  let secretBytes: Buffer;
  try {
    secretBytes = base32Decode(secret);
  } catch {
    return false;
  }
  if (secretBytes.length === 0) return false;

  const now = Math.floor(Date.now() / 1000);
  const counter = Math.floor(now / TOTP_PERIOD);

  for (let i = -TOTP_WINDOW; i <= TOTP_WINDOW; i++) {
    const candidate = totpAtCounter(secretBytes, counter + i);
    const a = Buffer.from(candidate);
    const b = Buffer.from(token);
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
      return true;
    }
  }
  return false;
};

export const getTotpSecret = async (parentId: string): Promise<string | null> => {
  const result = await query(
    `SELECT two_factor_secret, two_factor_enabled FROM parents WHERE id = $1`,
    [parentId]
  );
  if (result.rows.length === 0) return null;
  if (result.rows[0].two_factor_enabled !== true) return null;
  return (result.rows[0].two_factor_secret as string | null) ?? null;
};

export const is2FAEnabled = async (parentId: string): Promise<boolean> => {
  const result = await query(
    `SELECT two_factor_enabled FROM parents WHERE id = $1`,
    [parentId]
  );
  if (result.rows.length === 0) return false;
  return result.rows[0].two_factor_enabled === true;
};

export const enable2FA = async (
  parentId: string,
  secret: string,
  token: string
): Promise<{ success: true; recoveryCodes: string[] }> => {
  if (!verifyTotpToken(secret, token)) {
    throw new BadRequestError('Invalid TOTP token');
  }

  const existing = await query(`SELECT id FROM parents WHERE id = $1`, [parentId]);
  if (existing.rows.length === 0) {
    throw new NotFoundError('Parent not found');
  }

  const recoveryCodes = generateRecoveryCodes();
  const recoveryCodesJson = JSON.stringify(recoveryCodes);

  await query(
    `UPDATE parents
        SET two_factor_secret = $1,
            two_factor_enabled = TRUE,
            two_factor_recovery_codes = $2
      WHERE id = $3`,
    [secret, recoveryCodesJson, parentId]
  );

  return { success: true, recoveryCodes };
};

const generateRecoveryCodes = (): string[] => {
  const codes: string[] = [];
  for (let i = 0; i < 8; i++) {
    codes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
  }
  return codes;
};

export const disable2FA = async (parentId: string): Promise<{ success: true }> => {
  await query(
    `UPDATE parents
        SET two_factor_enabled = FALSE,
            two_factor_secret = NULL,
            two_factor_recovery_codes = NULL
      WHERE id = $1`,
    [parentId]
  );
  return { success: true };
};

export const getRecoveryCodes = async (parentId: string): Promise<string[]> => {
  const result = await query(
    `SELECT two_factor_recovery_codes FROM parents
      WHERE id = $1 AND two_factor_enabled = true`,
    [parentId]
  );
  if (result.rows.length === 0) return [];
  const storedCodes = result.rows[0].two_factor_recovery_codes;
  if (!storedCodes) return [];
  try {
    return JSON.parse(storedCodes) as string[];
  } catch {
    return [];
  }
};

export const rotateRecoveryCodes = async (parentId: string): Promise<string[]> => {
  const newCodes = generateRecoveryCodes();
  await query(
    `UPDATE parents SET two_factor_recovery_codes = $1 WHERE id = $2`,
    [JSON.stringify(newCodes), parentId]
  );
  return newCodes;
};

export const consumeRecoveryCode = async (
  parentId: string,
  code: string
): Promise<boolean> => {
  if (!code) return false;
  const normalized = code.trim().toUpperCase();

  const result = await query(
    `SELECT two_factor_recovery_codes FROM parents
      WHERE id = $1 AND two_factor_enabled = true`,
    [parentId]
  );
  if (result.rows.length === 0) return false;
  const stored = result.rows[0].two_factor_recovery_codes;
  if (!stored) return false;

  let codes: string[];
  try {
    codes = JSON.parse(stored) as string[];
  } catch {
    return false;
  }

  const idx = codes.indexOf(normalized);
  if (idx === -1) return false;
  codes.splice(idx, 1);

  await query(
    `UPDATE parents SET two_factor_recovery_codes = $1 WHERE id = $2`,
    [JSON.stringify(codes), parentId]
  );
  return true;
};

export const verify2FAChallenge = async (
  parentId: string,
  token: string
): Promise<void> => {
  const secret = await getTotpSecret(parentId);
  if (secret && verifyTotpToken(secret, token)) {
    return;
  }
  const consumed = await consumeRecoveryCode(parentId, token);
  if (consumed) return;
  throw new UnauthorizedError('Invalid 2FA code');
};
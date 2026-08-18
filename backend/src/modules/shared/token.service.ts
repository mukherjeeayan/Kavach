// token.service.ts
// JWT signing, hashing, and refresh-token persistence/rotation — the
// cryptographic core shared by the whole auth flow. Kept separate from
// auth.service so credential logic and token mechanics stay decoupled.

import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { query } from '../../config/database';

const accessSecret = process.env.JWT_SECRET as string;
const refreshSecret = process.env.JWT_REFRESH_SECRET as string;
const accessExpiresIn = (process.env.JWT_EXPIRES_IN || '15m') as jwt.SignOptions['expiresIn'];
const refreshExpiresIn = (process.env.JWT_REFRESH_EXPIRES_IN || '7d') as jwt.SignOptions['expiresIn'];

export const signAccessToken = (userId: string, role: string): string =>
  jwt.sign({ userId, role }, accessSecret, { algorithm: 'HS256', expiresIn: accessExpiresIn });

export const signRefreshToken = (userId: string): string =>
  jwt.sign({ userId }, refreshSecret, { algorithm: 'HS256', expiresIn: refreshExpiresIn });

// Only the SHA-256 hash of a refresh token is ever persisted.
export const hashToken = (token: string): string =>
  crypto.createHash('sha256').update(token).digest('hex');

/**
 * Issue a new refresh token and persist its hash so rotation and
 * revocation tracking work.
 */
export const issueRefreshToken = async (userId: string): Promise<string> => {
  const token = signRefreshToken(userId);
  const decoded = jwt.decode(token) as { exp: number };
  await query(
    `INSERT INTO refresh_tokens (parent_id, token_hash, expires_at)
     VALUES ($1, $2, to_timestamp($3))`,
    [userId, hashToken(token), decoded.exp]
  );
  return token;
};

/**
 * Verify a refresh token signature. Throws jsonwebtoken errors on
 * invalid/expired tokens; auth.service translates them to 401.
 */
export const verifyRefreshToken = (
  token: string
): { userId: string; exp: number } => {
  return jwt.verify(token, refreshSecret, { algorithms: ['HS256'] }) as {
    userId: string;
    exp: number;
  };
};
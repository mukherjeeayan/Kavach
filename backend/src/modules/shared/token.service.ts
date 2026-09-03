// token.service.ts
// JWT signing, hashing, and refresh-token persistence/rotation — the
// cryptographic core shared by the whole auth flow. Kept separate from
// auth.service so credential logic and token mechanics stay decoupled.
//
// SECURITY: Supports RS256 (asymmetric) for access tokens when
// JWT_PRIVATE_KEY and JWT_PUBLIC_KEY are set. Falls back to HS256
// (symmetric) for development only. Refresh tokens always use RS256
// when keys are available.

import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import fs from 'fs';
import { query } from '../../config/database';

// Load RSA keys if available (production), fallback to HMAC (development)
let accessSecret: string | Buffer;
let refreshSecret: string | Buffer;
let accessAlgorithm: jwt.Algorithm = 'HS256';
let refreshAlgorithm: jwt.Algorithm = 'HS256';

try {
  if (process.env.JWT_PRIVATE_KEY && process.env.JWT_PUBLIC_KEY) {
    accessSecret = fs.readFileSync(process.env.JWT_PRIVATE_KEY, 'utf8');
    accessAlgorithm = 'RS256';
    refreshSecret = fs.readFileSync(process.env.JWT_PRIVATE_KEY, 'utf8');
    refreshAlgorithm = 'RS256';
    console.log('[TokenService] Using RS256 asymmetric JWT signing');
  } else {
    accessSecret = process.env.JWT_SECRET as string;
    refreshSecret = process.env.JWT_REFRESH_SECRET as string;
    console.log('[TokenService] Using HS256 symmetric JWT signing (development only)');
  }
} catch {
  accessSecret = process.env.JWT_SECRET as string;
  refreshSecret = process.env.JWT_REFRESH_SECRET as string;
}

const accessExpiresIn = (process.env.JWT_EXPIRES_IN || '15m') as jwt.SignOptions['expiresIn'];
const refreshExpiresIn = (process.env.JWT_REFRESH_EXPIRES_IN || '14d') as jwt.SignOptions['expiresIn'];

export interface SubscriptionContext {
  subscription_tier: string;        // 'FREE' | 'TRIAL' | 'PREMIUM'
  trial_expires_at?: string | null; // ISO date string
}

export const signAccessToken = (userId: string, role: string, sub?: SubscriptionContext): string => {
  const payload: Record<string, unknown> = { userId, role };
  if (sub) {
    payload.subscription_tier = sub.subscription_tier;
    if (sub.trial_expires_at) payload.trial_expires_at = sub.trial_expires_at;
  }
  return jwt.sign(payload, accessSecret, { algorithm: accessAlgorithm, expiresIn: accessExpiresIn });
};

/**
 * Short-lived scoped token used for secondary authentication factors
 * (PIN verification, biometric unlock). Carries a `scope` claim so
 * callers can distinguish these from full access tokens.
 */
export const signScopedToken = (
  userId: string,
  role: string,
  scope: string,
  expiresIn: jwt.SignOptions['expiresIn'] = '15m'
): string =>
  jwt.sign({ userId, role, scope }, accessSecret, { algorithm: accessAlgorithm, expiresIn });

export const signRefreshToken = (userId: string): string =>
  jwt.sign(
    // jti makes every token unique even when two are issued in the
    // same second (same iat), which would otherwise produce identical
    // hashes and collide on refresh_tokens.token_hash.
    { userId, jti: crypto.randomUUID() },
    refreshSecret,
    { algorithm: refreshAlgorithm, expiresIn: refreshExpiresIn }
  );

// Only the SHA-256 hash of a refresh token is ever persisted.
export const hashToken = (token: string): string =>
  crypto.createHash('sha256').update(token).digest('hex');

/**
 * Issue a new refresh token and persist its hash so rotation and
 * revocation tracking work. When `familyId` is provided the token is
 * linked to a session family so reuse detection can revoke the whole
 * lineage.
 */
export const issueRefreshToken = async (
  userId: string,
  familyId?: string
): Promise<string> => {
  const token = signRefreshToken(userId);
  const decoded = jwt.decode(token) as { exp: number };
  await query(
    `INSERT INTO refresh_tokens (parent_id, token_hash, expires_at, family_id)
     VALUES ($1, $2, to_timestamp($3), $4)`,
    [userId, hashToken(token), decoded.exp, familyId ?? null]
  );
  return token;
};

/**
 * Sign a fresh refresh token and persist it on the provided transaction
 * client (used inside the atomic rotation). Returns the raw token.
 */
export const insertRefreshToken = async (
  client: { query: (sql: string, params?: unknown[]) => Promise<unknown> },
  parentId: string,
  familyId: string | null
): Promise<string> => {
  const token = signRefreshToken(parentId);
  const decoded = jwt.decode(token) as { exp: number };
  await client.query(
    `INSERT INTO refresh_tokens (parent_id, token_hash, expires_at, family_id)
     VALUES ($1, $2, to_timestamp($3), $4)`,
    [parentId, hashToken(token), decoded.exp, familyId]
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
  return jwt.verify(token, refreshSecret, { algorithms: ['RS256', 'HS256'] }) as {
    userId: string;
    exp: number;
  };
};
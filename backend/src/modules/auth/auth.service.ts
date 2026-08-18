// auth.service.ts
// Credential verification, registration, and session orchestration.
// Token mechanics live in ../shared/token.service.

import bcrypt from 'bcrypt';
import pool, { query } from '../../config/database';
import { UnauthorizedError, ConflictError } from '../../utils/errors';
import {
  signAccessToken,
  issueRefreshToken,
  hashToken,
  verifyRefreshToken,
} from '../shared/token.service';
import logger from '../../utils/logger';

export { UnauthorizedError };

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

const bcryptRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '10', 10);

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  child_name?: string;
  birth_date?: string;
}

export interface ChildProfile {
  id: string;
  name: string;
  birth_date: string | null;
}

/**
 * Create a parent account (with an optional first child profile) and
 * return a session so the parent is logged in immediately.
 * Registration is atomic: parent + child either both exist or neither.
 */
export const register = async (
  input: RegisterInput
): Promise<{ token: string; refresh_token: string; user: AuthUser; child: ChildProfile | null }> => {
  const email = input.email.toLowerCase().trim();
  const passwordHash = await bcrypt.hash(input.password, bcryptRounds);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let parentResult;
    try {
      parentResult = await client.query(
        `INSERT INTO parents (email, password_hash, name)
         VALUES ($1, $2, $3)
         RETURNING id, email, name`,
        [email, passwordHash, input.name.trim()]
      );
    } catch (err: any) {
      // 23505 = unique_violation on parents.email
      if (err?.code === '23505') {
        throw new ConflictError('An account with this email already exists');
      }
      throw err;
    }

    const parent = parentResult.rows[0];

    let child: ChildProfile | null = null;
    if (input.child_name && input.child_name.trim()) {
      const childResult = await client.query(
        `INSERT INTO children (parent_id, name, birth_date)
         VALUES ($1, $2, $3)
         RETURNING id, name, birth_date`,
        [parent.id, input.child_name.trim(), input.birth_date || null]
      );
      child = childResult.rows[0];
    }

    await client.query('COMMIT');

    const user: AuthUser = { id: parent.id, email: parent.email, name: parent.name };
    logger.info(`Parent registered: ${user.id}`);
    if (child) {
      logger.info(`Child profile created as part of registration: ${child.id}`);
    }

    return {
      token: signAccessToken(user.id, 'parent'),
      refresh_token: await issueRefreshToken(user.id),
      user,
      child,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Verify parent credentials and return access + refresh tokens.
 * Throws UnauthorizedError on any failure — no user enumeration
 * (same message whether the email or the password is wrong).
 */
export const login = async (email: string, password: string): Promise<{ token: string; refresh_token: string; user: AuthUser }> => {
  const result = await query(
    `SELECT id, email, name, password_hash FROM parents WHERE email = $1`,
    [email.toLowerCase().trim()]
  );

  const row = result.rows[0];
  const valid = row && password && (await bcrypt.compare(password, row.password_hash));

  if (!valid) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const user: AuthUser = { id: row.id, email: row.email, name: row.name };
  logger.info(`Parent logged in: ${user.id}`);

  return {
    token: signAccessToken(user.id, 'parent'),
    refresh_token: await issueRefreshToken(user.id),
    user,
  };
};

/**
 * Rotate a refresh token: verify the signature, confirm the persisted
 * hash is still active (not revoked / expired), then revoke the old
 * token and issue a fresh one.  Reusing a revoked token — the classic
 * token-theft signal — is rejected with 401.
 */
export const refreshAccessToken = async (
  refreshToken: string
): Promise<{ token: string; refresh_token: string }> => {
  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch {
    throw new UnauthorizedError('Invalid or expired refresh token');
  }

  const stored = await query(
    `SELECT revoked_at, expires_at FROM refresh_tokens WHERE token_hash = $1`,
    [hashToken(refreshToken)]
  );
  const row = stored.rows[0];

  if (!row || row.revoked_at !== null) {
    throw new UnauthorizedError('Invalid or expired refresh token');
  }

  // Revoke the old token, then issue its replacement.
  await query(`UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1`, [
    hashToken(refreshToken),
  ]);

  return {
    token: signAccessToken(decoded.userId, 'parent'),
    refresh_token: await issueRefreshToken(decoded.userId),
  };
};
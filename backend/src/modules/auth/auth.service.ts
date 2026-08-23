// auth.service.ts
// Credential verification, registration, and session orchestration.
// Token mechanics live in ../shared/token.service.

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import pool, { query } from '../../config/database';
import { UnauthorizedError, ConflictError, NotFoundError, ForbiddenError } from '../../utils/errors';
import {
  signAccessToken,
  signScopedToken,
  issueRefreshToken,
  insertRefreshToken,
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

const bcryptRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10);

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
      const newChild: ChildProfile = childResult.rows[0];
      child = newChild;
      await client.query(
        `INSERT INTO audit_logs (actor_id, target_child_id, action, resource_type, details)
         VALUES ($1, $2, 'CREATE_CHILD', 'children', $3)`,
        [parent.id, newChild.id, JSON.stringify({ name: newChild.name })]
      );
    }

    await client.query('COMMIT');

    const user: AuthUser = { id: parent.id, email: parent.email, name: parent.name };
    logger.info(`Parent registered: ${user.id}`);
    if (child) {
      logger.info(`Child profile created as part of registration: ${child.id}`);
    }

    return {
      token: signAccessToken(user.id, 'parent'),
      refresh_token: await issueRefreshToken(user.id, crypto.randomUUID()),
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
export const login = async (
  email: string,
  password: string
): Promise<{ token: string; refresh_token: string; user: AuthUser; child: ChildProfile | null }> => {
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

  // Surface the first child profile (mirrors the register response) so
  // the dashboard can deep-link straight into a child's workspace.
  const childResult = await query(
    `SELECT id, name, birth_date FROM children
     WHERE parent_id = $1
     ORDER BY created_at ASC
     LIMIT 1`,
    [user.id]
  );

  return {
    token: signAccessToken(user.id, 'parent'),
    refresh_token: await issueRefreshToken(user.id, crypto.randomUUID()),
    user,
    child: childResult.rows[0] || null,
  };
};

/**
 * Rotate a refresh token atomically: verify the signature, lock the
 * persisted row (SELECT ... FOR UPDATE inside a transaction), confirm
 * it is still active, then revoke it and issue a fresh one in the same
 * session family. Reusing a revoked token — the classic token-theft
 * signal — revokes the ENTIRE family and is rejected with 401.
 */
export const refreshAccessToken = async (
  refreshToken: string
): Promise<{ token: string; refresh_token: string }> => {
  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
    if (!decoded || !decoded.userId) {
      throw new Error('malformed refresh token payload');
    }
  } catch {
    throw new UnauthorizedError('Invalid or expired refresh token');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const stored = await client.query(
      `SELECT revoked_at, family_id FROM refresh_tokens
       WHERE token_hash = $1
       FOR UPDATE`,
      [hashToken(refreshToken)]
    );
    const row = stored.rows[0];

    if (!row) {
      await client.query('ROLLBACK');
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    if (row.revoked_at !== null) {
      // Token-theft signal: a rotated (already-used) token was replayed.
      // Kill every token in this session family.
      if (row.family_id) {
        await client.query(
          `UPDATE refresh_tokens SET revoked_at = now()
           WHERE family_id = $1 AND revoked_at IS NULL`,
          [row.family_id]
        );
        logger.warn(
          `Refresh-token reuse detected for parent ${decoded.userId}; family ${row.family_id} revoked`
        );
      }
      await client.query('COMMIT');
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    await client.query(`UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1`, [
      hashToken(refreshToken),
    ]);

    // Sign + persist the replacement inside token.service (keeps JWT
    // mechanics in one place).
    const newToken = await insertRefreshToken(client, decoded.userId, row.family_id);

    await client.query('COMMIT');

    return {
      token: signAccessToken(decoded.userId, 'parent'),
      refresh_token: newToken,
    };
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // transaction may already be closed after COMMIT in reuse path
    }
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Revoke a refresh token on logout. Idempotent and never throws for
 * unknown/already-revoked tokens: the client may call this with a
 * stale or forged token and the endpoint simply reports no-op.
 */
export const logout = async (refreshToken: string): Promise<{ revoked: boolean }> => {
  const result = await query(
    `UPDATE refresh_tokens SET revoked_at = now()
     WHERE token_hash = $1 AND revoked_at IS NULL`,
    [hashToken(refreshToken)]
  );
  return { revoked: (result.rowCount ?? 0) > 0 };
};

/**
 * Set (or rotate) the parent's device-unlock PIN. Stored as a bcrypt
 * hash — never plaintext.
 */
export const setParentPin = async (parentId: string, pin: string): Promise<void> => {
  const pinHash = await bcrypt.hash(pin, bcryptRounds);
  await query(`UPDATE parents SET parental_pin_hash = $1 WHERE id = $2`, [pinHash, parentId]);
};

const MAX_PIN_ATTEMPTS = 5;
const PIN_LOCKOUT_MINUTES = 15;

/**
 * Verify the parent's PIN and return a short-lived scoped token used
 * to unlock parent controls on the child's device. Brute-force is
 * throttled with a per-account failed-attempt counter and temporary
 * lockout (5 failures → 15 min lock).
 */
export const verifyPin = async (
  email: string,
  pin: string
): Promise<{ token: string; user: AuthUser }> => {
  const result = await query(
    `SELECT id, email, name, parental_pin_hash, failed_pin_attempts, pin_locked_until
     FROM parents WHERE email = $1`,
    [email.toLowerCase().trim()]
  );
  const row = result.rows[0];

  if (!row) {
    throw new UnauthorizedError('Invalid PIN');
  }

  if (
    row.pin_locked_until &&
    new Date(row.pin_locked_until).getTime() > Date.now()
  ) {
    throw new ForbiddenError('Too many failed attempts. Try again later.');
  }

  const valid =
    row.parental_pin_hash && (await bcrypt.compare(pin, row.parental_pin_hash));

  if (!valid) {
    // Lock the account when the failure threshold is reached.
    await query(
      `UPDATE parents
       SET failed_pin_attempts = failed_pin_attempts + 1,
           pin_locked_until = CASE
             WHEN failed_pin_attempts + 1 >= $2 THEN now() + ($3 || ' minutes')::interval
             ELSE pin_locked_until
           END
       WHERE id = $1`,
      [row.id, MAX_PIN_ATTEMPTS, PIN_LOCKOUT_MINUTES.toString()]
    );
    throw new UnauthorizedError('Invalid PIN');
  }

  // Successful verification clears any failure counters.
  await query(
    `UPDATE parents SET failed_pin_attempts = 0, pin_locked_until = NULL WHERE id = $1`,
    [row.id]
  );

  const user: AuthUser = { id: row.id, email: row.email, name: row.name };
  return {
    token: signScopedToken(row.id, 'parent', 'pin', '15m'),
    user,
  };
};

/**
 * Exchange the parent's password for a short-lived scoped token used
 * immediately after a successful biometric prompt.
 */
export const issueBiometricToken = async (
  email: string,
  password: string
): Promise<{ token: string; user: AuthUser }> => {
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
  return {
    token: signScopedToken(row.id, 'parent', 'biometric', '15m'),
    user,
  };
};

/**
 * Forgot password: look up the parent by email and generate a short-lived
 * reset token. Always returns success to prevent email enumeration.
 * In production, the token would be emailed to the user.
 */
export const forgotPassword = async (
  email: string
): Promise<{ message: string }> => {
  const result = await query(
    `SELECT id FROM parents WHERE email = $1`,
    [email.toLowerCase().trim()]
  );

  const row = result.rows[0];
  if (row) {
    const resetToken = jwt.sign(
      { userId: row.id, purpose: 'password-reset', jti: crypto.randomUUID() },
      process.env.JWT_SECRET!,
      { expiresIn: '1h', algorithm: 'HS256' }
    );
    // Persist the hash so each token can be used exactly once.
    await query(
      `INSERT INTO password_reset_tokens (parent_id, token_hash, expires_at)
       VALUES ($1, $2, now() + interval '1 hour')`,
      [row.id, hashToken(resetToken)]
    );
    logger.info('Password reset requested');
    const { sendPasswordResetEmail } = await import('../shared/email.service');
    await sendPasswordResetEmail(email.toLowerCase().trim(), resetToken);
  }

  // Always return success to prevent email enumeration
  return { message: 'If an account with that email exists, a password reset link has been sent.' };
};

/**
 * Reset password: verify the reset token (signature + one-time-use
 * marker), update the password, revoke all existing sessions, and mark
 * the reset token as consumed — atomically.
 */
export const resetPassword = async (
  token: string,
  newPassword: string
): Promise<{ message: string }> => {
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET!, { algorithms: ['HS256'] }) as {
      userId: string;
      purpose: string;
    };
  } catch {
    throw new UnauthorizedError('Invalid or expired reset token');
  }

  if (decoded.purpose !== 'password-reset') {
    throw new UnauthorizedError('Invalid reset token');
  }

  const passwordHash = await bcrypt.hash(newPassword, bcryptRounds);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Atomically consume the one-time token: only the first request
    // that flips used_at from NULL succeeds.
    const used = await client.query(
      `UPDATE password_reset_tokens
       SET used_at = now()
       WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()`,
      [hashToken(token)]
    );
    if ((used.rowCount ?? 0) === 0) {
      throw new UnauthorizedError('Invalid or expired reset token');
    }

    const result = await client.query(
      `UPDATE parents SET password_hash = $1 WHERE id = $2`,
      [passwordHash, decoded.userId]
    );

    if ((result.rowCount ?? 0) === 0) {
      throw new NotFoundError('User not found');
    }

    // Password compromise recovery: kill every active session.
    await client.query(
      `UPDATE refresh_tokens SET revoked_at = now()
       WHERE parent_id = $1 AND revoked_at IS NULL`,
      [decoded.userId]
    );

    await client.query(
      `INSERT INTO audit_logs (actor_id, action, resource_type, details)
       VALUES ($1, 'PASSWORD_RESET', 'parents', '{}')`,
      [decoded.userId]
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  logger.info(`Password reset completed for user ${decoded.userId}`);
  return { message: 'Password has been reset successfully.' };
};
// ---------------------------------------------------------------------------
// Account self-service (GET /auth/me, PUT /auth/profile, PUT /auth/password)
// ---------------------------------------------------------------------------

export const getMe = async (parentId: string): Promise<AuthUser> => {
  const result = await query(
    `SELECT id, email, name FROM parents WHERE id = $1`,
    [parentId]
  );
  const row = result.rows[0];
  if (!row) throw new NotFoundError('User not found');
  return { id: row.id, email: row.email, name: row.name };
};

export const updateProfile = async (
  parentId: string,
  name: string
): Promise<AuthUser> => {
  const result = await query(
    `UPDATE parents SET name = $1 WHERE id = $2
     RETURNING id, email, name`,
    [name.trim(), parentId]
  );
  if ((result.rowCount ?? 0) === 0) throw new NotFoundError('User not found');
  const row = result.rows[0];
  return { id: row.id, email: row.email, name: row.name };
};

/**
 * Change password: requires the current password. On success every
 * other refresh token in the account is revoked so stolen sessions
 * do not survive a credential change.
 */
export const changePassword = async (
  parentId: string,
  currentPassword: string,
  newPassword: string
): Promise<{ message: string }> => {
  const result = await query(
    `SELECT password_hash FROM parents WHERE id = $1`,
    [parentId]
  );
  const row = result.rows[0];
  if (!row || !(await bcrypt.compare(currentPassword, row.password_hash))) {
    throw new UnauthorizedError('Current password is incorrect');
  }

  const passwordHash = await bcrypt.hash(newPassword, bcryptRounds);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`UPDATE parents SET password_hash = $1 WHERE id = $2`, [
      passwordHash,
      parentId,
    ]);
    // Revoke all sessions — including the caller's own refresh token.
    await client.query(
      `UPDATE refresh_tokens SET revoked_at = now()
       WHERE parent_id = $1 AND revoked_at IS NULL`,
      [parentId]
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  logger.info(`Password changed for user ${parentId}`);
  return { message: 'Password has been changed successfully.' };
};

/**
 * Revoke every active session for the parent ("sign out of all
 * devices"). Returns the number of sessions revoked.
 */
export const logoutAll = async (parentId: string): Promise<{ revoked: number }> => {
  const result = await query(
    `UPDATE refresh_tokens SET revoked_at = now()
     WHERE parent_id = $1 AND revoked_at IS NULL`,
    [parentId]
  );
  const revoked = result.rowCount ?? 0;
  logger.info(`Signed out all devices for parent ${parentId}: ${revoked} sessions revoked`);
  return { revoked };
};

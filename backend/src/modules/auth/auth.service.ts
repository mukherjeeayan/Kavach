// auth.service.ts
// Credential verification, registration, and session orchestration.
// Token mechanics live in ../shared/token.service.

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import pool, { query } from '../../config/database';
import {
  UnauthorizedError,
  ConflictError,
  NotFoundError,
  ForbiddenError,
  BadRequestError,
} from '../../utils/errors';
import {
  signAccessToken,
  signScopedToken,
  issueRefreshToken,
  insertRefreshToken,
  hashToken,
  verifyRefreshToken,
} from '../shared/token.service';
import { writeAuditLog } from '../shared/audit.service';
import { sendEmail } from '../shared/email.service';
import * as twoFactorService from './twoFactor.service';
import logger from '../../utils/logger';

export { UnauthorizedError };

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  email_verified?: boolean;
  role?: string;
  subscription_tier?: string;
  trial_expires_at?: string | null;
}

const bcryptRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10);
const verificationBcryptRounds = 10;

const MAX_LOGIN_ATTEMPTS = 10;
const LOGIN_LOCKOUT_MINUTES = 15;

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  child_name?: string;
  birth_date?: string;
  ai_provider?: 'openai' | 'gemini' | 'anthropic';
  ai_api_key?: string;
  ai_model?: string;
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
 *
 * SECURITY/COPPA: Parent must be 18+ years old. Child birth_date is validated
 * to ensure the child is under 18 (parental control scope).
 */
export const register = async (
  input: RegisterInput
): Promise<{ token: string; refresh_token: string; user: AuthUser; child: ChildProfile | null }> => {
  const email = input.email.toLowerCase().trim();
  const passwordHash = await bcrypt.hash(input.password, bcryptRounds);

  // COPPA COMPLIANCE: Validate child birth_date if provided
  // Child must be under 18 (this is a parental control app)
  if (input.birth_date) {
    const birthDate = new Date(input.birth_date);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    if (age >= 18) {
      throw new BadRequestError('Child must be under 18 years old for parental control monitoring');
    }
    if (age < 0 || birthDate > today) {
      throw new BadRequestError('Invalid birth date: cannot be in the future');
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let parentResult;
    try {
      parentResult = await client.query(
        `INSERT INTO parents (email, password_hash, name)
         VALUES ($1, $2, $3)
         RETURNING id, email, name, role, subscription_tier, trial_expires_at`,
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

    // Store AI settings if provided during registration
    if (input.ai_provider && input.ai_api_key && input.ai_model) {
      const { encryptSensitiveData } = await import('../shared/encryption.service');
      const encryptedKey = encryptSensitiveData(input.ai_api_key);
      await client.query(
        `INSERT INTO ai_settings (user_id, provider, api_key_enc, model)
         VALUES ($1, $2, $3, $4)`,
        [parent.id, input.ai_provider, encryptedKey, input.ai_model]
      );
    }

    await client.query('COMMIT');

    const user: AuthUser = {
      id: parent.id,
      email: parent.email,
      name: parent.name,
      email_verified: false,
      role: parent.role,
      subscription_tier: parent.subscription_tier,
      trial_expires_at: parent.trial_expires_at,
    };
    logger.info(`Parent registered: ${user.id}`);
    if (child) {
      logger.info(`Child profile created as part of registration: ${child.id}`);
    }

    // Issue a verification email. Failures here must not break registration
    // (the user can resend), so we log and swallow.
    try {
      await issueAndSendVerification(user.id, user.email, user.name);
    } catch (err) {
      logger.error(`Failed to send verification email to ${user.email}:`, err);
    }

    return {
      token: signAccessToken(user.id, 'parent', {
        subscription_tier: parent.subscription_tier,
        trial_expires_at: parent.trial_expires_at,
      }),
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
 *
 * If the parent has 2FA enabled, returns a `requires2fa` flag and a
 * short-lived `twoFactorToken` instead of access/refresh tokens. The
 * caller must then complete the challenge at /api/v1/auth/2fa/challenge.
 *
 * Throws UnauthorizedError on any failure — no user enumeration
 * (same message whether the email or the password is wrong).
 */
export const login = async (
  email: string,
  password: string
): Promise<
  | { token: string; refresh_token: string; user: AuthUser; child: ChildProfile | null; requires2fa?: undefined; twoFactorToken?: undefined }
  | { requires2fa: true; twoFactorToken: string; user: AuthUser }
> => {
  const result = await query(
    `SELECT id, email, name, password_hash, email_verified, role, subscription_tier, trial_expires_at, failed_login_attempts, login_locked_until, two_factor_enabled
     FROM parents WHERE email = $1`,
    [email.toLowerCase().trim()]
  );

  const row = result.rows[0];

  // Check account lockout
  if (row?.login_locked_until && new Date(row.login_locked_until).getTime() > Date.now()) {
    throw new UnauthorizedError('Account temporarily locked due to too many failed attempts. Try again later.');
  }

  const valid = row && password && (await bcrypt.compare(password, row.password_hash));

  if (!valid) {
    // Increment failed attempts and lock if threshold reached
    if (row) {
      await query(
        `UPDATE parents
         SET failed_login_attempts = failed_login_attempts + 1,
             login_locked_until = CASE
               WHEN failed_login_attempts + 1 >= $2 THEN now() + ($3 || ' minutes')::interval
               ELSE login_locked_until
             END
         WHERE id = $1`,
        [row.id, MAX_LOGIN_ATTEMPTS, LOGIN_LOCKOUT_MINUTES.toString()]
      );

      // Audit log failed login attempt
      await query(
        `INSERT INTO audit_logs (actor_id, action, resource_type, details)
         VALUES ($1, 'FAILED_LOGIN', 'auth', $2)`,
        [row.id, JSON.stringify({
          email: email.toLowerCase().trim(),
          attempts: (row.failed_login_attempts || 0) + 1,
          locked: (row.failed_login_attempts || 0) + 1 >= MAX_LOGIN_ATTEMPTS,
        })]
      ).catch((err) => logger.error('Failed to log login attempt:', err));
    }
    throw new UnauthorizedError('Invalid email or password');
  }

  // Successful login clears failure counters
  await query(
    `UPDATE parents SET failed_login_attempts = 0, login_locked_until = NULL WHERE id = $1`,
    [row.id]
  );

  const user: AuthUser = {
    id: row.id,
    email: row.email,
    name: row.name,
    email_verified: row.email_verified === true,
    role: row.role,
    subscription_tier: row.subscription_tier,
    trial_expires_at: row.trial_expires_at,
  };
  logger.info(`Parent logged in: ${user.id}`);

  // 2FA gate: if the account has 2FA enabled, return a short-lived
  // scoped token that the challenge endpoint will exchange for real
  // session tokens. We never issue full session tokens until the user
  // proves possession of the second factor.
  if (row.two_factor_enabled === true) {
    const twoFactorToken = signScopedToken(user.id, 'parent', 'two-factor', '5m');
    return {
      requires2fa: true,
      twoFactorToken,
      user,
    };
  }

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
    token: signAccessToken(user.id, 'parent', {
      subscription_tier: row.subscription_tier,
      trial_expires_at: row.trial_expires_at,
    }),
    refresh_token: await issueRefreshToken(user.id, crypto.randomUUID()),
    user,
    child: (childResult.rows[0] as ChildProfile) || null,
  };
};

/**
 * Complete the 2FA login challenge. Verifies the scoped `twoFactorToken`
 * (issued by `login` when the account has 2FA enabled), then validates
 * the supplied TOTP / recovery code. On success returns the same
 * session payload as a normal login.
 */
export const complete2FAChallenge = async (
  twoFactorToken: string,
  token: string
): Promise<{ token: string; refresh_token: string; user: AuthUser; child: ChildProfile | null }> => {
  let decoded: { userId: string; scope?: string };
  try {
    decoded = jwt.verify(twoFactorToken, process.env.JWT_SECRET!, {
      algorithms: ['HS256'],
    }) as { userId: string; scope?: string };
  } catch {
    throw new UnauthorizedError('Invalid or expired 2FA token');
  }
  if (decoded.scope !== 'two-factor' || !decoded.userId) {
    throw new UnauthorizedError('Invalid 2FA token');
  }

  // Verify the TOTP code (or recovery code) against the persisted secret.
  await twoFactorService.verify2FAChallenge(decoded.userId, token);

  // Look up the user so we can return the same shape as a normal login.
  const result = await query(
    `SELECT id, email, name, email_verified, role, subscription_tier, trial_expires_at FROM parents WHERE id = $1`,
    [decoded.userId]
  );
  if (result.rows.length === 0) {
    throw new UnauthorizedError('Invalid 2FA token');
  }
  const row = result.rows[0];
  const user: AuthUser = {
    id: row.id,
    email: row.email,
    name: row.name,
    email_verified: row.email_verified === true,
    role: row.role,
    subscription_tier: row.subscription_tier,
    trial_expires_at: row.trial_expires_at,
  };

  const childResult = await query(
    `SELECT id, name, birth_date FROM children
     WHERE parent_id = $1
     ORDER BY created_at ASC
     LIMIT 1`,
    [user.id]
  );

  logger.info(`Parent completed 2FA login: ${user.id}`);
  return {
    token: signAccessToken(user.id, 'parent', {
      subscription_tier: row.subscription_tier,
      trial_expires_at: row.trial_expires_at,
    }),
    refresh_token: await issueRefreshToken(user.id, crypto.randomUUID()),
    user,
    child: (childResult.rows[0] as ChildProfile) || null,
  };
};

export interface GoogleAuthInput {
  googleId?: string;
  email: string;
  name: string;
  avatarUrl?: string;
}

/**
 * Authenticate or register a parent account via Google OAuth.
 * If parent exists, logs them in. If not, registers them seamlessly.
 */
export const authenticateWithGoogle = async (
  input: GoogleAuthInput
): Promise<{ token: string; refresh_token: string; user: AuthUser; child: ChildProfile | null; isNewUser: boolean }> => {
  const email = input.email.toLowerCase().trim();
  const name = (input.name || email.split('@')[0]).trim();
  const googleId = input.googleId || null;
  const avatarUrl = input.avatarUrl || null;

  const existingRes = await query(
    `SELECT id, email, name, email_verified, role, subscription_tier, trial_expires_at, google_id, avatar_url
     FROM parents WHERE email = $1 OR (google_id IS NOT NULL AND google_id = $2) LIMIT 1`,
    [email, googleId]
  );

  let userRow = existingRes.rows[0];
  let isNewUser = false;

  if (userRow) {
    // Existing parent: mark email verified and update google_id/avatar if applicable
    await query(
      `UPDATE parents 
       SET email_verified = true,
           google_id = COALESCE(google_id, $2),
           avatar_url = COALESCE($3, avatar_url),
           failed_login_attempts = 0,
           login_locked_until = NULL
       WHERE id = $1`,
      [userRow.id, googleId, avatarUrl]
    ).catch(() => {});

    userRow.email_verified = true;
  } else {
    isNewUser = true;
    const dummyPassword = crypto.randomBytes(32).toString('hex');
    const dummyPasswordHash = await bcrypt.hash(dummyPassword, 10);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const insertRes = await client.query(
        `INSERT INTO parents (email, password_hash, name, google_id, avatar_url, email_verified, role, subscription_tier, trial_expires_at)
         VALUES ($1, $2, $3, $4, $5, true, 'parent', 'TRIAL', NOW() + INTERVAL '14 days')
         RETURNING id, email, name, email_verified, role, subscription_tier, trial_expires_at`,
        [email, dummyPasswordHash, name, googleId, avatarUrl]
      );
      userRow = insertRes.rows[0];

      await client.query('COMMIT');
    } catch (insertErr) {
      await client.query('ROLLBACK');
      throw insertErr;
    } finally {
      client.release();
    }
  }

  const user: AuthUser = {
    id: userRow.id,
    email: userRow.email,
    name: userRow.name,
    email_verified: true,
    role: userRow.role,
    subscription_tier: userRow.subscription_tier,
    trial_expires_at: userRow.trial_expires_at,
  };

  const childResult = await query(
    `SELECT id, name, birth_date FROM children
     WHERE parent_id = $1
     ORDER BY created_at ASC
     LIMIT 1`,
    [user.id]
  );

  logger.info(`Parent authenticated via Google OAuth: ${user.id} (isNewUser: ${isNewUser})`);

  return {
    token: signAccessToken(user.id, 'parent', {
      subscription_tier: userRow.subscription_tier,
      trial_expires_at: userRow.trial_expires_at,
    }),
    refresh_token: await issueRefreshToken(user.id, crypto.randomUUID()),
    user,
    child: (childResult.rows[0] as ChildProfile) || null,
    isNewUser,
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

    // Fetch current subscription data so the refreshed access token
    // carries the user's tier. Without this, requirePremium would treat
    // every refreshed session as FREE.
    const userResult = await client.query(
      `SELECT role, subscription_tier, trial_expires_at FROM parents WHERE id = $1`,
      [decoded.userId]
    );
    const userRow = userResult.rows[0];

    await client.query('COMMIT');

    return {
      token: signAccessToken(decoded.userId, userRow?.role ?? 'parent', {
        subscription_tier: userRow?.subscription_tier ?? 'FREE',
        trial_expires_at: userRow?.trial_expires_at,
      }),
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
    `SELECT id, email, name, email_verified, role, subscription_tier, trial_expires_at FROM parents WHERE id = $1`,
    [parentId]
  );
  const row = result.rows[0];
  if (!row) throw new NotFoundError('User not found');
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    email_verified: row.email_verified === true,
    role: row.role,
    subscription_tier: row.subscription_tier,
    trial_expires_at: row.trial_expires_at,
  };
};

export const updateProfile = async (
  parentId: string,
  name: string
): Promise<AuthUser> => {
  const result = await query(
    `UPDATE parents SET name = $1 WHERE id = $2
     RETURNING id, email, name, email_verified`,
    [name.trim(), parentId]
  );
  if ((result.rowCount ?? 0) === 0) throw new NotFoundError('User not found');
  const row = result.rows[0];

  await writeAuditLog({
    actorId: parentId,
    targetChildId: null,
    action: 'UPDATE_PROFILE',
    resourceType: 'parents',
    details: { name: name.trim() },
  });

  return {
    id: row.id,
    email: row.email,
    name: row.name,
    email_verified: row.email_verified === true,
  };
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

  await writeAuditLog({
    actorId: parentId,
    targetChildId: null,
    action: 'CHANGE_PASSWORD',
    resourceType: 'parents',
    details: {},
  });

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

// ---------------------------------------------------------------------------
// Email verification
// ---------------------------------------------------------------------------

const VERIFICATION_TTL_HOURS = 24;
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://kavach.app';

/**
 * Generate a fresh verification token, persist its bcrypt hash, and email
 * the raw token to the parent. The raw token is what the user clicks on
 * in their inbox — only the hash is stored.
 */
const issueAndSendVerification = async (
  userId: string,
  email: string,
  name: string
): Promise<void> => {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = await bcrypt.hash(rawToken, verificationBcryptRounds);

  await query(
    `INSERT INTO email_verifications (user_id, token_hash, expires_at)
     VALUES ($1, $2, NOW() + INTERVAL '${VERIFICATION_TTL_HOURS} hours')`,
    [userId, tokenHash]
  );

  const verifyUrl = `${FRONTEND_URL}/verify-email?token=${rawToken}`;
  await sendEmail({
    to: email,
    subject: 'Kavach — Verify your email address',
    html: `
      <h2>Welcome to Kavach, ${name}!</h2>
      <p>Please confirm your email address to finish setting up your account.</p>
      <p>This link expires in ${VERIFICATION_TTL_HOURS} hours.</p>
      <p><a href="${verifyUrl}">Verify my email</a></p>
      <p>If the link doesn't work, paste this URL into your browser:</p>
      <p>${verifyUrl}</p>
    `,
    text: `Welcome to Kavach, ${name}!\n\nVerify your email by visiting: ${verifyUrl}\n\nThis link expires in ${VERIFICATION_TTL_HOURS} hours.`,
  });
};

/**
 * Verify a parent's email using a raw token from the verification link.
 * Tokens are stored as bcrypt hashes, so we have to scan all live
 * (unused, unexpired) tokens and compare with bcrypt.
 */
export const verifyEmail = async (
  rawToken: string
): Promise<{ message: string }> => {
  if (!rawToken || typeof rawToken !== 'string') {
    throw new BadRequestError('Invalid or expired verification token');
  }

  const result = await query(
    `SELECT id, user_id, token_hash FROM email_verifications
     WHERE verified_at IS NULL AND expires_at > NOW()`
  );

  for (const row of result.rows) {
    if (await bcrypt.compare(rawToken, row.token_hash)) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        // Single-use: mark this token as consumed. We also defensively
        // burn any other live tokens for the same user so a leaked old
        // link can never be replayed.
        const consumed = await client.query(
          `UPDATE email_verifications
           SET verified_at = NOW()
           WHERE id = $1 AND verified_at IS NULL`,
          [row.id]
        );
        if ((consumed.rowCount ?? 0) === 0) {
          throw new BadRequestError('Invalid or expired verification token');
        }
        await client.query(
          `UPDATE email_verifications
           SET verified_at = NOW()
           WHERE user_id = $1 AND verified_at IS NULL AND id <> $2`,
          [row.user_id, row.id]
        );
        await client.query(
          `UPDATE parents SET email_verified = TRUE WHERE id = $1`,
          [row.user_id]
        );
        await client.query(
          `INSERT INTO audit_logs (actor_id, action, resource_type, details)
           VALUES ($1, 'EMAIL_VERIFIED', 'parents', '{}')`,
          [row.user_id]
        );
        await client.query('COMMIT');
        logger.info(`Email verified for parent ${row.user_id}`);
        return { message: 'Email verified successfully' };
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }
  }

  throw new BadRequestError('Invalid or expired verification token');
};

/**
 * Issue a new verification email for a parent who hasn't verified yet.
 * Rejects parents whose email is already verified.
 */
export const resendVerification = async (
  userId: string
): Promise<{ message: string }> => {
  const result = await query(
    `SELECT id, email, name, email_verified FROM parents WHERE id = $1`,
    [userId]
  );
  const row = result.rows[0];
  if (!row) {
    throw new NotFoundError('User not found');
  }
  if (row.email_verified === true) {
    throw new BadRequestError('Email is already verified');
  }

  await issueAndSendVerification(row.id, row.email, row.name);
  logger.info(`Verification email resent to parent ${row.id}`);
  return { message: 'Verification email sent' };
};

/**
 * Collect every piece of personal data associated with the parent and
 * their children into a single JSON document. This is the payload
 * returned by the GDPR / account-portability endpoint. High-volume
 * time-series tables (location, screen-time, communication logs) are
 * windowed to the last 30 days to keep the export bounded; the parent
 * can request deeper history on demand.
 *
 * All sections are queried in parallel so the export latency is
 * roughly the slowest single query rather than the sum of all of them.
 */
export const exportUserData = async (parentId: string): Promise<Record<string, any>> => {
  const [
    parent,
    children,
    devices,
    appBlocks,
    locks,
    contacts,
    locations,
    screenTime,
    commLogs,
    keywordAlerts,
    sosEvents,
    geofences,
    urlFilters,
    moodLogs,
    rewards,
    securityScans,
    notifications,
    consents,
  ] = await Promise.all([
    query(
      'SELECT id, name, email, phone, email_verified, created_at FROM parents WHERE id = $1',
      [parentId]
    ),
    query('SELECT * FROM children WHERE parent_id = $1', [parentId]),
    query(
      'SELECT d.* FROM devices d INNER JOIN children c ON c.id = d.child_id WHERE c.parent_id = $1',
      [parentId]
    ),
    query(
      'SELECT a.* FROM app_block_rules a INNER JOIN children c ON c.id = a.child_id WHERE c.parent_id = $1',
      [parentId]
    ),
    query(
      'SELECT s.* FROM scheduled_locks s INNER JOIN children c ON c.id = s.child_id WHERE c.parent_id = $1',
      [parentId]
    ),
    query(
      'SELECT cr.* FROM contact_rules cr INNER JOIN children c ON c.id = cr.child_id WHERE c.parent_id = $1',
      [parentId]
    ),
    query(
      `SELECT l.* FROM location_history l INNER JOIN children c ON c.id = l.child_id
       WHERE c.parent_id = $1 AND l.recorded_at > NOW() - INTERVAL '30 days'`,
      [parentId]
    ),
    query(
      `SELECT st.* FROM screen_time_logs st INNER JOIN children c ON c.id = st.child_id
       WHERE c.parent_id = $1 AND st.date > NOW() - INTERVAL '30 days'`,
      [parentId]
    ),
    query(
      `SELECT cl.* FROM communication_logs cl INNER JOIN children c ON c.id = cl.child_id
       WHERE c.parent_id = $1 AND cl.created_at > NOW() - INTERVAL '30 days'`,
      [parentId]
    ),
    query(
      'SELECT ka.* FROM keyword_alerts ka INNER JOIN children c ON c.id = ka.child_id WHERE c.parent_id = $1',
      [parentId]
    ),
    query(
      'SELECT s.* FROM emergency_sos_events s INNER JOIN children c ON c.id = s.child_id WHERE c.parent_id = $1',
      [parentId]
    ),
    query(
      'SELECT g.* FROM geofences g INNER JOIN children c ON c.id = g.child_id WHERE c.parent_id = $1',
      [parentId]
    ),
    query(
      'SELECT u.* FROM url_filters u INNER JOIN children c ON c.id = u.child_id WHERE c.parent_id = $1',
      [parentId]
    ),
    query(
      'SELECT m.* FROM mood_logs m INNER JOIN children c ON c.id = m.child_id WHERE c.parent_id = $1',
      [parentId]
    ),
    query('SELECT * FROM reward_catalog WHERE parent_id = $1', [parentId]),
    query(
      'SELECT s.* FROM security_scans s INNER JOIN children c ON c.id = s.child_id WHERE c.parent_id = $1',
      [parentId]
    ),
    query('SELECT * FROM notifications WHERE user_id = $1', [parentId]),
    query('SELECT * FROM consent_records WHERE user_id = $1', [parentId]),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    parent: parent.rows[0] || null,
    children: children.rows,
    devices: devices.rows,
    appBlocks: appBlocks.rows,
    scheduledLocks: locks.rows,
    contactRules: contacts.rows,
    locationHistory: locations.rows,
    screenTime: screenTime.rows,
    communicationLogs: commLogs.rows,
    keywordAlerts: keywordAlerts.rows,
    sosEvents: sosEvents.rows,
    geofences: geofences.rows,
    urlFilters: urlFilters.rows,
    moodLogs: moodLogs.rows,
    rewards: rewards.rows,
    securityScans: securityScans.rows,
    notifications: notifications.rows,
    consents: consents.rows,
  };
};

/**
 * Permanently delete a parent account and every dependent row in a
 * single transaction. The caller must re-authenticate by providing
 * the current password. Children are also removed — all child-scoped
 * tables reference either children or devices (which themselves
 * reference children), so the deletes are sequenced child-id-first
 * to satisfy any non-cascading FKs. The parent row is the last to
 * go so the audit log can still record `DELETE_ACCOUNT`.
 */
export const deleteAccount = async (parentId: string, password: string): Promise<void> => {
  const result = await query('SELECT password_hash FROM parents WHERE id = $1', [parentId]);
  if (result.rows.length === 0) {
    throw new NotFoundError('Parent not found');
  }
  const valid = await bcrypt.compare(password, result.rows[0].password_hash);
  if (!valid) {
    throw new UnauthorizedError('Incorrect password');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Child-scoped tables — all keyed on child_id.
    await client.query(
      `DELETE FROM location_history WHERE child_id IN (SELECT id FROM children WHERE parent_id = $1)`,
      [parentId]
    );
    await client.query(
      `DELETE FROM screen_time_logs WHERE child_id IN (SELECT id FROM children WHERE parent_id = $1)`,
      [parentId]
    );
    await client.query(
      `DELETE FROM communication_logs WHERE child_id IN (SELECT id FROM children WHERE parent_id = $1)`,
      [parentId]
    );
    await client.query(
      `DELETE FROM keyword_alerts WHERE child_id IN (SELECT id FROM children WHERE parent_id = $1)`,
      [parentId]
    );
    await client.query(
      `DELETE FROM emergency_sos_events WHERE child_id IN (SELECT id FROM children WHERE parent_id = $1)`,
      [parentId]
    );
    await client.query(
      `DELETE FROM geofences WHERE child_id IN (SELECT id FROM children WHERE parent_id = $1)`,
      [parentId]
    );
    await client.query(
      `DELETE FROM url_filters WHERE child_id IN (SELECT id FROM children WHERE parent_id = $1)`,
      [parentId]
    );
    await client.query(
      `DELETE FROM mood_logs WHERE child_id IN (SELECT id FROM children WHERE parent_id = $1)`,
      [parentId]
    );
    await client.query(
      `DELETE FROM security_scans WHERE child_id IN (SELECT id FROM children WHERE parent_id = $1)`,
      [parentId]
    );
    await client.query(
      `DELETE FROM app_block_rules WHERE child_id IN (SELECT id FROM children WHERE parent_id = $1)`,
      [parentId]
    );
    await client.query(
      `DELETE FROM scheduled_locks WHERE child_id IN (SELECT id FROM children WHERE parent_id = $1)`,
      [parentId]
    );
    await client.query(
      `DELETE FROM contact_rules WHERE child_id IN (SELECT id FROM children WHERE parent_id = $1)`,
      [parentId]
    );

    // Devices are owned by children — must die before children.
    await client.query(
      `DELETE FROM devices WHERE child_id IN (SELECT id FROM children WHERE parent_id = $1)`,
      [parentId]
    );

    // Parent-scoped (non-child) tables.
    await client.query(`DELETE FROM reward_catalog WHERE parent_id = $1`, [parentId]);
    await client.query(`DELETE FROM notifications WHERE user_id = $1`, [parentId]);
    await client.query(`DELETE FROM consent_records WHERE user_id = $1`, [parentId]);
    await client.query(
      `DELETE FROM refresh_tokens WHERE parent_id = $1`,
      [parentId]
    );
    await client.query(
      `DELETE FROM password_reset_tokens WHERE parent_id = $1`,
      [parentId]
    );

    // Children go last among child rows so dependent rows can resolve.
    await client.query(`DELETE FROM children WHERE parent_id = $1`, [parentId]);

    // Record the deletion in the audit log *before* the parent row
    // itself is removed.
    await client.query(
      `INSERT INTO audit_logs (actor_id, action, resource_type, details)
       VALUES ($1, 'DELETE_ACCOUNT', 'parents', '{}')`,
      [parentId]
    );

    // Finally remove the parent.
    await client.query(`DELETE FROM parents WHERE id = $1`, [parentId]);

    await client.query('COMMIT');
    logger.info(`Parent account deleted: ${parentId}`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Register or update an FCM push token for a parent's device. The
 * token is the source of truth (unique), so if another account
 * somehow ended up holding it we re-bind it to this parent.
 */
export const registerPushToken = async (
  userId: string,
  token: string,
  platform?: string
): Promise<{ registered: true }> => {
  const platformValue = platform ?? 'android';
  await pool.query(
    `INSERT INTO push_tokens (user_id, token, platform)
     VALUES ($1, $2, $3)
     ON CONFLICT (token) DO UPDATE
       SET user_id = EXCLUDED.user_id,
           platform = EXCLUDED.platform`,
    [userId, token, platformValue]
  );
  return { registered: true };
};

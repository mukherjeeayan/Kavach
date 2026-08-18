// auth.service.ts
// Credential verification and JWT issuance.

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { query } from '../config/database';
import logger from '../utils/logger';

export class UnauthorizedError extends Error {
  statusCode = 401;
  constructor(message: string) {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

const accessSecret = process.env.JWT_SECRET as string;
const refreshSecret = process.env.JWT_REFRESH_SECRET as string;
const accessExpiresIn = (process.env.JWT_EXPIRES_IN || '15m') as jwt.SignOptions['expiresIn'];
const refreshExpiresIn = (process.env.JWT_REFRESH_EXPIRES_IN || '7d') as jwt.SignOptions['expiresIn'];

const signAccessToken = (userId: string, role: string): string =>
  jwt.sign({ userId, role }, accessSecret, { algorithm: 'HS256', expiresIn: accessExpiresIn });

const signRefreshToken = (userId: string): string =>
  jwt.sign({ userId }, refreshSecret, { algorithm: 'HS256', expiresIn: refreshExpiresIn });

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
    refresh_token: signRefreshToken(user.id),
    user,
  };
};

/**
 * Verify a refresh token and issue a fresh access token.
 */
export const refreshAccessToken = (refreshToken: string): string => {
  let decoded;
  try {
    decoded = jwt.verify(refreshToken, refreshSecret, { algorithms: ['HS256'] }) as { userId: string };
  } catch {
    throw new UnauthorizedError('Invalid or expired refresh token');
  }
  return signAccessToken(decoded.userId, 'parent');
};
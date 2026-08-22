// test-helpers.ts
// Shared helpers for backend integration tests: JWT signing, mock DB setup.

import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'test-access-secret';

/** Generate a valid JWT access token for testing. */
export function signTestToken(userId: string, role = 'parent'): string {
  return jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: '1h', algorithm: 'HS256' });
}

/** A valid parent UUID used across tests. */
export const PARENT_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

/** A valid child UUID used across tests. */
export const CHILD_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

/** A valid device UUID used across tests. */
export const DEVICE_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

/** A valid rule UUID used across tests. */
export const RULE_ID = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

/** A valid lock UUID used across tests. */
export const LOCK_ID = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';

/** A valid contact UUID used across tests. */
export const CONTACT_ID = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

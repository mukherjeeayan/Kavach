// encryption.service.ts
// Symmetric encryption helper for sensitive columns (FCM tokens,
// integration config, communication-log snippets, etc.) at rest using
// AES-256-GCM. The key is derived from the DATA_ENCRYPTION_KEY env
// var via PBKDF2 so the key itself is never stored and process
// restarts do not require a manual re-key.

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 16;
const KEY_LENGTH = 32;
const ITERATIONS = 100_000;

let _derivedKey: Buffer | null = null;

function getKey(): Buffer {
  if (_derivedKey) return _derivedKey;
  const raw = process.env.DATA_ENCRYPTION_KEY;
  if (!raw || raw.length < 32) {
    throw new Error('DATA_ENCRYPTION_KEY must be set (min 32 chars)');
  }
  _derivedKey = crypto.pbkdf2Sync(raw, 'kavach-salt-v1', ITERATIONS, KEY_LENGTH, 'sha512');
  return _derivedKey;
}

export const encryptSensitiveData = (plaintext: string): string => {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const combined = Buffer.concat([iv, authTag, encrypted]);
  return combined.toString('base64');
};

export const decryptSensitiveData = (ciphertext: string): string => {
  const key = getKey();
  const combined = Buffer.from(ciphertext, 'base64');
  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);
  return decipher.update(encrypted) + decipher.final('utf8');
};
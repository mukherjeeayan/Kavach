// crypto.ts
// Client-side cryptography using Web Crypto API (SubtleCrypto).
// Provides ECDH key agreement and AES-256-GCM encryption for
// end-to-end encrypted communication between parent and child devices.
//
// Uses:
// - ECDH P-256 for Diffie-Hellman key exchange
//   NOTE: The architecture document specifies X25519 (Curve25519), but
//   Web Crypto API does not natively support X25519 in all browsers.
//   ECDH P-256 (secp256r1) is used instead for cross-browser compatibility.
//   Both curves provide ~128-bit security. The Android KeyExchange module
//   also uses P-256 for consistency.
// - HKDF for key derivation from shared secret
// - AES-256-GCM for authenticated encryption
//
// All operations use the browser's native SubtleCrypto implementation
// with no external dependencies.

const ALGO_AES_GCM = 'AES-GCM';
const ALGO_HKDF = 'HKDF';
const ALGO_ECDH = 'ECDH';
const ALGO_SHA256 = 'SHA-256';

const AES_KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96 bits for AES-GCM
const SALT_LENGTH = 16;
const TAG_LENGTH = 128; // 128-bit authentication tag

// ── Key Generation ────────────────────────────────────────────────────

/**
 * Generate an ECDH key pair using P-256 curve.
 * Returns the key pair for key agreement.
 */
export async function generateECDHKeyPair(): Promise<CryptoKeyPair> {
  return await crypto.subtle.generateKey(
    {
      name: ALGO_ECDH,
      namedCurve: 'P-256',
    },
    true, // extractable
    ['deriveKey', 'deriveBits']
  );
}

/**
 * Export a public key to raw bytes (base64-encoded).
 */
export async function exportPublicKey(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', key);
  return bufferToBase64(raw);
}

/**
 * Import a public key from raw bytes (base64-encoded).
 */
export async function importPublicKey(base64Key: string): Promise<CryptoKey> {
  const raw = base64ToBuffer(base64Key);
  return await crypto.subtle.importKey(
    'raw',
    toArrayBuffer(raw),
    {
      name: ALGO_ECDH,
      namedCurve: 'P-256',
    },
    true,
    []
  );
}

// ── Key Agreement & Derivation ────────────────────────────────────────

/**
 * Derive a shared AES-256-GCM key from ECDH key agreement.
 *
 * @param privateKey - Our ECDH private key
 * @param publicKey - Their ECDH public key
 * @param salt - Optional salt for HKDF (uses default if not provided)
 * @returns AES-256-GCM key for encryption/decryption
 */
export async function deriveSharedKey(
  privateKey: CryptoKey,
  publicKey: CryptoKey,
  salt?: Uint8Array
): Promise<CryptoKey> {
  // Perform ECDH to get raw shared secret
  const sharedSecret = await crypto.subtle.deriveBits(
    {
      name: ALGO_ECDH,
      public: publicKey,
    },
    privateKey,
    AES_KEY_LENGTH
  );

  // Derive AES key using HKDF
  const derivedKey = await crypto.subtle.deriveKey(
    {
      name: ALGO_HKDF,
      salt: salt ? toArrayBuffer(salt) : toArrayBuffer(crypto.getRandomValues(new Uint8Array(SALT_LENGTH))),
      info: new TextEncoder().encode('kavach-e2ee-v1'),
      hash: ALGO_SHA256,
    },
    await crypto.subtle.importKey(
      'raw',
      sharedSecret,
      { name: 'HKDF' },
      false,
      ['deriveKey']
    ),
    {
      name: ALGO_AES_GCM,
      length: AES_KEY_LENGTH,
    },
    true,
    ['encrypt', 'decrypt']
  );

  return derivedKey;
}

/**
 * Derive an AES key from a password using PBKDF2.
 * Used for local key storage encryption.
 *
 * @param password - User password
 * @param salt - Salt for key derivation
 * @returns AES-256-GCM key
 */
export async function deriveKeyFromPassword(
  password: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const passwordBuffer = new TextEncoder().encode(password);

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: toArrayBuffer(salt),
      iterations: 100000,
      hash: ALGO_SHA256,
    },
    keyMaterial,
    {
      name: ALGO_AES_GCM,
      length: AES_KEY_LENGTH,
    },
    false,
    ['encrypt', 'decrypt']
  );
}

// ── Encryption / Decryption ───────────────────────────────────────────

/**
 * Encrypt data using AES-256-GCM.
 *
 * @param key - AES-256-GCM key
 * @param plaintext - Data to encrypt
 * @param associatedData - Optional authenticated data (not encrypted)
 * @returns Object containing ciphertext, IV, and optional salt
 */
export async function encrypt(
  key: CryptoKey,
  plaintext: string | Uint8Array,
  associatedData?: Uint8Array
): Promise<{
  ciphertext: string;
  iv: string;
}> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const data = typeof plaintext === 'string'
    ? new TextEncoder().encode(plaintext)
    : plaintext;

  const encrypted = await crypto.subtle.encrypt(
    {
      name: ALGO_AES_GCM,
      iv: toArrayBuffer(iv),
      tagLength: TAG_LENGTH,
      additionalData: associatedData ? toArrayBuffer(associatedData) : undefined,
    },
    key,
    toArrayBuffer(data)
  );

  return {
    ciphertext: bufferToBase64(encrypted),
    iv: bufferToBase64(toArrayBuffer(iv)),
  };
}

/**
 * Decrypt data using AES-256-GCM.
 *
 * @param key - AES-256-GCM key
 * @param ciphertext - Base64-encoded ciphertext
 * @param iv - Base64-encoded initialization vector
 * @param associatedData - Optional authenticated data
 * @returns Decrypted data as string
 */
export async function decrypt(
  key: CryptoKey,
  ciphertext: string,
  iv: string,
  associatedData?: Uint8Array
): Promise<string> {
  const ciphertextBuffer = base64ToBuffer(ciphertext);
  const ivBuffer = base64ToBuffer(iv);

  const decrypted = await crypto.subtle.decrypt(
    {
      name: ALGO_AES_GCM,
      iv: toArrayBuffer(ivBuffer),
      tagLength: TAG_LENGTH,
      additionalData: associatedData ? toArrayBuffer(associatedData) : undefined,
    },
    key,
    toArrayBuffer(ciphertextBuffer)
  );

  return new TextDecoder().decode(decrypted);
}

// ── Digital Signatures ────────────────────────────────────────────────

/**
 * Generate an ECDSA P-256 key pair for digital signatures.
 */
export async function generateSigningKeyPair(): Promise<CryptoKeyPair> {
  return await crypto.subtle.generateKey(
    {
      name: 'ECDSA',
      namedCurve: 'P-256',
    },
    true,
    ['sign', 'verify']
  );
}

/**
 * Sign data using ECDSA P-256 with SHA-256.
 */
export async function sign(
  privateKey: CryptoKey,
  data: string | Uint8Array
): Promise<string> {
  const dataBuffer = typeof data === 'string'
    ? new TextEncoder().encode(data)
    : data;

  const signature = await crypto.subtle.sign(
    {
      name: 'ECDSA',
      hash: ALGO_SHA256,
    },
    privateKey,
    toArrayBuffer(dataBuffer)
  );

  return bufferToBase64(signature);
}

/**
 * Verify a digital signature.
 */
export async function verify(
  publicKey: CryptoKey,
  signature: string,
  data: string | Uint8Array
): Promise<boolean> {
  const signatureBuffer = base64ToBuffer(signature);
  const dataBuffer = typeof data === 'string'
    ? new TextEncoder().encode(data)
    : data;

  return await crypto.subtle.verify(
    {
      name: 'ECDSA',
      hash: ALGO_SHA256,
    },
    publicKey,
    toArrayBuffer(signatureBuffer),
    toArrayBuffer(dataBuffer)
  );
}

// ── Utility Functions ─────────────────────────────────────────────────

/**
 * Convert ArrayBuffer to base64 string.
 */
function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Convert Uint8Array to ArrayBuffer (safe for Web Crypto API).
 * Creates a new ArrayBuffer to handle both ArrayBuffer and SharedArrayBuffer backing.
 */
function toArrayBuffer(view: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(view.byteLength);
  new Uint8Array(buffer).set(view);
  return buffer;
}

/**
 * Convert base64 string to Uint8Array.
 */
function base64ToBuffer(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Generate a cryptographically secure random salt.
 */
export function generateSalt(length: number = SALT_LENGTH): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

/**
 * Generate a random UUID v4.
 */
export function generateUUID(): string {
  return crypto.randomUUID();
}

// ── High-Level Key Exchange Protocol ──────────────────────────────────

/**
 * Complete key exchange flow:
 * 1. Generate ECDH key pair
 * 2. Export public key for sharing
 * 3. Import other party's public key
 * 4. Derive shared AES-256-GCM key
 *
 * Usage:
 * ```typescript
 * // Initiator
 * const initiator = await initiateKeyExchange();
 * // Send initiator.publicKey to responder
 *
 * // Responder
 * const responder = await completeKeyExchange(initiator.publicKey);
 * // Send responder.publicKey back to initiator
 *
 * // Both parties now have the same shared key
 * const sharedKey = await deriveSharedKeyFromExchange(
 *   initiator.privateKey,
 *   responder.publicKey
 * );
 * ```
 */
export async function initiateKeyExchange(): Promise<{
  privateKey: CryptoKey;
  publicKey: string;
}> {
  const keyPair = await generateECDHKeyPair();
  const publicKey = await exportPublicKey(keyPair.publicKey);

  return {
    privateKey: keyPair.privateKey,
    publicKey,
  };
}

/**
 * Complete the key exchange by importing the other party's public key.
 */
export async function completeKeyExchange(
  otherPublicKeyBase64: string
): Promise<CryptoKey> {
  return await importPublicKey(otherPublicKeyBase64);
}

/**
 * Derive the shared key from completed key exchange.
 */
export async function deriveSharedKeyFromExchange(
  privateKey: CryptoKey,
  otherPublicKey: CryptoKey
): Promise<CryptoKey> {
  return await deriveSharedKey(privateKey, otherPublicKey);
}

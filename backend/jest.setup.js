// jest.setup.js
// Runs before any test module loads so env-driven module-level
// constants (JWT secrets, bcrypt rounds) are always defined in tests.

// Set NODE_ENV for test mode
process.env.NODE_ENV = 'test';

// Set required environment variables for integration tests
process.env.DATABASE_URL = 'postgres://postgres:password@localhost:5432/kavach';
process.env.REDIS_URL = 'redis://localhost:6379';
// JWT secrets must be at least 32 characters per Zod schema
process.env.JWT_SECRET = 'test-access-secret-key-that-is-at-least-32-chars-long';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key-that-is-at-least-32-chars-long';
process.env.PORT = '3000';
process.env.FRONTEND_URL = 'http://localhost:5173';
process.env.CORS_ORIGINS = 'http://localhost:5173';
process.env.ALLOWED_ORIGINS = 'http://localhost:5173';
process.env.BCRYPT_SALT_ROUNDS = '4';
// Encryption key for sensitive columns (FCM tokens, integration config).
// Must be at least 32 characters per encryption.service.ts.
process.env.DATA_ENCRYPTION_KEY = 'test-data-encryption-key-for-unit-tests-only';
// Admin access key for admin routes (must be at least 16 characters per Zod schema)
process.env.ADMIN_ACCESS_KEY = 'test-admin-access-key-for-unit-tests';
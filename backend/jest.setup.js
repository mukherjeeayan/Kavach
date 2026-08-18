// jest.setup.js
// Runs before any test module loads so env-driven module-level
// constants (JWT secrets, bcrypt rounds) are always defined in tests.

process.env.JWT_SECRET = 'test-access-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
process.env.BCRYPT_SALT_ROUNDS = '4';
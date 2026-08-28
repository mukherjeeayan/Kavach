/**
 * validateEnv — Central configuration validation module.
 *
 * Validates all critical environment variables at application startup.
 * If a required variable is missing or invalid, the process exits immediately
 * with a clear error message instead of failing at runtime with cryptic errors.
 *
 * This is the single source of truth for which env vars are required.
 * If you add a new env var to the app, add a validation rule here.
 */
import { z } from 'zod';

/**
 * Define the schema for ALL environment variables.
 * Required vars will cause a startup failure if missing.
 * Optional vars will use their default values.
 */
const envSchema = z.object({
  // ─── Database ──────────────────────────────────────────────────────
  DB_HOST: z.string().min(1, 'DB_HOST is required').default('localhost'),
  DB_PORT: z
    .string()
    .regex(/^\d+$/, 'DB_PORT must be a number')
    .default('5432'),
  DB_USER: z.string().min(1, 'DB_USER is required').default('postgres'),
  DB_PASSWORD: z.string().optional(),
  DB_NAME: z.string().min(1, 'DB_NAME is required').default('kavach'),
  DATABASE_URL: z.string().optional(),

  // ─── Redis ─────────────────────────────────────────────────────────
  REDIS_URL: z.string().optional(),

  // ─── Authentication & JWT ─────────────────────────────────────────
  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET must be at least 32 characters for security'),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('1h'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),

  // ─── Server ────────────────────────────────────────────────────────
  PORT: z
    .string()
    .regex(/^\d+$/, 'PORT must be a number')
    .default('3000'),
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),

  // ─── Frontend ──────────────────────────────────────────────────────
  FRONTEND_URL: z.string().url('FRONTEND_URL must be a valid URL').default('http://localhost:5173'),

  // ─── CORS ──────────────────────────────────────────────────────────
  ALLOWED_ORIGINS: z.string().optional(),

  // ─── Firebase (for push notifications) ─────────────────────────────
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),

  // ─── Encryption ────────────────────────────────────────────────────
  CHAMBER_KEY_ALIAS: z.string().default('kavach-chamber-key'),
});

/**
 * Validate the environment variables.
 * Returns the parsed config if valid, or throws a ZodError with details.
 * In test mode, throws an error instead of exiting the process so Jest tests can fail gracefully.
 */
export function validateEnv() {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    if (process.env.NODE_ENV === 'test') {
      throw new Error(
        'ENVIRONMENT VALIDATION FAILED\n' +
        'The following environment variables are missing or invalid:\n' +
        result.error.issues.map((issue) => {
          const path = issue.path.join('.');
          return `  ✗ ${path}: ${issue.message}`;
        }).join('\n') +
        '\n' +
        'Set these in your .env.test file and run tests with NODE_ENV=test'
      );
    }
    console.error('\n' + '='.repeat(60));
    console.error('ENVIRONMENT VALIDATION FAILED');
    console.error('='.repeat(60));
    console.error('The following environment variables are missing or invalid:\n');
    result.error.issues.forEach((issue) => {
      const path = issue.path.join('.');
      console.error(`  ✗ ${path}: ${issue.message}`);
    });
    console.error('\n' + '='.repeat(60));
    console.error('Set these in your .env file and restart the server.');
    console.error('='.repeat(60) + '\n');
    process.exit(1);
  }

  // After validation, coerce PORT to a number for the rest of the app
  process.env.PORT = result.data.PORT;

  console.log('✓ Environment configuration validated successfully');
  return result.data;
}

/**
 * Runtime-safe getter for validated env vars.
 * Use this instead of process.env.XXX throughout the app.
 */
export const env = {
  get DB_HOST(): string {
    return process.env.DB_HOST!;
  },
  get DB_PORT(): string {
    return process.env.DB_PORT || '5432';
  },
  get DB_USER(): string {
    return process.env.DB_USER!;
  },
  get DB_PASSWORD(): string | undefined {
    return process.env.DB_PASSWORD;
  },
  get DB_NAME(): string {
    return process.env.DB_NAME!;
  },
  get DATABASE_URL(): string | undefined {
    return process.env.DATABASE_URL;
  },
  get REDIS_URL(): string | undefined {
    return process.env.REDIS_URL;
  },
  get JWT_SECRET(): string {
    return process.env.JWT_SECRET!;
  },
  get JWT_REFRESH_SECRET(): string {
    return process.env.JWT_REFRESH_SECRET!;
  },
  get JWT_EXPIRES_IN(): string {
    return process.env.JWT_EXPIRES_IN || '1h';
  },
  get JWT_REFRESH_EXPIRES_IN(): string {
    return process.env.JWT_REFRESH_EXPIRES_IN || '30d';
  },
  get PORT(): number {
    return parseInt(process.env.PORT || '3000', 10);
  },
  get NODE_ENV(): string {
    return process.env.NODE_ENV || 'development';
  },
  get FRONTEND_URL(): string {
    return process.env.FRONTEND_URL || 'http://localhost:5173';
  },
  get isProduction(): boolean {
    return this.NODE_ENV === 'production';
  },
};

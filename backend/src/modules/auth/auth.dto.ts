// auth.dto.ts
// Validation schemas for authentication request bodies.

import { z } from 'zod';

export const loginSchema = z.object({
  email: z
    .string({ required_error: 'email is required' })
    .email('email must be a valid email address'),
  password: z
    .string({ required_error: 'password is required' })
    .min(8, 'password must be at least 8 characters')
    .max(128, 'password cannot exceed 128 characters'),
});

export const refreshTokenSchema = z.object({
  refresh_token: z
    .string({ required_error: 'refresh_token is required' })
    .min(1, 'refresh_token cannot be empty'),
});

// 4-6 digit numeric PIN used to unlock parent controls on the device.
export const pinSchema = z
  .string({ required_error: 'pin is required' })
  .regex(/^\d{4,6}$/, 'PIN must be 4-6 digits');

export const setPinSchema = z.object({
  pin: pinSchema,
});

export const verifyPinSchema = z.object({
  email: z
    .string({ required_error: 'email is required' })
    .email('email must be a valid email address'),
  pin: pinSchema,
});

export const biometricTokenSchema = z.object({
  email: z
    .string({ required_error: 'email is required' })
    .email('email must be a valid email address'),
  password: z
    .string({ required_error: 'password is required' })
    .min(8, 'password must be at least 8 characters')
    .max(128, 'password cannot exceed 128 characters'),
});

export const registerSchema = z.object({
  name: z
    .string({ required_error: 'name is required' })
    .min(1, 'name cannot be empty')
    .max(255, 'name cannot exceed 255 characters'),
  email: z
    .string({ required_error: 'email is required' })
    .email('email must be a valid email address'),
  password: z
    .string({ required_error: 'password is required' })
    .min(8, 'password must be at least 8 characters')
    .max(128, 'password cannot exceed 128 characters'),
  child_name: z
    .string({ required_error: 'child_name cannot be empty' })
    .min(1, 'child_name cannot be empty')
    .max(255, 'child_name cannot exceed 255 characters')
    .optional(),
  birth_date: z
    .string({ required_error: 'birth_date must be YYYY-MM-DD' })
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'birth_date must be in YYYY-MM-DD format')
    .optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type SetPinInput = z.infer<typeof setPinSchema>;
export type VerifyPinInput = z.infer<typeof verifyPinSchema>;
export type BiometricTokenInput = z.infer<typeof biometricTokenSchema>;
// auth.dto.ts
// Validation schemas for authentication request bodies.

import { z } from 'zod';

const passwordField = z
  .string({ required_error: 'password is required' })
  .min(8, 'password must be at least 8 characters')
  .max(128, 'password cannot exceed 128 characters')
  .regex(/[A-Z]/, 'password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'password must contain at least one digit')
  .regex(/[^A-Za-z0-9]/, 'password must contain at least one special character');

export const loginSchema = z.object({
  email: z
    .string({ required_error: 'email is required' })
    .email('email must be a valid email address'),
  password: passwordField,
  access_key: z.string().optional(),
});

export const refreshTokenSchema = z.object({
  // Optional: browser clients send the httpOnly cookie instead.
  refresh_token: z
    .string()
    .min(1, 'refresh_token cannot be empty')
    .optional(),
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
  password: passwordField,
});

export const registerSchema = z.object({
  name: z
    .string({ required_error: 'name is required' })
    .min(1, 'name cannot be empty')
    .max(255, 'name cannot exceed 255 characters'),
  email: z
    .string({ required_error: 'email is required' })
    .email('email must be a valid email address'),
  password: passwordField,
  child_name: z
    .string({ required_error: 'child_name cannot be empty' })
    .min(1, 'child_name cannot be empty')
    .max(255, 'child_name cannot exceed 255 characters')
    .optional(),
  birth_date: z
    .string({ required_error: 'birth_date must be YYYY-MM-DD' })
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'birth_date must be in YYYY-MM-DD format')
    .refine((v) => !Number.isNaN(new Date(`${v}T00:00:00Z`).getTime()), {
      message: 'birth_date must be a valid calendar date',
    })
    .refine((v) => new Date(`${v}T00:00:00Z`).getTime() <= Date.now(), {
      message: 'birth_date cannot be in the future',
    })
    .optional(),
});

export const forgotPasswordSchema = z.object({
  email: z
    .string({ required_error: 'email is required' })
    .email('email must be a valid email address'),
});

export const resetPasswordSchema = z.object({
  token: z
    .string({ required_error: 'token is required' })
    .min(1, 'token cannot be empty'),
  new_password: passwordField,
});

export const updateProfileSchema = z.object({
  name: z
    .string({ required_error: 'name is required' })
    .min(1, 'name cannot be empty')
    .max(255, 'name cannot exceed 255 characters'),
});

export const changePasswordSchema = z.object({
  current_password: z
    .string({ required_error: 'current_password is required' })
    .min(8, 'current_password must be at least 8 characters'),
  new_password: passwordField,
});

export const deleteAccountSchema = z.object({
  password: z
    .string({ required_error: 'password is required' })
    .min(1, 'password cannot be empty'),
});

export const pushTokenSchema = z.object({
  token: z
    .string({ required_error: 'token is required' })
    .min(1, 'token cannot be empty'),
  platform: z.enum(['ios', 'android', 'web']).optional(),
});

// 2FA schemas — IDOR hardening: no parentId in the body; the
// authenticated JWT supplies it on protected routes.

export const twoFactorAuthSchema = z.object({
  // setup() returns the secret + QR; nothing required in the body.
  // Optional fields kept for forward compatibility.
  secret: z.string().optional(),
});

export const twoFactorVerifySchema = z.object({
  secret: z
    .string({ required_error: 'TOTP secret is required' })
    .min(1, 'TOTP secret cannot be empty'),
  token: z
    .string({ required_error: 'TOTP token is required' })
    .min(1, 'TOTP token cannot be empty')
    .regex(/^\d{6}$/, 'TOTP token must be 6 digits'),
});

export const twoFactorEnableSchema = z.object({
  secret: z
    .string({ required_error: 'TOTP secret is required' })
    .min(1, 'TOTP secret cannot be empty'),
  token: z
    .string({ required_error: 'TOTP token is required' })
    .min(1, 'TOTP token cannot be empty')
    .regex(/^\d{6}$/, 'TOTP token must be 6 digits'),
});

export const twoFactorRecoverySchema = z.object({
  // No body fields — recovery codes are looked up by the JWT user.
});

export const twoFactorChallengeSchema = z.object({
  twoFactorToken: z
    .string({ required_error: 'twoFactorToken is required' })
    .min(1, 'twoFactorToken cannot be empty'),
  token: z
    .string({ required_error: 'TOTP token is required' })
    .min(1, 'TOTP token cannot be empty')
    .regex(/^\d{6}$/, 'TOTP token must be 6 digits'),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type SetPinInput = z.infer<typeof setPinSchema>;
export type VerifyPinInput = z.infer<typeof verifyPinSchema>;
export type BiometricTokenInput = z.infer<typeof biometricTokenSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;
export type TwoFactorAuthInput = z.infer<typeof twoFactorAuthSchema>;
export type TwoFactorVerifyInput = z.infer<typeof twoFactorVerifySchema>;
export type TwoFactorEnableInput = z.infer<typeof twoFactorEnableSchema>;
export type TwoFactorRecoveryInput = z.infer<typeof twoFactorRecoverySchema>;
export type TwoFactorChallengeInput = z.infer<typeof twoFactorChallengeSchema>;
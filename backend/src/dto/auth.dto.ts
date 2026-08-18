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

export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
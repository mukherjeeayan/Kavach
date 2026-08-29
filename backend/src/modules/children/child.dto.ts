// child.dto.ts
// Validation schemas for child-profile request bodies.

import { z } from 'zod';

export const createChildSchema = z.object({
  name: z
    .string({ required_error: 'name is required' })
    .min(1, 'name cannot be empty')
    .max(255, 'name cannot exceed 255 characters'),
  birth_date: z
    .string({ required_error: 'birth_date must be YYYY-MM-DD' })
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'birth_date must be in YYYY-MM-DD format')
    .optional(),
});

export const updateChildSchema = z.object({
  name: z
    .string({ required_error: 'name cannot be empty' })
    .min(1, 'name cannot be empty')
    .max(255, 'name cannot exceed 255 characters')
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

/**
 * Daily screen-time limit in minutes. `null` clears the limit.
 * Values are bounded by a sane maximum (24 h).
 */
export const screenTimeLimitSchema = z.object({
  limit_minutes: z
    .number({ required_error: 'limit_minutes is required' })
    .int('limit_minutes must be an integer')
    .min(0, 'limit_minutes cannot be negative')
    .max(1440, 'limit_minutes cannot exceed 1440 (24 hours)')
    .nullable(),
});

export const setChildPhoneSchema = z.object({
  phone: z
    .string()
    .max(32, 'phone cannot exceed 32 characters')
    .nullable(),
});

export type CreateChildInput = z.infer<typeof createChildSchema>;
export type UpdateChildInput = z.infer<typeof updateChildSchema>;
export type ScreenTimeLimitInput = z.infer<typeof screenTimeLimitSchema>;
export type SetChildPhoneInput = z.infer<typeof setChildPhoneSchema>;
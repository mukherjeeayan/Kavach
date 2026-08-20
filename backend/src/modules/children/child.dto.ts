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

export type CreateChildInput = z.infer<typeof createChildSchema>;
export type ScreenTimeLimitInput = z.infer<typeof screenTimeLimitSchema>;
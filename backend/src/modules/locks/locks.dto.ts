// locks.dto.ts
// Validation schemas for scheduled lock windows.

import { z } from 'zod';

const timeSchema = z
  .string({ required_error: 'time is required' })
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'time must be in HH:MM format');

export const createLockSchema = z.object({
  // Omit to apply the window to every device of the child.
  device_id: z.string().uuid('must be a valid UUID').optional(),
  // 0 (Sunday) - 6 (Saturday); null/omitted = every day.
  day_of_week: z.number().int('day_of_week must be an integer').min(0).max(6).nullable().optional(),
  start_time: timeSchema,
  end_time: timeSchema,
  is_active: z.boolean().optional(),
});

export const updateLockSchema = z.object({
  device_id: z.string().uuid('must be a valid UUID').optional(),
  day_of_week: z.number().int('day_of_week must be an integer').min(0).max(6).nullable().optional(),
  start_time: timeSchema.optional(),
  end_time: timeSchema.optional(),
  is_active: z.boolean().optional(),
});

export type CreateLockInput = z.infer<typeof createLockSchema>;
export type UpdateLockInput = z.infer<typeof updateLockSchema>;

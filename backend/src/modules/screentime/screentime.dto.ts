// screentime.dto.ts
// Validation schemas for screen-time uploads.

import { z } from 'zod';

const isValidDate = (v: string) => !Number.isNaN(new Date(`${v}T00:00:00Z`).getTime());

export const screenTimeUploadSchema = z.object({
  // Device-generated UUID for the whole batch. Retries with the same
  // batch_id are deduplicated server-side (no double counting).
  batch_id: z.string().uuid('must be a valid UUID').optional(),
  entries: z
    .array(
      z.object({
        app_package: z
          .string({ required_error: 'app_package is required' })
          .min(1, 'app_package cannot be empty')
          .max(255, 'app_package cannot exceed 255 characters'),
        app_category: z.string().max(50).optional(),
        seconds: z
          .number({ required_error: 'seconds is required' })
          .int('seconds must be an integer')
          .min(0, 'seconds cannot be negative')
          .max(86400, 'seconds cannot exceed one day'),
        // YYYY-MM-DD — defaults to the server's current date. Devices may
        // only backfill up to 7 days and never report future dates.
        date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .refine(isValidDate, { message: 'date must be a valid calendar date' })
          .refine((v) => new Date(`${v}T00:00:00Z`).getTime() <= Date.now(), {
            message: 'date cannot be in the future',
          })
          .refine(
            (v) =>
              Date.now() - new Date(`${v}T00:00:00Z`).getTime() <=
              7 * 24 * 60 * 60 * 1000,
            { message: 'date cannot be older than 7 days' }
          )
          .optional(),
      })
    )
    .min(1, 'entries cannot be empty')
    .max(500, 'too many entries in a single upload'),
});

export type ScreenTimeUploadInput = z.infer<typeof screenTimeUploadSchema>;

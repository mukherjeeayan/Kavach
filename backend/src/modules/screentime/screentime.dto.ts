// screentime.dto.ts
// Validation schemas for screen-time uploads.

import { z } from 'zod';

export const screenTimeUploadSchema = z.object({
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
        // YYYY-MM-DD — defaults to the server's current date.
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      })
    )
    .min(1, 'entries cannot be empty')
    .max(500, 'too many entries in a single upload'),
});

export type ScreenTimeUploadInput = z.infer<typeof screenTimeUploadSchema>;

// deviceAlert.dto.ts
// Validation for the tamper-alert endpoint body.

import { z } from 'zod';

export const tamperAlertSchema = z.object({
  details: z
    .string({ required_error: 'details is required' })
    .min(1, 'details cannot be empty')
    .max(1000, 'details cannot exceed 1000 characters'),
});

export type TamperAlertInput = z.infer<typeof tamperAlertSchema>;
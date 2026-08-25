// integration.dto.ts
// Validation schemas for third-party integrations.

import { z } from 'zod';

export const createIntegrationSchema = z.object({
  integration_type: z.enum(['SCHOOL_PORTAL', 'CALENDAR', 'HEALTH_APP', 'CUSTOM'], {
    required_error: 'integration_type is required',
  }),
  name: z
    .string({ required_error: 'name is required' })
    .min(1, 'name cannot be empty')
    .max(255),
  config: z.record(z.unknown()).default({}),
});

export const updateIntegrationSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  config: z.record(z.unknown()).optional(),
  is_active: z.boolean().optional(),
});

export type CreateIntegrationInput = z.infer<typeof createIntegrationSchema>;
export type UpdateIntegrationInput = z.infer<typeof updateIntegrationSchema>;

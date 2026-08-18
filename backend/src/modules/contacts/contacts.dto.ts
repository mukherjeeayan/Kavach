// contacts.dto.ts
// Validation schemas for contact allow/block rules.

import { z } from 'zod';

export const createContactSchema = z.object({
  phone_number: z
    .string({ required_error: 'phone_number is required' })
    .min(3, 'phone_number is too short')
    .max(32, 'phone_number cannot exceed 32 characters'),
  contact_name: z.string().max(255).optional(),
  rule_type: z.enum(['ALLOW', 'BLOCK']).default('BLOCK'),
  device_id: z.string().uuid('must be a valid UUID').optional(),
});

export const updateContactSchema = z.object({
  contact_name: z.string().max(255).optional(),
  rule_type: z.enum(['ALLOW', 'BLOCK']).optional(),
  is_active: z.boolean().optional(),
});

export type CreateContactInput = z.infer<typeof createContactSchema>;
export type UpdateContactInput = z.infer<typeof updateContactSchema>;

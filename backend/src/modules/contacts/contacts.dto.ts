// contacts.dto.ts
// Validation schemas for contact allow/block rules.

import { z } from 'zod';

export const createContactSchema = z.object({
  phone_number: z
    .string({ required_error: 'phone_number is required' })
    // Digits, spaces, hyphens, parentheses; must contain 3-15 digits so
    // garbage strings can't poison call-screening matches.
    .regex(/^[+]?[\d\s\-().]{3,20}$/, 'phone_number contains invalid characters')
    .refine(
      (v) => {
        const digits = v.replace(/\D/g, '');
        return digits.length >= 3 && digits.length <= 15;
      },
      { message: 'phone_number must contain 3-15 digits' }
    ),
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

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

export type CreateChildInput = z.infer<typeof createChildSchema>;
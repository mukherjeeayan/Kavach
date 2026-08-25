// urlFilter.dto.ts
// Validation schemas for URL filter rules.

import { z } from 'zod';

export const createUrlFilterSchema = z.object({
  url_pattern: z
    .string({ required_error: 'url_pattern is required' })
    .min(1, 'url_pattern cannot be empty')
    .max(2048),
  rule_type: z.enum(['ALLOW', 'BLOCK']).default('BLOCK'),
  category: z.string().max(100).optional(),
  is_active: z.boolean().default(true),
});

export const updateUrlFilterSchema = z.object({
  url_pattern: z.string().min(1).max(2048).optional(),
  rule_type: z.enum(['ALLOW', 'BLOCK']).optional(),
  category: z.string().max(100).optional(),
  is_active: z.boolean().optional(),
});

export type CreateUrlFilterInput = z.infer<typeof createUrlFilterSchema>;
export type UpdateUrlFilterInput = z.infer<typeof updateUrlFilterSchema>;

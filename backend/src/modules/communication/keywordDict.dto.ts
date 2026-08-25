// keywordDict.dto.ts
// Validation schemas for keyword dictionary management.

import { z } from 'zod';

export const createKeywordSchema = z.object({
  category: z.enum(['CYBERBULLYING', 'SELF_HARM', 'PROFANITY', 'DRUGS', 'CUSTOM'], {
    required_error: 'category is required',
  }),
  keyword: z
    .string({ required_error: 'keyword is required' })
    .min(1, 'keyword cannot be empty')
    .max(255),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
  language: z.string().max(10).default('en'),
  is_active: z.boolean().default(true),
});

export const updateKeywordSchema = z.object({
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  is_active: z.boolean().optional(),
});

export const bulkCreateKeywordsSchema = z.object({
  keywords: z.array(
    z.object({
      category: z.enum(['CYBERBULLYING', 'SELF_HARM', 'PROFANITY', 'DRUGS', 'CUSTOM']),
      keyword: z.string().min(1).max(255),
      severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
      language: z.string().max(10).default('en'),
    })
  ).min(1, 'At least one keyword is required').max(100, 'Cannot add more than 100 keywords at once'),
});

export type CreateKeywordInput = z.infer<typeof createKeywordSchema>;
export type UpdateKeywordInput = z.infer<typeof updateKeywordSchema>;
export type BulkCreateKeywordsInput = z.infer<typeof bulkCreateKeywordsSchema>;

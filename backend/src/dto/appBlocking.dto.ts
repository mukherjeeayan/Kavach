// appBlocking.dto.ts
// Validation schemas for all App Blocking POST request bodies.
// Using Zod for type-safe schema validation at the route layer
// so that no unvalidated data ever reaches the service.

import { z } from 'zod';

export const blockAppSchema = z.object({
  device_id: z
    .string({ required_error: 'device_id is required' })
    .uuid('device_id must be a valid UUID'),
  package_name: z
    .string({ required_error: 'package_name is required' })
    .min(1, 'package_name cannot be empty')
    .max(255, 'package_name cannot exceed 255 characters'),
  app_name: z
    .string()
    .max(255)
    .optional(),
  block_reason: z
    .string()
    .max(500, 'block_reason cannot exceed 500 characters')
    .optional(),
});

export const requestUnblockSchema = z.object({
  rule_id: z
    .string({ required_error: 'rule_id is required' })
    .uuid('rule_id must be a valid UUID'),
  reason: z
    .string({ required_error: 'reason is required' })
    .min(1, 'reason cannot be empty')
    .max(500, 'reason cannot exceed 500 characters'),
});

// Inferred TypeScript types from the schemas — keeps DTOs and
// validation perfectly in sync without manual duplication.
export type BlockAppInput = z.infer<typeof blockAppSchema>;
export type RequestUnblockInput = z.infer<typeof requestUnblockSchema>;

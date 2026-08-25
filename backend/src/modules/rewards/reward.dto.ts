// reward.dto.ts
// Validation schemas for the reward system (catalog, points, redemptions).

import { z } from 'zod';

export const createCatalogSchema = z.object({
  name: z
    .string({ required_error: 'name is required' })
    .min(1)
    .max(255),
  description: z.string().max(500).optional(),
  cost_points: z
    .number({ required_error: 'cost_points is required' })
    .int()
    .min(1, 'cost_points must be at least 1'),
  icon: z.string().max(50).optional(),
});

export const updateCatalogSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(500).optional(),
  cost_points: z.number().int().min(1).optional(),
  icon: z.string().max(50).optional(),
  is_active: z.boolean().optional(),
});

export const awardPointsSchema = z.object({
  child_id: z.string().uuid('must be a valid UUID'),
  points: z
    .number({ required_error: 'points is required' })
    .int()
    .min(1, 'points must be at least 1'),
  reason: z.string().max(255).optional(),
  source: z.string().max(100).optional(),
});

export const redeemRewardSchema = z.object({
  reward_id: z.string().uuid('must be a valid UUID'),
});

export const resolveRedemptionSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED', 'FULFILLED']),
  parent_notes: z.string().max(500).optional(),
});

export type CreateCatalogInput = z.infer<typeof createCatalogSchema>;
export type UpdateCatalogInput = z.infer<typeof updateCatalogSchema>;
export type AwardPointsInput = z.infer<typeof awardPointsSchema>;
export type RedeemRewardInput = z.infer<typeof redeemRewardSchema>;
export type ResolveRedemptionInput = z.infer<typeof resolveRedemptionSchema>;

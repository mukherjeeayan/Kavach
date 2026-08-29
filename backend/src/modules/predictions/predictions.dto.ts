// predictions.dto.ts
// Validation schemas for behavior prediction requests.

import { z } from 'zod';

export const predictionParamsSchema = z.object({
  childId: z.string().uuid('childId must be a valid UUID'),
});

export type PredictionParamsInput = z.infer<typeof predictionParamsSchema>;

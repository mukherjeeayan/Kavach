// reports.dto.ts
// Validation schemas for reports requests.

import { z } from 'zod';

export const reportsQuerySchema = z.object({
  childId: z.string().uuid('must be a valid UUID'),
  period: z.enum(['week', 'month']).default('week'),
});

export type ReportsQueryInput = z.infer<typeof reportsQuerySchema>;

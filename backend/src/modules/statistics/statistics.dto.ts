// statistics.dto.ts
// Validation schemas for statistics query parameters.

import { z } from 'zod';

export const overviewStatsQuery = z.object({
  period: z.enum(['week', 'month']).default('week'),
});

export const usageSummaryQuery = z.object({
  period: z.enum(['week', 'month']).default('week'),
});

export type OverviewStatsQuery = z.infer<typeof overviewStatsQuery>;
export type UsageSummaryQuery = z.infer<typeof usageSummaryQuery>;

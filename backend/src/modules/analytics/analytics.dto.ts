// analytics.dto.ts
// Validation schemas for analytics reports.

import { z } from 'zod';

export const generateReportSchema = z.object({
  report_type: z.enum(['WEEKLY', 'MONTHLY'], {
    required_error: 'report_type is required',
  }),
});

export type GenerateReportInput = z.infer<typeof generateReportSchema>;

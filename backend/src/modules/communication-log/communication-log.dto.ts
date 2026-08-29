// communication-log.dto.ts
// Validation schemas for communication log operations.

import { z } from 'zod';

export const createCommunicationLogSchema = z.object({
  comm_type: z.enum(['SMS_IN', 'SMS_OUT', 'CALL_IN', 'CALL_OUT', 'CALL_MISSED']),
  contact_number: z.string().max(32).optional(),
  contact_name: z.string().max(255).optional(),
  content_snippet: z.string().max(500).optional(),
  duration_seconds: z.number().int().min(0).optional(),
  recorded_at: z.string().datetime({ offset: true }).optional(),
});

export type CreateCommunicationLogInput = z.infer<typeof createCommunicationLogSchema>;

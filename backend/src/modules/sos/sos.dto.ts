// sos.dto.ts
// Validation schemas for emergency SOS events.

import { z } from 'zod';

export const createSosSchema = z.object({
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  battery_level: z.number().int().min(0).max(100).optional(),
  trigger_method: z.enum(['BUTTON', 'WIDGET', 'VOICE', 'HARDWARE_KEY']).default('BUTTON'),
});

export const resolveSosSchema = z.object({
  notes: z.string().max(500).optional(),
});

export type CreateSosInput = z.infer<typeof createSosSchema>;
export type ResolveSosInput = z.infer<typeof resolveSosSchema>;

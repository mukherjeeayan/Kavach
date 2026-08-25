// voiceCommand.dto.ts
// Validation schemas for voice command recording.

import { z } from 'zod';

export const recordCommandSchema = z.object({
  command_text: z
    .string({ required_error: 'command_text is required' })
    .min(1, 'command_text cannot be empty')
    .max(500),
  intent: z.string().max(255).optional(),
  was_executed: z.boolean().default(false),
});

export type RecordCommandInput = z.infer<typeof recordCommandSchema>;

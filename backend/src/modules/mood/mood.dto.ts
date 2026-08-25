// mood.dto.ts
// Validation schemas for mood tracking (child self-reports).

import { z } from 'zod';

export const createMoodLogSchema = z.object({
  mood_score: z
    .number({ required_error: 'mood_score is required' })
    .int()
    .min(1, 'mood_score must be between 1 and 5')
    .max(5, 'mood_score must be between 1 and 5'),
  note: z.string().max(500).optional(),
  activities: z.array(z.string().max(100)).max(20).optional(),
});

export type CreateMoodLogInput = z.infer<typeof createMoodLogSchema>;

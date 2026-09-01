// aiSettings.dto.ts
// Validation schemas for AI settings endpoints.

import { z } from 'zod';

export const aiProviderEnum = z.enum(['openai', 'gemini', 'anthropic']);

export const upsertAiSettingsSchema = z.object({
  provider: aiProviderEnum,
  api_key: z.string().min(1, 'API key is required').max(512),
  model: z.string().min(1, 'Model is required').max(100),
});

export const deleteAiSettingsSchema = z.object({
  provider: aiProviderEnum,
});

export type UpsertAiSettingsInput = z.infer<typeof upsertAiSettingsSchema>;
export type DeleteAiSettingsInput = z.infer<typeof deleteAiSettingsSchema>;

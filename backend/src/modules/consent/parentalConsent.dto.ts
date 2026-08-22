// parentalConsent.dto.ts
// Zod schemas for parental consent endpoints.

import { z } from 'zod';

export const consentTypeEnum = z.enum([
  'location',
  'app_usage',
  'communications',
  'mental_health',
]);

export const createConsentSchema = z.object({
  child_id: z.string().uuid(),
  consent_type: consentTypeEnum,
});

export const revokeConsentSchema = z.object({
  child_id: z.string().uuid(),
  consent_type: consentTypeEnum,
});

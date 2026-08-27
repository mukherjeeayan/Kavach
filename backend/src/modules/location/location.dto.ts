// location.dto.ts
// Validation schemas for location pings.

import { z } from 'zod';

export const locationUploadSchema = z.object({
  latitude: z.number({ required_error: 'latitude is required' }).min(-90).max(90),
  longitude: z.number({ required_error: 'longitude is required' }).min(-180).max(180),
  accuracy_m: z.number().min(0).optional(),
  speed_kmh: z.number().min(0).optional(),
  // ISO-8601; defaults to server time. Future timestamps are rejected so
  // forged pings can't poison 'current location' ordering; pings may not
  // backfill more than 7 days.
  recorded_at: z
    .string()
    .datetime()
    .refine((v) => new Date(v).getTime() <= Date.now() + 60_000, {
      message: 'recorded_at cannot be in the future',
    })
    .refine((v) => Date.now() - new Date(v).getTime() <= 7 * 24 * 60 * 60 * 1000, {
      message: 'recorded_at cannot be older than 7 days',
    })
    .optional(),
});

/** Query params for location history endpoint. */
export const locationHistoryQuery = z.object({
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(100),
});

/** Query params for current location endpoint. */
export const currentLocationQuery = z.object({
  limit: z.coerce.number().int().min(1).max(10).default(1),
});


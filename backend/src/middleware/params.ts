// params.ts
// Shared Zod schemas for path/query validation. Every :id in a route
// must be a valid UUID so a malformed identifier yields 422 (not a
// Postgres 22P02 500).

import { z } from 'zod';

const uuid = z.string().uuid('must be a valid UUID');

/** Validates a single UUID path param, e.g. uuidParams('childId'). */
export const uuidParams = (key: string) => z.object({ [key]: uuid });

/** Validates a route with a childId and one nested UUID param. */
export const childAndUuidParams = (key: string) =>
  z.object({
    childId: uuid,
    [key]: uuid,
  });

/** Pagination query params: page >= 1, limit 1..100 (defaults applied). */
export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const dateQuery = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD')
    .optional(),
});

export const screenTimeSummaryQuery = z.object({
  range: z.enum(['day', 'week', 'month']).default('day'),
});

export const locationHistoryQuery = z.object({
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(100),
});
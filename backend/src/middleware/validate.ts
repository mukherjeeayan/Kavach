// validate.ts
// Generic Zod validation middleware.
// Validates the request body against a Zod schema before the
// controller ever sees the data.  Returns 422 with field-level
// errors on failure.

import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

export const validate = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(422).json({
          success: false,
          data: null,
          error: error.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
          timestamp: new Date().toISOString(),
          request_id: req.headers['x-request-id'],
        });
      }
      next(error);
    }
  };
};

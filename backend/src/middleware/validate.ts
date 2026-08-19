// validate.ts
// Generic Zod validation middleware.
// Validates request body / query / params against a Zod schema before
// the controller ever sees the data. Returns 422 with field-level
// errors on failure. Parsed (and defaulted) values are written back
// onto the request so downstream code sees the validated result.

import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

const sendValidationError = (res: Response, req: Request, error: ZodError) => {
  return res.status(422).json({
    success: false,
    data: null,
    error: error.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    })),
    timestamp: new Date().toISOString(),
    request_id: req.headers['x-request-id'] || 'unknown',
  });
};

export const validate = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) return sendValidationError(res, req, error);
      next(error);
    }
  };
};

export const validateQuery = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.query = schema.parse(req.query);
      next();
    } catch (error) {
      if (error instanceof ZodError) return sendValidationError(res, req, error);
      next(error);
    }
  };
};

export const validateParams = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.params = schema.parse(req.params);
      next();
    } catch (error) {
      if (error instanceof ZodError) return sendValidationError(res, req, error);
      next(error);
    }
  };
};
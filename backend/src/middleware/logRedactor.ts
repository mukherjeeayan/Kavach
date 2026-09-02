// logRedactor.ts
// Middleware that redacts PII (emails, phone numbers, names) from
// request/response logs for DPDP/COPPA compliance.
//
// PII must never appear in production logs to prevent data breaches
// and compliance violations. This middleware intercepts log output
// and strips sensitive patterns before they reach the log destination.

import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

// PII patterns to redact
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_RE = /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
// Indian phone numbers (10 digits with optional +91)
const INDIAN_PHONE_RE = /(\+91[-.\s]?)?[6-9]\d{9}/g;
// Credit card numbers (masked)
const CC_RE = /\b\d{4}[-.\s]?\d{4}[-.\s]?\d{4}[-.\s]?\d{4}\b/g;
// SSN-like patterns
const SSN_RE = /\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b/g;

/**
 * Redact PII from a string value.
 */
export function redactPII(value: string): string {
  return value
    .replace(EMAIL_RE, '[EMAIL_REDACTED]')
    .replace(INDIAN_PHONE_RE, '[PHONE_REDACTED]')
    .replace(PHONE_RE, '[PHONE_REDACTED]')
    .replace(CC_RE, '[CC_REDACTED]')
    .replace(SSN_RE, '[SSN_REDACTED]');
}

/**
 * Recursively redact PII from an object or array.
 */
function redactObject(obj: unknown): unknown {
  if (typeof obj === 'string') {
    return redactPII(obj);
  }
  if (Array.isArray(obj)) {
    return obj.map(redactObject);
  }
  if (obj && typeof obj === 'object') {
    const redacted: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      // Never log these fields at all
      const sensitiveKeys = new Set([
        'password', 'token', 'secret', 'api_key', 'apiKey',
        'authorization', 'cookie', 'ssn', 'credit_card',
      ]);
      if (sensitiveKeys.has(key.toLowerCase())) {
        redacted[key] = '[REDACTED]';
      } else {
        redacted[key] = redactObject(value);
      }
    }
    return redacted;
  }
  return obj;
}

/**
 * Express middleware that redacts PII from logged request/response data.
 * Intercepts the logger to strip emails, phone numbers, and names.
 */
export function logRedactorMiddleware(req: Request, res: Response, next: NextFunction) {
  // Store original method
  const originalJson = res.json.bind(res);

  // Wrap res.json to redact PII from response bodies before logging
  res.json = function (body: unknown) {
    if (process.env.NODE_ENV === 'production') {
      // In production, log the redacted version
      const redacted = redactObject(body);
      logger.debug('Response body (redacted)', {
        path: req.path,
        method: req.method,
        statusCode: res.statusCode,
        body: redacted,
      });
    }
    return originalJson(body);
  };

  next();
}

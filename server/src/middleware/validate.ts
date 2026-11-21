import type { RequestHandler } from 'express';
import { z } from 'zod';

import { HttpError } from '../lib/http-error.js';

/** Validates and replaces `req.body` with the parsed value. */
export function validateBody<T extends z.ZodType>(schema: T): RequestHandler {
  return (req, _res, next) => {
    // Express 5 leaves req.body undefined when no body is sent; treat it as empty so the error
    // names the missing fields instead of "expected object".
    const parsed = schema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return next(new HttpError(400, 'Validation failed', z.flattenError(parsed.error)));
    }
    req.body = parsed.data;
    next();
  };
}

/** Parses route params with `schema`, throwing a 400 on failure. Call it inside the handler. */
export function parseParams<T extends z.ZodType>(schema: T, params: unknown): z.output<T> {
  const parsed = schema.safeParse(params);
  if (!parsed.success) {
    throw new HttpError(400, 'Invalid route parameters', z.flattenError(parsed.error));
  }
  return parsed.data;
}

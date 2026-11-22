import type { ErrorRequestHandler, RequestHandler } from 'express';
import mongoose from 'mongoose';

import { HttpError } from '../lib/http-error.js';

export const notFound: RequestHandler = (_req, _res, next) => {
  next(new HttpError(404, 'Not found'));
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message, details: err.details });
    return;
  }
  if (err instanceof mongoose.Error.CastError) {
    res.status(400).json({ error: `Invalid ${err.path}` });
    return;
  }
  // Unique index violation, e.g. a second district with the same openNorthSlug.
  if (err instanceof mongoose.mongo.MongoServerError && err.code === 11000) {
    res.status(409).json({ error: 'Duplicate value', details: err.keyValue });
    return;
  }
  if (err instanceof mongoose.Error.ValidationError) {
    res.status(400).json({ error: 'Validation failed', details: err.errors });
    return;
  }
  // Malformed JSON body or oversized payload from express.json().
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'Invalid JSON body' });
    return;
  }
  if (err?.type === 'entity.too.large') {
    res.status(413).json({ error: 'Request payload is too large' });
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
};

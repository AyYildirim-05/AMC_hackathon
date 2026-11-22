import type { RequestHandler } from 'express';

import { HttpError } from '../lib/http-error.js';
import { verifyToken } from '../lib/jwt.js';
import type { PersonRole } from '../models/person.model.js';

export type AuthContext = {
  userId: string;
  role: PersonRole;
};

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

/** Verifies the `Authorization: Bearer <accessToken>` header and populates `req.auth`. */
export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next(new HttpError(401, 'Missing or invalid Authorization header'));
  }

  const token = header.slice('Bearer '.length).trim();
  if (!token) {
    return next(new HttpError(401, 'Missing access token'));
  }

  try {
    const payload = verifyToken(token, 'access');
    req.auth = { userId: payload.sub, role: payload.role };
    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Populates `req.auth` when a `Bearer` token is present; lets unauthenticated requests through.
 * Invalid or expired Bearer tokens still fail with 401 so clients can refresh.
 */
export const optionalAuth: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header) {
    return next();
  }
  if (!header.startsWith('Bearer ')) {
    return next(new HttpError(401, 'Missing or invalid Authorization header'));
  }
  const token = header.slice('Bearer '.length).trim();
  if (!token) {
    return next(new HttpError(401, 'Missing access token'));
  }
  try {
    const payload = verifyToken(token, 'access');
    req.auth = { userId: payload.sub, role: payload.role };
    next();
  } catch (err) {
    next(err);
  }
};

/** Restricts a route to specific roles. Must be used after `requireAuth`. */
export function requireRole(...allowedRoles: PersonRole[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.auth) {
      return next(new HttpError(401, 'Unauthorized'));
    }
    if (!allowedRoles.includes(req.auth.role)) {
      return next(new HttpError(403, 'Forbidden'));
    }
    next();
  };
}

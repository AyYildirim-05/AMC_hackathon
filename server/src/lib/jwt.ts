import { createHmac, timingSafeEqual } from 'node:crypto';

import { env } from '../config/env.js';
import { HttpError } from './http-error.js';
import { PERSON_ROLES, type PersonRole } from '../models/person.model.js';

export type TokenType = 'access' | 'refresh';

export type JwtPayload = {
  sub: string;
  role: PersonRole;
  type: TokenType;
  iat: number;
  exp: number;
};

const JWT_HEADER = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');

function signSegment(signingInput: string, secret: string): string {
  return createHmac('sha256', secret).update(signingInput).digest('base64url');
}

export function signToken(
  claims: { sub: string; role: PersonRole; type: TokenType },
  expiresInSeconds: number,
  secret = env.JWT_SECRET,
): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: JwtPayload = {
    sub: claims.sub,
    role: claims.role,
    type: claims.type,
    iat: now,
    exp: now + expiresInSeconds,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signingInput = `${JWT_HEADER}.${encodedPayload}`;
  const signature = signSegment(signingInput, secret);
  return `${signingInput}.${signature}`;
}

export function verifyToken(
  token: string,
  expectedType?: TokenType,
  secret = env.JWT_SECRET,
): JwtPayload {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new HttpError(401, 'Invalid token');
  }

  const [headerPart, payloadPart, signaturePart] = parts;
  if (headerPart !== JWT_HEADER) {
    throw new HttpError(401, 'Unsupported token header');
  }

  const expectedSig = Buffer.from(signSegment(`${headerPart}.${payloadPart}`, secret));
  const actualSig = Buffer.from(signaturePart);
  if (expectedSig.length !== actualSig.length || !timingSafeEqual(expectedSig, actualSig)) {
    throw new HttpError(401, 'Invalid token signature');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8'));
  } catch {
    throw new HttpError(401, 'Malformed token payload');
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new HttpError(401, 'Malformed token payload');
  }

  const record = parsed as Record<string, unknown>;
  if (
    typeof record.sub !== 'string' ||
    typeof record.iat !== 'number' ||
    typeof record.exp !== 'number' ||
    (record.type !== 'access' && record.type !== 'refresh') ||
    typeof record.role !== 'string' ||
    !PERSON_ROLES.includes(record.role as PersonRole)
  ) {
    throw new HttpError(401, 'Malformed token claims');
  }

  if (expectedType && record.type !== expectedType) {
    throw new HttpError(401, 'Invalid token type');
  }

  const now = Math.floor(Date.now() / 1000);
  if (record.exp <= now) {
    throw new HttpError(401, 'Token expired');
  }

  return {
    sub: record.sub,
    role: record.role as PersonRole,
    type: record.type,
    iat: record.iat,
    exp: record.exp,
  };
}

export function issueAuthTokens(person: { id: string; role: PersonRole }) {
  const accessToken = signToken(
    { sub: person.id, role: person.role, type: 'access' },
    env.JWT_ACCESS_EXPIRES_IN_SECONDS,
  );
  const refreshToken = signToken(
    { sub: person.id, role: person.role, type: 'refresh' },
    env.JWT_REFRESH_EXPIRES_IN_SECONDS,
  );

  return {
    accessToken,
    refreshToken,
    expiresIn: env.JWT_ACCESS_EXPIRES_IN_SECONDS,
  };
}

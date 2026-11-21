import { createHmac, timingSafeEqual } from 'node:crypto';

import { HttpError } from './http-error.js';
import { PERSON_ROLES, type PersonRole } from '../models/person.model.js';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be set in server/.env (at least 32 characters)');
  }
  return secret;
}

function getPositiveIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

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
  secret = getJwtSecret(),
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
  secret = getJwtSecret(),
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
  const accessExpiresIn = getPositiveIntEnv('JWT_ACCESS_EXPIRES_IN_SECONDS', 60 * 60);
  const refreshExpiresIn = getPositiveIntEnv('JWT_REFRESH_EXPIRES_IN_SECONDS', 60 * 60 * 24 * 7);
  const accessToken = signToken(
    { sub: person.id, role: person.role, type: 'access' },
    accessExpiresIn,
  );
  const refreshToken = signToken(
    { sub: person.id, role: person.role, type: 'refresh' },
    refreshExpiresIn,
  );

  return {
    accessToken,
    refreshToken,
    expiresIn: accessExpiresIn,
  };
}

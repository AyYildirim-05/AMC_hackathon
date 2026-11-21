import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';

import { HttpError } from '../lib/http-error.js';
import { issueAuthTokens, verifyToken } from '../lib/jwt.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { DistrictModel, PREFERRED_LANGUAGES, PersonModel } from '../models/index.js';

const postalCodeSchema = z
  .string()
  .trim()
  .transform((val) => val.replace(/\s+/g, '').toUpperCase())
  .refine((val) => /^[A-Z]\d[A-Z]\d[A-Z]\d$/.test(val), {
    message: 'Postal code must be a valid 6-character Canadian postal code (e.g. H2J1S4)',
  });

const registerSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, 'Username must be at least 3 characters')
    .max(50, 'Username must be at most 50 characters')
    .regex(/^[a-zA-Z0-9_.-]+$/, 'Username may only contain letters, numbers, _, ., and -'),
  email: z.email('Please enter a valid email address').trim().toLowerCase().max(255),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  postalCode: postalCodeSchema,
  homeDistrictId: z.string().trim().optional(),
  preferredLanguage: z.enum(PREFERRED_LANGUAGES).optional().default('fr'),
});

const loginSchema = z.object({
  /** Accepts either an email address or a username. */
  email: z.string().trim().min(1, 'Email or username is required'),
  password: z.string().min(1, 'Password is required'),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

type RegisterBody = z.infer<typeof registerSchema>;
type LoginBody = z.infer<typeof loginSchema>;
type RefreshBody = z.infer<typeof refreshSchema>;

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function caseInsensitiveExact(value: string): RegExp {
  return new RegExp(`^${escapeRegex(value)}$`, 'i');
}

export const authRouter = Router();

authRouter.post('/register', validateBody(registerSchema), async (req, res, next) => {
  try {
    const body = req.body as RegisterBody;

    const existing = await PersonModel.findOne({
      $or: [{ email: body.email }, { username: caseInsensitiveExact(body.username) }],
    }).lean();

    if (existing) {
      const field = existing.email === body.email ? 'Email' : 'Username';
      throw new HttpError(409, `${field} is already in use`);
    }

    let resolvedDistrictId: mongoose.Types.ObjectId | null = null;
    if (body.homeDistrictId) {
      if (!mongoose.isValidObjectId(body.homeDistrictId)) {
        throw new HttpError(400, 'Invalid homeDistrictId');
      }
      const district = await DistrictModel.findById(body.homeDistrictId).select('_id').lean();
      if (!district) {
        throw new HttpError(404, 'Selected district not found');
      }
      resolvedDistrictId = district._id;
    } else {
      const firstDistrict = await DistrictModel.findOne().select('_id').lean();
      resolvedDistrictId = firstDistrict?._id ?? null;
    }

    const passwordHash = await hashPassword(body.password);
    const person = await PersonModel.create({
      username: body.username,
      email: body.email,
      passwordHash,
      postalCode: body.postalCode,
      homeDistrictId: resolvedDistrictId,
      preferredLanguage: body.preferredLanguage,
    });

    const user = person.toJSON();
    const tokens = issueAuthTokens({ id: String(person._id), role: person.role });

    res.status(201).json({
      ...tokens,
      uid: String(person._id),
      user,
    });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/login', validateBody(loginSchema), async (req, res, next) => {
  try {
    const { email: identifier, password } = req.body as LoginBody;
    const query = identifier.includes('@')
      ? { email: identifier.toLowerCase() }
      : {
          $or: [
            { username: caseInsensitiveExact(identifier) },
            { email: identifier.toLowerCase() },
          ],
        };

    const person = await PersonModel.findOne(query).select('+passwordHash');
    if (!person || !person.passwordHash || !(await verifyPassword(password, person.passwordHash))) {
      throw new HttpError(401, 'Invalid email or password');
    }

    const user = person.toJSON();
    const tokens = issueAuthTokens({ id: String(person._id), role: person.role });

    res.json({
      ...tokens,
      uid: String(person._id),
      user,
    });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/refresh', validateBody(refreshSchema), async (req, res, next) => {
  try {
    const { refreshToken } = req.body as RefreshBody;
    const payload = verifyToken(refreshToken, 'refresh');

    const person = await PersonModel.findById(payload.sub);
    if (!person) {
      throw new HttpError(401, 'Account not found');
    }

    const tokens = issueAuthTokens({ id: String(person._id), role: person.role });
    res.json({
      ...tokens,
      uid: String(person._id),
    });
  } catch (err) {
    next(err);
  }
});

authRouter.get('/me', requireAuth, async (req, res, next) => {
  try {
    const person = await PersonModel.findById(req.auth!.userId);
    if (!person) {
      throw new HttpError(401, 'Account not found');
    }
    res.json({ user: person.toJSON() });
  } catch (err) {
    next(err);
  }
});

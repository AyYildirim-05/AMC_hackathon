import { Router } from 'express';
import { z } from 'zod';

import { createUploadSignature } from '../lib/cloudinary.js';
import { validateBody } from '../middleware/validate.js';

export const UPLOAD_FOLDERS = ['issues', 'avatars'] as const;

const uploadSignatureInput = z
  .object({
    folder: z.enum(UPLOAD_FOLDERS).optional(),
  })
  .default({});

type UploadSignatureBody = z.infer<typeof uploadSignatureInput>;

export const uploadRouter = Router();

// Once feature/auth is merged, add `requireAuth` before `validateBody`.
uploadRouter.post('/signature', validateBody(uploadSignatureInput), (req, res) => {
  const { folder } = req.body as UploadSignatureBody;
  res.json(createUploadSignature({ folder }));
});

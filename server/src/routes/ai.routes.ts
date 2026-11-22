import { Router } from 'express';
import { z } from 'zod';

import {
  ALLOWED_IMAGE_MIME_TYPES,
  describeIssueImages,
  MAX_BASE64_LENGTH_PER_IMAGE,
  MAX_IMAGES_PER_REQUEST,
  SUPPORTED_LANGUAGES,
} from '../lib/gemini.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';

const inlineImageSchema = z.object({
  mimeType: z.enum(ALLOWED_IMAGE_MIME_TYPES),
  base64: z.string().trim().min(1).max(MAX_BASE64_LENGTH_PER_IMAGE),
});

const describeImageBodySchema = z.object({
  images: z.array(inlineImageSchema).min(1).max(MAX_IMAGES_PER_REQUEST),
  language: z.enum(SUPPORTED_LANGUAGES).default('en'),
  context: z
    .object({
      category: z.string().trim().max(100).optional(),
      address: z.string().trim().max(250).optional(),
      districtName: z.string().trim().max(120).optional(),
      elements: z.array(z.string().trim().max(60)).max(10).optional(),
    })
    .optional(),
});

type DescribeImageBody = z.infer<typeof describeImageBodySchema>;

export function createAiRouter(deps?: { describeImages?: typeof describeIssueImages }) {
  const describeImages = deps?.describeImages ?? describeIssueImages;
  const router = Router();

  /**
   * POST /api/ai/describe-image
   *
   * Generates a civic issue description in the requested application language (`en` or `fr`)
   * from 1–3 submitted base64-encoded images using Gemini. Signed-in users only.
   */
  router.post(
    '/describe-image',
    requireAuth,
    validateBody(describeImageBodySchema),
    async (req, res) => {
      const body = req.body as DescribeImageBody;
      const result = await describeImages({
        images: body.images,
        language: body.language,
        context: body.context,
      });
      res.json(result);
    },
  );

  return router;
}

export const aiRouter = createAiRouter();

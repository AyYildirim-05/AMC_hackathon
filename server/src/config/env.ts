import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { z } from 'zod';

const SERVER_ENV_PATH = resolve(dirname(fileURLToPath(import.meta.url)), '../../.env');
if (existsSync(SERVER_ENV_PATH)) {
  process.loadEnvFile(SERVER_ENV_PATH);
}

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGIN: z.string().default('http://localhost:8081'),
  MONGODB_URI: z.string().min(1).default('mongodb://localhost:27017/app'),
  /** Proxy hops in front of the app (1 on Cloud Run / behind a load balancer), so req.ip is the client's. */
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  CLOUDINARY_CLOUD_NAME: z.string().trim().min(1).optional(),
  CLOUDINARY_API_KEY: z.string().trim().min(1).optional(),
  CLOUDINARY_API_SECRET: z.string().trim().min(1).optional(),
  CLOUDINARY_UPLOAD_FOLDER: z.string().trim().min(1).default('issues'),
});

export type Env = z.infer<typeof schema>;

function load(): Env {
  const parsed = schema.safeParse({
    ...process.env,
    MONGODB_URI: process.env.MONGODB_URI || process.env.DATABASE_URL || undefined,
  });
  if (!parsed.success) {
    throw new Error(`Invalid environment:\n${z.prettifyError(parsed.error)}`);
  }
  return parsed.data;
}

export const env = load();

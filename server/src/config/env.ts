import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGIN: z.string().default('http://localhost:8081'),
  MONGODB_URI: z.string().min(1).default('mongodb://localhost:27017/app'),
  /** Proxy hops in front of the app (1 on Cloud Run / behind a load balancer), so req.ip is the client's. */
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
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

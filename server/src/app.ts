import cors from 'cors';
import express from 'express';
import helmet from 'helmet';

import { districtRouter } from './controllers/district.controller.js';
import { issueRouter } from './controllers/issue.controller.js';
import { errorHandler, notFound } from './middleware/error-handler.js';
import { authRouter } from './routes/auth.routes.js';
import { healthRouter } from './routes/health.routes.js';
import { uploadRouter } from './routes/upload.routes.js';

/** Builds the app without connecting to MongoDB, so tests can import it directly. */
export function createApp() {
  const app = express();
  const trustProxy = Number(process.env.TRUST_PROXY ?? 0);
  const corsOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:8081')
    .split(',')
    .map((o) => o.trim());

  app.disable('x-powered-by');
  app.set('trust proxy', trustProxy);
  app.use(helmet());
  app.use(cors({ origin: corsOrigins }));
  app.use(express.json({ limit: '1mb' }));

  app.use('/api/health', healthRouter);
  app.use('/api/uploads', uploadRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/issues', issueRouter);
  app.use('/api/districts', districtRouter);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

import { Router } from 'express';

import { pingMongo } from '../lib/mongo.js';

export const healthRouter = Router();

healthRouter.get('/', async (_req, res) => {
  try {
    await pingMongo();
    res.status(200).json({ status: 'ok', mongo: 'ok' });
  } catch {
    res.status(503).json({ status: 'error', mongo: 'error' });
  }
});

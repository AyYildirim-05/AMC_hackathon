import { Router } from 'express';

import { requireAuth } from '../middleware/auth.js';
import { getProfileDataForUser } from '../services/profile.service.js';

export const profileRouter = Router();

profileRouter.get('/me', requireAuth, async (req, res) => {
  res.json(await getProfileDataForUser(req.auth!.userId));
});

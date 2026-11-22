import { type RequestHandler, Router } from 'express';

import { optionalAuth, requireAuth } from '../middleware/auth.js';
import { parseParams, validateBody } from '../middleware/validate.js';
import {
  addCommentToIssue,
  commentsByIssue,
  createCommentInput,
} from '../services/comment.service.js';
import {
  allIssues,
  districtIdParams,
  issueByDistrict,
  issueById,
  issueIdParams,
  reportIssue,
  reportIssueInput,
  updateIssue,
  updateIssueInput,
  updateStatus,
  updateStatusInput,
} from '../services/issue.service.js';
import { toggleVote, toggleVoteInput, userVotesSummary } from '../services/vote.service.js';

const withAuthField =
  (field: 'createdById' | 'updatedById'): RequestHandler =>
  (req, _res, next) => {
    if (req.auth?.userId) {
      req.body = {
        ...(req.body && typeof req.body === 'object' ? req.body : {}),
        [field]: req.auth.userId,
      };
    }
    next();
  };

export const issueRouter = Router();

issueRouter.post(
  '/',
  optionalAuth,
  withAuthField('createdById'),
  validateBody(reportIssueInput),
  async (req, res) => {
    res.status(201).json(await reportIssue(req.body));
  },
);

issueRouter.get('/', async (_req, res) => {
  res.json(await allIssues());
});

issueRouter.get('/votes/me', requireAuth, async (req, res) => {
  res.json(await userVotesSummary(req.auth!.userId));
});

issueRouter.get('/district/:districtId', async (req, res) => {
  const { districtId } = parseParams(districtIdParams, req.params);
  res.json(await issueByDistrict(districtId));
});

issueRouter.get('/:id/comments', async (req, res) => {
  const { id } = parseParams(issueIdParams, req.params);
  res.json(await commentsByIssue(id));
});

issueRouter.post(
  '/:id/comments',
  requireAuth,
  validateBody(createCommentInput),
  async (req, res) => {
    const { id } = parseParams(issueIdParams, req.params);
    res.status(201).json(await addCommentToIssue(id, req.auth!.userId, req.auth!.role, req.body));
  },
);

issueRouter.post('/:id/votes', requireAuth, validateBody(toggleVoteInput), async (req, res) => {
  const { id } = parseParams(issueIdParams, req.params);
  res.json(await toggleVote(id, req.auth!.userId, req.body.voteType));
});

issueRouter.get('/:id', async (req, res) => {
  const { id } = parseParams(issueIdParams, req.params);
  res.json(await issueById(id));
});

issueRouter.patch(
  '/:id',
  optionalAuth,
  withAuthField('updatedById'),
  validateBody(updateIssueInput),
  async (req, res) => {
    const { id } = parseParams(issueIdParams, req.params);
    res.json(await updateIssue(id, req.body));
  },
);

issueRouter.patch(
  '/:id/status',
  optionalAuth,
  withAuthField('updatedById'),
  validateBody(updateStatusInput),
  async (req, res) => {
    const { id } = parseParams(issueIdParams, req.params);
    res.json(await updateStatus(id, req.body));
  },
);

import { Router } from 'express';

import { parseParams, validateBody } from '../middleware/validate.js';
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

export const issueRouter = Router();

issueRouter.post('/', validateBody(reportIssueInput), async (req, res) => {
  res.status(201).json(await reportIssue(req.body));
});

issueRouter.get('/', async (_req, res) => {
  res.json(await allIssues());
});

issueRouter.get('/district/:districtId', async (req, res) => {
  const { districtId } = parseParams(districtIdParams, req.params);
  res.json(await issueByDistrict(districtId));
});

issueRouter.get('/:id', async (req, res) => {
  const { id } = parseParams(issueIdParams, req.params);
  res.json(await issueById(id));
});

issueRouter.patch('/:id', validateBody(updateIssueInput), async (req, res) => {
  const { id } = parseParams(issueIdParams, req.params);
  res.json(await updateIssue(id, req.body));
});

issueRouter.patch('/:id/status', validateBody(updateStatusInput), async (req, res) => {
  const { id } = parseParams(issueIdParams, req.params);
  res.json(await updateStatus(id, req.body));
});

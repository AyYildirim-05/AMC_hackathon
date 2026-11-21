import { z } from 'zod';

import { HttpError } from '../lib/http-error.js';
import { objectId } from '../lib/object-id.js';
import { ISSUE_CATEGORIES, ISSUE_STATUSES, type IssueStatus } from '../models/index.js';
import { districtExists, findDistrictManagerId } from '../repositories/district.repository.js';
import {
  createIssue,
  findAllIssues,
  findIssueById,
  findIssuesByDistrict,
  type IssueChanges,
  updateIssueById,
} from '../repositories/issue.repository.js';
import { personExists } from '../repositories/person.repository.js';

export const issueIdParams = z.object({ id: objectId });
export const districtIdParams = z.object({ districtId: objectId });

// No default on images here: a default inside the partial update schema would wipe images on every edit.
const issueFields = {
  title: z.string().trim().min(1).max(150),
  description: z.string().trim().min(1),
  category: z.enum(ISSUE_CATEGORIES),
  images: z.array(z.url()),
  address: z.string().trim().min(1).max(255),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  districtId: objectId,
};

/**
 * Fields a reporter may set. Unknown keys (status, upvoteCount, createdById, updatedById, ...)
 * are stripped, so those keep their model defaults or come from the auth token.
 */
export const reportIssueInput = z.object({
  ...issueFields,
  images: issueFields.images.default([]),
});
export type ReportIssueInput = z.infer<typeof reportIssueInput>;

/** Any subset of the issue's fields. Status has its own endpoint; counters are never client-set. */
export const updateIssueInput = z
  .object(issueFields)
  .partial()
  .refine((changes) => Object.keys(changes).length > 0, {
    message: 'Provide at least one field to update',
  });
export type UpdateIssueInput = z.infer<typeof updateIssueInput>;

export const updateStatusInput = z.object({
  status: z.enum(ISSUE_STATUSES),
});
export type UpdateStatusInput = z.infer<typeof updateStatusInput>;

/** Closed issues cannot be reopened or moved to another status; every other transition is allowed. */
const FINAL_STATUSES: readonly IssueStatus[] = ['completed', 'cancelled'];

const assertDistrictExists = async (id: string) => {
  if (!(await districtExists(id))) throw new HttpError(400, 'Unknown districtId');
};

const assertPersonExists = async (id: string) => {
  if (!(await personExists(id))) throw new HttpError(401, 'Authenticated user not found');
};

const orNotFound = <T>(issue: T | null): T => {
  if (!issue) throw new HttpError(404, 'Issue not found');
  return issue;
};

const isDistrictManager = async (districtId: string, personId: string) => {
  const managerId = await findDistrictManagerId(districtId);
  return managerId !== null && String(managerId) === personId;
};

/**
 * Saves `changes` only if the issue still has `expectedStatus`, so a permission check made
 * against the status just read cannot be bypassed by a concurrent status change.
 */
const applyUpdate = async (id: string, changes: IssueChanges, expectedStatus?: IssueStatus) => {
  const updated = await updateIssueById(id, changes, expectedStatus);
  if (!updated) throw new HttpError(409, 'Issue changed while saving; reload and retry');
  return updated;
};

export const reportIssue = async (input: ReportIssueInput, createdById: string) => {
  const actorId = createdById.toLowerCase();
  await Promise.all([assertDistrictExists(input.districtId), assertPersonExists(actorId)]);
  return createIssue({ ...input, createdById: actorId });
};

export const allIssues = () => findAllIssues();

export const issueById = async (id: string) => orNotFound(await findIssueById(id));

export const issueByDistrict = async (districtId: string) => {
  if (!(await districtExists(districtId))) throw new HttpError(404, 'District not found');
  return findIssuesByDistrict(districtId);
};

export const updateIssue = async (id: string, input: UpdateIssueInput, updatedById: string) => {
  const actorId = updatedById.toLowerCase();
  const issue = orNotFound(await findIssueById(id));
  const isManager = await isDistrictManager(String(issue.districtId), actorId);
  const isCreator = String(issue.createdById) === actorId;
  if (!isManager && !isCreator) {
    throw new HttpError(403, 'Only the district manager or the issue creator can edit this issue');
  }
  // The creator may edit only before work starts; the manager may edit at any status.
  if (!isManager && issue.status !== 'not_started') {
    throw new HttpError(403, 'The creator can only edit an issue while its status is not_started');
  }
  if (input.districtId) await assertDistrictExists(input.districtId);
  return applyUpdate(id, { ...input, updatedById: actorId }, isManager ? undefined : 'not_started');
};

export const updateStatus = async (id: string, input: UpdateStatusInput, updatedById: string) => {
  const actorId = updatedById.toLowerCase();
  const issue = orNotFound(await findIssueById(id));
  if (!(await isDistrictManager(String(issue.districtId), actorId))) {
    throw new HttpError(403, 'Only the district manager can change the status');
  }
  if (FINAL_STATUSES.includes(issue.status) && input.status !== issue.status) {
    throw new HttpError(409, `A ${issue.status} issue's status cannot be changed`);
  }
  return applyUpdate(id, { ...input, updatedById: actorId }, issue.status);
};

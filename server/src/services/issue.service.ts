import { z } from 'zod';

import { isIssuePhotoUrl } from '../lib/cloudinary.js';
import { HttpError } from '../lib/http-error.js';
import { objectId } from '../lib/object-id.js';
import { ISSUE_CATEGORIES, ISSUE_STATUSES, type IssueStatus } from '../models/index.js';
import { getIssueCommentSummaries } from '../repositories/comment.repository.js';
import { districtExists, findDistrictManagerId } from '../repositories/district.repository.js';
import {
  createIssue,
  findAllIssues,
  findIssueById,
  findIssuesByDistrict,
  type IssueChanges,
  updateIssueById,
} from '../repositories/issue.repository.js';
import { findPersonsByIds, personExists } from '../repositories/person.repository.js';

/** Mirrors MAX_ISSUE_PHOTOS in the app's photo-picker.tsx. */
const MAX_ISSUE_PHOTOS = 5;

export const issueIdParams = z.object({ id: objectId });
export const districtIdParams = z.object({ districtId: objectId });

// No default on images here: a default inside the partial update schema would wipe images on every edit.
const issueFields = {
  title: z.string().trim().min(1).max(150),
  description: z.string().trim().min(1),
  category: z.enum(ISSUE_CATEGORIES),
  // Only photos uploaded through POST /api/uploads/signature; the app allows 5 per issue.
  images: z
    .array(
      z.url().refine((url) => isIssuePhotoUrl(url), {
        message: 'Must be a photo uploaded through /api/uploads/signature',
      }),
    )
    .max(MAX_ISSUE_PHOTOS),
  address: z.string().trim().min(1).max(255),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  districtId: objectId,
  external311Ref: z.string().trim().max(50).nullable().optional(),
};

/**
 * Fields a reporter may set. Unknown keys (status, upvoteCount, updatedById, ...) are stripped,
 * so those keep their model defaults.
 */
export const reportIssueInput = z.object({
  ...issueFields,
  images: issueFields.images.default([]),
  createdById: objectId,
});
export type ReportIssueInput = z.infer<typeof reportIssueInput>;

/** Any subset of the issue's fields. Status has its own endpoint; counters are never client-set. */
export const updateIssueInput = z
  .object(issueFields)
  .partial()
  .extend({ updatedById: objectId })
  .refine(({ updatedById: _, ...changes }) => Object.keys(changes).length > 0, {
    message: 'Provide at least one field to update',
  });
export type UpdateIssueInput = z.infer<typeof updateIssueInput>;

export const updateStatusInput = z.object({
  status: z.enum(ISSUE_STATUSES),
  updatedById: objectId,
});
export type UpdateStatusInput = z.infer<typeof updateStatusInput>;

/** Closed issues cannot be reopened or moved to another status; every other transition is allowed. */
const FINAL_STATUSES: readonly IssueStatus[] = ['completed', 'cancelled'];

const ROLE_LABELS: Record<string, string> = {
  district_manager: 'Gestionnaire Arrondissement',
  admin: 'Administration Montréal',
  resident: 'Citoyen',
};

type SerializableDoc = { toJSON: () => Record<string, unknown> };

export type EnrichedIssue = Record<string, unknown> & {
  id: string;
  author: {
    username: string;
    name: string;
    avatarUrl: string | null;
  } | null;
  officialResponse: {
    author: string;
    role: string;
    comment: string;
    createdAt: string;
  } | null;
  commentsCount: number;
};

/**
 * Attaches `author`, `officialResponse`, and `commentsCount` to a batch of issue documents
 * using at most two database queries (one comment aggregation, one person batch lookup).
 */
export async function enrichIssues(docs: readonly SerializableDoc[]): Promise<EnrichedIssue[]> {
  if (docs.length === 0) return [];

  const rawIssues = docs.map((doc) => doc.toJSON());
  const issueIds = rawIssues.map((issue) => String(issue.id));
  const commentSummaries = await getIssueCommentSummaries(issueIds);

  const personIds = new Set<string>();
  for (const issue of rawIssues) {
    if (issue.createdById) personIds.add(String(issue.createdById));
    const summary = commentSummaries.get(String(issue.id));
    if (summary?.latestOfficial?.userId) {
      personIds.add(summary.latestOfficial.userId);
    }
  }

  const persons = await findPersonsByIds(Array.from(personIds));
  const personById = new Map(
    persons.map((person) => {
      const json = person.toJSON() as Record<string, unknown>;
      return [String(json.id), json] as const;
    }),
  );

  return rawIssues.map((issue) => {
    const id = String(issue.id);
    const creator = personById.get(String(issue.createdById));
    const summary = commentSummaries.get(id);
    const latestOfficial = summary?.latestOfficial ?? null;
    const officialPerson = latestOfficial ? personById.get(latestOfficial.userId) : undefined;

    return {
      ...issue,
      id,
      author: creator
        ? {
            username: String(creator.username),
            name: String(creator.displayName || creator.username),
            avatarUrl: (creator.avatarUrl as string | null) ?? null,
          }
        : null,
      officialResponse: latestOfficial
        ? {
            author: officialPerson ? String(officialPerson.username) : 'city_official',
            role:
              ROLE_LABELS[String(officialPerson?.role ?? 'district_manager')] ??
              'Gestionnaire Arrondissement',
            comment: latestOfficial.body,
            createdAt: latestOfficial.createdAt.toISOString(),
          }
        : null,
      commentsCount: summary?.count ?? 0,
    };
  });
}

export async function enrichIssue(doc: SerializableDoc): Promise<EnrichedIssue> {
  const [enriched] = await enrichIssues([doc]);
  return enriched;
}

const assertDistrictExists = async (id: string) => {
  if (!(await districtExists(id))) throw new HttpError(400, 'Unknown districtId');
};

const assertPersonExists = async (id: string) => {
  if (!(await personExists(id))) throw new HttpError(400, 'Unknown createdById');
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
  return enrichIssue(updated);
};

export const reportIssue = async (input: ReportIssueInput) => {
  await Promise.all([
    assertDistrictExists(input.districtId),
    assertPersonExists(input.createdById),
  ]);
  const created = await createIssue(input);
  return enrichIssue(created);
};

export const allIssues = async () => enrichIssues(await findAllIssues());

export const issueById = async (id: string) => enrichIssue(orNotFound(await findIssueById(id)));

export const issueByDistrict = async (districtId: string) => {
  if (!(await districtExists(districtId))) throw new HttpError(404, 'District not found');
  return enrichIssues(await findIssuesByDistrict(districtId));
};

export const updateIssue = async (id: string, input: UpdateIssueInput) => {
  const issue = orNotFound(await findIssueById(id));
  const isManager = await isDistrictManager(String(issue.districtId), input.updatedById);
  const isCreator = String(issue.createdById) === input.updatedById;
  if (!isManager && !isCreator) {
    throw new HttpError(403, 'Only the district manager or the issue creator can edit this issue');
  }
  // The creator may edit only before work starts; the manager may edit at any status.
  if (!isManager && issue.status !== 'not_started') {
    throw new HttpError(403, 'The creator can only edit an issue while its status is not_started');
  }
  if (input.districtId) await assertDistrictExists(input.districtId);
  return applyUpdate(id, input, isManager ? undefined : 'not_started');
};

export const updateStatus = async (id: string, input: UpdateStatusInput) => {
  const issue = orNotFound(await findIssueById(id));
  if (!(await isDistrictManager(String(issue.districtId), input.updatedById))) {
    throw new HttpError(403, 'Only the district manager can change the status');
  }
  if (FINAL_STATUSES.includes(issue.status) && input.status !== issue.status) {
    throw new HttpError(409, `A ${issue.status} issue's status cannot be changed`);
  }
  return applyUpdate(id, input, issue.status);
};

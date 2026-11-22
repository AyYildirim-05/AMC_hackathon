import { z } from 'zod';

import { isIssuePhotoUrl } from '../lib/cloudinary.js';
import { HttpError } from '../lib/http-error.js';
import type { PersonRole } from '../models/index.js';
import { createComment, findCommentsByIssue } from '../repositories/comment.repository.js';
import { findDistrictManagerId } from '../repositories/district.repository.js';
import { findIssueById } from '../repositories/issue.repository.js';
import { findPersonsByIds } from '../repositories/person.repository.js';

const MAX_COMMENT_PHOTOS = 3;

export const createCommentInput = z
  .object({
    body: z.string().trim().max(2000).optional().default(''),
    images: z
      .array(
        z.url().refine((url) => isIssuePhotoUrl(url), {
          message: 'Must be a photo uploaded through /api/uploads/signature',
        }),
      )
      .max(MAX_COMMENT_PHOTOS)
      .optional()
      .default([]),
    isOfficialResponse: z.boolean().optional().default(false),
  })
  .superRefine((data, ctx) => {
    if (!data.body && data.images.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['body'],
        message: 'Comment must include text or at least one image',
      });
    }
  });
export type CreateCommentInput = z.infer<typeof createCommentInput>;

type SerializableDoc = { toJSON: () => Record<string, unknown> };

export type EnrichedComment = Record<string, unknown> & {
  id: string;
  issueId: string;
  userId: string;
  body: string;
  images: string[];
  isOfficialResponse: boolean;
  createdAt: string;
  updatedAt: string;
  author: {
    username: string;
    displayName: string;
    avatarUrl: string | null;
    role: PersonRole;
  } | null;
};

async function enrichComments(docs: readonly SerializableDoc[]): Promise<EnrichedComment[]> {
  if (docs.length === 0) return [];

  const rawComments = docs.map((doc) => doc.toJSON());
  const userIds = Array.from(new Set(rawComments.map((c) => String(c.userId))));
  const persons = await findPersonsByIds(userIds);
  const personById = new Map(
    persons.map((person) => {
      const json = person.toJSON() as Record<string, unknown>;
      return [String(json.id), json] as const;
    }),
  );

  return rawComments.map((comment) => {
    const author = personById.get(String(comment.userId));
    return {
      ...comment,
      id: String(comment.id),
      issueId: String(comment.issueId),
      userId: String(comment.userId),
      body: String(comment.body ?? ''),
      images: Array.isArray(comment.images) ? comment.images.map(String) : [],
      isOfficialResponse: Boolean(comment.isOfficialResponse),
      createdAt: String(comment.createdAt),
      updatedAt: String(comment.updatedAt),
      author: author
        ? {
            username: String(author.username),
            displayName: String(author.displayName || author.username),
            avatarUrl: (author.avatarUrl as string | null) ?? null,
            role: (author.role as PersonRole) ?? 'resident',
          }
        : null,
    };
  });
}

export async function commentsByIssue(issueId: string): Promise<EnrichedComment[]> {
  const issue = await findIssueById(issueId);
  if (!issue) throw new HttpError(404, 'Issue not found');
  const docs = await findCommentsByIssue(issueId);
  return enrichComments(docs);
}

export async function addCommentToIssue(
  issueId: string,
  userId: string,
  userRole: PersonRole,
  input: CreateCommentInput,
): Promise<EnrichedComment> {
  const issue = await findIssueById(issueId);
  if (!issue) throw new HttpError(404, 'Issue not found');

  let isOfficialResponse = false;
  if (input.isOfficialResponse) {
    const managerId = await findDistrictManagerId(String(issue.districtId));
    const isManager = managerId !== null && String(managerId) === userId;
    if (!isManager && userRole !== 'admin') {
      throw new HttpError(
        403,
        'Only the district manager or an admin can post an official response',
      );
    }
    isOfficialResponse = true;
  }

  const created = await createComment({
    issueId,
    userId,
    body: input.body,
    images: input.images,
    isOfficialResponse,
  });
  const [enriched] = await enrichComments([created]);
  return enriched;
}

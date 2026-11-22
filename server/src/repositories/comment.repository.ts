import mongoose from 'mongoose';

import { IssueCommentModel } from '../models/index.js';

export type NewComment = {
  issueId: string;
  userId: string;
  body: string;
  images: string[];
  isOfficialResponse: boolean;
};

export type IssueCommentSummary = {
  count: number;
  latestOfficial: {
    body: string;
    userId: string;
    createdAt: Date;
  } | null;
};

export const createComment = (data: NewComment) => IssueCommentModel.create(data);

export const findCommentsByIssue = (issueId: string) =>
  IssueCommentModel.find({ issueId }).sort({ createdAt: 1 });

export const findCommentsByIssueIds = (issueIds: string[]) => {
  if (issueIds.length === 0) return Promise.resolve([]);
  return IssueCommentModel.find({ issueId: { $in: issueIds } }).sort({ createdAt: 1 });
};

export const findCommentsByUser = (userId: string) =>
  IssueCommentModel.find({ userId }).sort({ createdAt: 1 });

export const findAllComments = () => IssueCommentModel.find().sort({ createdAt: 1 });

/**
 * Fetches total comment count and latest official response for a batch of issues in one query.
 */
export async function getIssueCommentSummaries(
  issueIds: string[],
): Promise<Map<string, IssueCommentSummary>> {
  const result = new Map<string, IssueCommentSummary>();
  if (issueIds.length === 0) return result;

  const objectIds = issueIds
    .filter((id) => mongoose.isValidObjectId(id))
    .map((id) => new mongoose.Types.ObjectId(id));
  if (objectIds.length === 0) return result;

  const rows = await IssueCommentModel.aggregate<{
    _id: mongoose.Types.ObjectId;
    count: number;
    officialComments: { body: string; userId: mongoose.Types.ObjectId; createdAt: Date }[];
  }>([
    { $match: { issueId: { $in: objectIds } } },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: '$issueId',
        count: { $sum: 1 },
        officialComments: {
          $push: {
            $cond: [
              '$isOfficialResponse',
              { body: '$body', userId: '$userId', createdAt: '$createdAt' },
              '$$REMOVE',
            ],
          },
        },
      },
    },
  ]);

  for (const row of rows) {
    const latest = row.officialComments[0] ?? null;
    result.set(String(row._id), {
      count: row.count,
      latestOfficial: latest
        ? {
            body: latest.body,
            userId: String(latest.userId),
            createdAt: latest.createdAt,
          }
        : null,
    });
  }

  return result;
}

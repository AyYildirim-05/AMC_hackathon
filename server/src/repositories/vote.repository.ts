import mongoose from 'mongoose';

import { IssueModel, IssueVoteModel, type IssueVoteType } from '../models/index.js';

export const findVotesByUser = (userId: string) =>
  IssueVoteModel.find({ userId }).sort({ createdAt: -1 });

export type ToggleVoteResult = {
  active: boolean;
  upvoteCount: number;
  resolutionConfirmations: number;
};

/**
 * Toggles a user's vote (`upvote` or `confirm_resolved`) on an issue and syncs the issue's
 * denormalized counter from the vote collection so counts never drift or go negative.
 */
export async function toggleIssueVote(
  issueId: string,
  userId: string,
  voteType: IssueVoteType,
): Promise<ToggleVoteResult | null> {
  const deleted = await IssueVoteModel.findOneAndDelete({ issueId, userId, voteType });
  let active: boolean;

  if (deleted) {
    active = false;
  } else {
    try {
      await IssueVoteModel.create({ issueId, userId, voteType });
    } catch (err) {
      // Concurrent duplicate insert: treat as already active.
      if (!(err instanceof mongoose.mongo.MongoServerError && err.code === 11000)) {
        throw err;
      }
    }
    active = true;
  }

  const [upvoteCount, resolutionConfirmations] = await Promise.all([
    IssueVoteModel.countDocuments({ issueId, voteType: 'upvote' }),
    IssueVoteModel.countDocuments({ issueId, voteType: 'confirm_resolved' }),
  ]);

  const updated = await IssueModel.findByIdAndUpdate(
    issueId,
    { $set: { upvoteCount, resolutionConfirmations } },
    { returnDocument: 'after' },
  ).lean();

  if (!updated) return null;

  return {
    active,
    upvoteCount: updated.upvoteCount,
    resolutionConfirmations: updated.resolutionConfirmations,
  };
}

import { z } from 'zod';

import { HttpError } from '../lib/http-error.js';
import { ISSUE_VOTE_TYPES, type IssueVoteType } from '../models/index.js';
import { findIssueById } from '../repositories/issue.repository.js';
import { findVotesByUser, toggleIssueVote } from '../repositories/vote.repository.js';

export const toggleVoteInput = z.object({
  voteType: z.enum(ISSUE_VOTE_TYPES),
});
export type ToggleVoteInput = z.infer<typeof toggleVoteInput>;

export async function toggleVote(issueId: string, userId: string, voteType: IssueVoteType) {
  const issue = await findIssueById(issueId);
  if (!issue) throw new HttpError(404, 'Issue not found');

  const result = await toggleIssueVote(issueId, userId, voteType);
  if (!result) throw new HttpError(404, 'Issue not found');

  return {
    issueId,
    voteType,
    ...result,
  };
}

export async function userVotesSummary(userId: string) {
  const votes = await findVotesByUser(userId);
  const upvotedIssueIds: string[] = [];
  const confirmedIssueIds: string[] = [];

  for (const vote of votes) {
    const issueId = String(vote.issueId);
    if (vote.voteType === 'upvote') upvotedIssueIds.push(issueId);
    else if (vote.voteType === 'confirm_resolved') confirmedIssueIds.push(issueId);
  }

  return { upvotedIssueIds, confirmedIssueIds };
}

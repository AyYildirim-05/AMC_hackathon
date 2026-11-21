import { type InferSchemaType, Schema, model } from 'mongoose';

export const ISSUE_VOTE_TYPES = ['upvote', 'confirm_resolved'] as const;
export type IssueVoteType = (typeof ISSUE_VOTE_TYPES)[number];

const issueVoteSchema = new Schema(
  {
    issueId: { type: Schema.Types.ObjectId, ref: 'Issue', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'Person', required: true },
    voteType: { type: String, required: true, enum: ISSUE_VOTE_TYPES },
  },
  {
    collection: 'issue_votes',
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: {
      versionKey: false,
      transform: (_doc, ret: Record<string, unknown>) => {
        ret.id = String(ret._id);
        delete ret._id;
        return ret;
      },
    },
  },
);

issueVoteSchema.index(
  { issueId: 1, userId: 1, voteType: 1 },
  { unique: true, name: 'uq_issue_votes_user_issue_type' },
);

export type IssueVote = InferSchemaType<typeof issueVoteSchema>;
export const IssueVoteModel = model('IssueVote', issueVoteSchema);

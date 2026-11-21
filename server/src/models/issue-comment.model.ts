import { type InferSchemaType, Schema, model } from 'mongoose';

const issueCommentSchema = new Schema(
  {
    issueId: { type: Schema.Types.ObjectId, ref: 'Issue', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'Person', required: true },
    body: { type: String, required: true, trim: true },
    isOfficialResponse: { type: Boolean, required: true, default: false },
  },
  {
    collection: 'issue_comments',
    timestamps: true,
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

issueCommentSchema.index(
  { issueId: 1, createdAt: 1 },
  { name: 'idx_issue_comments_issue_created' },
);

export type IssueComment = InferSchemaType<typeof issueCommentSchema>;
export const IssueCommentModel = model('IssueComment', issueCommentSchema);

import { type Issue, IssueModel, type IssueStatus } from '../models/index.js';

/** Reporter-supplied fields; everything else takes its schema default. Ids are cast by Mongoose. */
export type NewIssue = Pick<
  Issue,
  | 'title'
  | 'description'
  | 'category'
  | 'elements'
  | 'images'
  | 'address'
  | 'latitude'
  | 'longitude'
> & {
  districtId: string;
  createdById: string;
  external311Ref?: string | null;
};

/** Any subset of the editable fields, plus who made the change. */
export type IssueChanges = Partial<Omit<NewIssue, 'createdById'> & { status: IssueStatus }> & {
  updatedById: string;
};

export const createIssue = (data: NewIssue) => IssueModel.create(data);

// Unbounded: returns every issue. Add limit/cursor pagination once the collection grows.
export const findAllIssues = () => IssueModel.find().sort({ createdAt: -1 });

export const findIssueById = (id: string) => IssueModel.findById(id);

export const districtHasIssues = async (districtId: string) =>
  (await IssueModel.exists({ districtId })) !== null;

export const findIssuesByDistrict = (districtId: string) =>
  IssueModel.find({ districtId }).sort({ createdAt: -1 });

export const findIssuesByCreator = (createdById: string) =>
  IssueModel.find({ createdById }).sort({ createdAt: -1 });

/**
 * Returns the updated issue, or null when no issue has that id or, if `expectedStatus` is given,
 * its status no longer matches (someone changed it after the caller's permission check).
 */
export const updateIssueById = (id: string, changes: IssueChanges, expectedStatus?: IssueStatus) =>
  IssueModel.findOneAndUpdate(
    expectedStatus ? { _id: id, status: expectedStatus } : { _id: id },
    { $set: changes },
    { returnDocument: 'after', runValidators: true },
  );

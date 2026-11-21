/**
 * A problem reported by a resident (pothole, broken streetlight, blocked bike lane, …).
 * Field names match the API / `dummy_data/issues.json` exactly, so JSON can be used as-is.
 */

export const ISSUE_CATEGORIES = [
  'roads_potholes',
  'streetlights_utilities',
  'traffic_safety',
] as const;
export type IssueCategory = (typeof ISSUE_CATEGORIES)[number];

export const ISSUE_STATUSES = ['not_started', 'in_progress', 'resolved'] as const;
export type IssueStatus = (typeof ISSUE_STATUSES)[number];

/** UUID string. */
export type Id = string;
/** ISO 8601 timestamp, e.g. `2026-11-18T08:00:00.000Z`. */
export type IsoDateString = string;

export interface IssueAuthor {
  username: string;
  name?: string;
  initials?: string;
  avatar_url?: string;
  avatarUrl?: string;
}

export interface OfficialResponse {
  author: string;
  role?: string;
  comment: string;
}

export interface Issue {
  id: Id;
  title: string;
  description: string;
  category: IssueCategory;
  status: IssueStatus;
  /** Image URLs; empty when none were attached. */
  images: string[];
  address: string;
  latitude: number;
  longitude: number;
  district_id: Id;
  /** Person who reported the issue. */
  created_by_id: Id;
  /** Populated author information for direct UI rendering. */
  author?: IssueAuthor;
  /** Person who last changed it (e.g. a district manager), or `null` if never edited. */
  updated_by_id: Id | null;
  /** Latest official response from a district manager / city representative. */
  official_response?: OfficialResponse | null;
  upvote_count: number;
  /** How many residents confirmed the issue is fixed. */
  resolution_confirmations: number;
  /** Total number of comments on this issue. */
  comments_count?: number;
  /** Reference number in Montréal's 311 system, when the issue was forwarded there. */
  external_311_ref: string | null;
  created_at: IsoDateString;
  updated_at: IsoDateString;
}

/** Payload for reporting a new issue: the server fills in ids, counters, status and timestamps. */
export type CreateIssueInput = Pick<
  Issue,
  'title' | 'description' | 'category' | 'address' | 'latitude' | 'longitude' | 'district_id'
> & { images?: string[] };

/** Fields that can be changed on an existing issue. */
export type UpdateIssueInput = Partial<
  Pick<Issue, 'title' | 'description' | 'category' | 'status' | 'images' | 'external_311_ref'>
>;

export function isIssueCategory(value: unknown): value is IssueCategory {
  return ISSUE_CATEGORIES.includes(value as IssueCategory);
}

export function isIssueStatus(value: unknown): value is IssueStatus {
  return ISSUE_STATUSES.includes(value as IssueStatus);
}

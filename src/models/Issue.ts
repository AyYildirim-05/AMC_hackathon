/**
 * A problem reported by a resident (pothole, broken streetlight, blocked bike lane, …).
 * Normalized from the Express backend API into the frontend domain shape.
 */

export const ISSUE_CATEGORIES = [
  'roads_potholes',
  'streetlights_utilities',
  'traffic_safety',
] as const;
export type IssueCategory = (typeof ISSUE_CATEGORIES)[number];

export const ISSUE_STATUSES = ['not_started', 'in_progress', 'resolved'] as const;
export type IssueStatus = (typeof ISSUE_STATUSES)[number];

export const WEATHER_ELEMENTS = [
  'snow_ice',
  'rain_flooding',
  'high_wind',
  'freezing_rain',
  'extreme_heat',
] as const;
export type WeatherElement = (typeof WEATHER_ELEMENTS)[number];

export const ISSUE_URGENCIES = ['low', 'medium', 'high'] as const;
export type IssueUrgency = (typeof ISSUE_URGENCIES)[number];

/** Maps a 1–10 severity score to a low / medium / high safety hazard urgency level. */
export function severityScoreToUrgency(score: number): IssueUrgency {
  if (score >= 8) return 'high';
  if (score >= 4) return 'medium';
  return 'low';
}

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
  /** Optional weather conditions associated with this issue. */
  elements?: WeatherElement[];
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
  /** AI-assigned hazard severity score from 1 (least severe) to 10 (most severe). */
  severity_score?: number | null;
  /** Derived urgency tier (`low`, `medium`, `high`) used to prioritize triage queues. */
  urgency?: IssueUrgency | null;
  created_at: IsoDateString;
  updated_at: IsoDateString;
}

/** Payload for reporting a new issue: the server fills in ids, counters, status and timestamps. */
export type CreateIssueInput = Pick<
  Issue,
  'title' | 'description' | 'category' | 'address' | 'latitude' | 'longitude' | 'district_id'
> & { elements?: WeatherElement[]; images?: string[] };

/** Fields that can be changed on an existing issue. */
export type UpdateIssueInput = Partial<
  Pick<
    Issue,
    'title' | 'description' | 'category' | 'status' | 'elements' | 'images' | 'external_311_ref'
  >
>;

export function isIssueCategory(value: unknown): value is IssueCategory {
  return ISSUE_CATEGORIES.includes(value as IssueCategory);
}

export function isIssueStatus(value: unknown): value is IssueStatus {
  return ISSUE_STATUSES.includes(value as IssueStatus);
}

export function isWeatherElement(value: unknown): value is WeatherElement {
  return WEATHER_ELEMENTS.includes(value as WeatherElement);
}

export function isIssueUrgency(value: unknown): value is IssueUrgency {
  return ISSUE_URGENCIES.includes(value as IssueUrgency);
}

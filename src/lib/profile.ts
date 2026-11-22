import type { Id, Issue, IsoDateString, IssueStatus } from '@/models/Issue';

export interface Person {
  id: Id;
  username: string;
  /** Name shown on the profile. */
  display_name: string;
  /** Profile photo; null shows initials. */
  avatar_url: string | null;
  email: string;
  postal_code: string;
  home_district_id: Id;
  role: 'resident' | 'district_manager' | 'admin';
  /** District managers whose identity the city confirmed ("verified" badge). */
  is_verified: boolean;
  /** District managers currently on duty ("active post" badge). */
  is_active_post: boolean;
  preferred_language: 'fr' | 'en';
}

export interface District {
  id: Id;
  name_fr: string;
  name_en: string;
  open_north_slug: string;
  district_type: 'borough' | 'municipality';
  manager_id: Id | null;
  is_claimed: boolean;
}

export interface IssueVote {
  id: Id;
  issue_id: Id;
  user_id: Id;
  vote_type: 'upvote' | 'confirm_resolved';
  created_at: IsoDateString;
}

export interface IssueComment {
  id: Id;
  issue_id: Id;
  user_id: Id;
  body: string;
  images?: string[];
  is_official_response: boolean;
  created_at: IsoDateString;
}

/** Aggregated profile payload loaded from `GET /api/profile/me`. */
export interface ProfileData {
  persons: Person[];
  districts: District[];
  issues: Issue[];
  comments: IssueComment[];
  votes: IssueVote[];
}

export const EMPTY_PROFILE_DATA: ProfileData = {
  persons: [],
  districts: [],
  issues: [],
  comments: [],
  votes: [],
};

/** Finds the person with this username in the loaded profile data, or null. */
export const findPerson = (username: string, data: ProfileData = EMPTY_PROFILE_DATA) =>
  data.persons.find((p) => p.username === username) ?? null;

export interface Territory {
  district: District;
  /** Username of the district's manager, or null when unclaimed. */
  managerUsername: string | null;
  isOwn: boolean;
}

export interface OfficialReply {
  body: string;
  createdAt: IsoDateString;
}

export interface DistrictStats {
  /** Issues not yet resolved. */
  activeIssues: number;
  /** Share of the district's issues forwarded to 311, 0–100; null when there are no issues. */
  responseRate311: number | null;
  /** Mean hours from report to first official reply; null when nothing was answered yet. */
  avgFirstResponseHours: number | null;
  /** Sum of residents' "it's fixed" confirmations. */
  confirmedResolutions: number;
}

export interface DistrictProfile {
  manager: Person;
  district: District;
  /** The manager's own district first, then every other claimed district. */
  territories: Territory[];
  stats: DistrictStats;
  issues: Issue[];
  /** Comments on this district's issues; stats are recomputed from them after status changes. */
  comments: IssueComment[];
  /** Latest official reply per issue id. */
  latestOfficialReply: Record<Id, OfficialReply>;
  /** Display handle of each issue's reporter, by issue id. */
  reporterUsername: Record<Id, string>;
}

const HOUR_MS = 60 * 60 * 1000;

const average = (values: number[]) =>
  values.length === 0 ? null : values.reduce((sum, v) => sum + v, 0) / values.length;

export const computeStats = (issues: Issue[], comments: IssueComment[]): DistrictStats => {
  const firstReplyHours = issues.flatMap((issue) => {
    const replies = comments
      .filter((c) => c.issue_id === issue.id && c.is_official_response)
      .map((c) => Date.parse(c.created_at));
    if (replies.length === 0) return [];
    return [(Math.min(...replies) - Date.parse(issue.created_at)) / HOUR_MS];
  });
  return {
    activeIssues: issues.filter((i) => i.status !== 'resolved').length,
    responseRate311:
      issues.length === 0
        ? null
        : Math.round((issues.filter((i) => i.external_311_ref).length / issues.length) * 100),
    avgFirstResponseHours: average(firstReplyHours),
    confirmedResolutions: issues.reduce((sum, i) => sum + i.resolution_confirmations, 0),
  };
};

/** Everything the profile page shows for one district manager, or null if they manage nothing. */
export const buildDistrictProfile = (
  username: string,
  data: ProfileData = EMPTY_PROFILE_DATA,
): DistrictProfile | null => {
  const manager = data.persons.find((p) => p.username === username);
  const district = manager && data.districts.find((d) => d.manager_id === manager.id);
  if (!manager || !district) return null;

  const usernameById = new Map(data.persons.map((p) => [p.id, p.username]));
  const issues = data.issues.filter((i) => i.district_id === district.id);
  const issueIds = new Set(issues.map((i) => i.id));
  const comments = data.comments.filter((c) => issueIds.has(c.issue_id));

  const latestOfficialReply: Record<Id, OfficialReply> = {};
  for (const c of comments) {
    if (!c.is_official_response) continue;
    const current = latestOfficialReply[c.issue_id];
    if (!current || c.created_at > current.createdAt) {
      latestOfficialReply[c.issue_id] = { body: c.body, createdAt: c.created_at };
    }
  }

  const reporterUsername: Record<Id, string> = {};
  for (const issue of issues) {
    reporterUsername[issue.id] =
      issue.author?.username ?? usernameById.get(issue.created_by_id) ?? '?';
  }

  const territories: Territory[] = [
    { district, managerUsername: manager.username, isOwn: true },
    ...data.districts
      .filter((d) => d.id !== district.id && d.is_claimed)
      .map((d) => ({
        district: d,
        managerUsername: d.manager_id ? (usernameById.get(d.manager_id) ?? null) : null,
        isOwn: false,
      })),
  ];

  return {
    manager,
    district,
    territories,
    stats: computeStats(issues, comments),
    issues,
    comments,
    latestOfficialReply,
    reporterUsername,
  };
};

/** Triage tabs, in display order. */
export const TRIAGE_STATUSES: readonly IssueStatus[] = ['not_started', 'in_progress', 'resolved'];

export interface ResidentProfile {
  person: Person;
  homeDistrict: District | null;
  /** Issues this person reported, newest first. */
  reports: Issue[];
  activity: {
    reports: number;
    upvotesGiven: number;
    confirmationsGiven: number;
    comments: number;
  };
}

/** A resident's own activity: what they reported, upvoted, confirmed and commented. */
export const buildResidentProfile = (
  username: string,
  data: ProfileData = EMPTY_PROFILE_DATA,
): ResidentProfile | null => {
  const person = findPerson(username, data);
  if (!person) return null;

  const reports = data.issues
    .filter((i) => i.created_by_id === person.id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const votes = data.votes.filter((v) => v.user_id === person.id);

  return {
    person,
    homeDistrict: data.districts.find((d) => d.id === person.home_district_id) ?? null,
    reports,
    activity: {
      reports: reports.length,
      upvotesGiven: votes.filter((v) => v.vote_type === 'upvote').length,
      confirmationsGiven: votes.filter((v) => v.vote_type === 'confirm_resolved').length,
      comments: data.comments.filter((c) => c.user_id === person.id).length,
    },
  };
};

export interface DistrictOverview {
  district: District;
  managerUsername: string | null;
  openIssues: number;
}

export interface AdminProfile {
  person: Person;
  districts: DistrictOverview[];
  totals: {
    districts: number;
    unclaimedDistricts: number;
    openIssues: number;
  };
  /** City-wide numbers, computed the same way as a district manager's board. */
  stats: DistrictStats;
}

/** An admin's city-wide view: every district, who manages it, and the overall numbers. */
export const buildAdminProfile = (
  username: string,
  data: ProfileData = EMPTY_PROFILE_DATA,
): AdminProfile | null => {
  const person = findPerson(username, data);
  if (!person) return null;

  const usernameById = new Map(data.persons.map((p) => [p.id, p.username]));
  const isOpen = (i: Issue) => i.status !== 'resolved';
  const districts = data.districts.map((district) => ({
    district,
    managerUsername: district.manager_id ? (usernameById.get(district.manager_id) ?? null) : null,
    openIssues: data.issues.filter((i) => i.district_id === district.id && isOpen(i)).length,
  }));

  return {
    person,
    districts,
    totals: {
      districts: districts.length,
      unclaimedDistricts: districts.filter((d) => !d.district.is_claimed).length,
      openIssues: data.issues.filter(isOpen).length,
    },
    stats: computeStats(data.issues, data.comments),
  };
};

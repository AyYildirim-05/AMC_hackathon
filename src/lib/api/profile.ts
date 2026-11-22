import { normalizeDistrict, normalizeIssue } from '@/components/utils/map-utils';
import { apiClient } from '@/lib/api/client';
import type { District, IssueComment, IssueVote, Person, ProfileData } from '@/lib/profile';

type ApiProfileResponse = {
  person: Record<string, unknown>;
  persons: Record<string, unknown>[];
  districts: Record<string, unknown>[];
  issues: Record<string, unknown>[];
  comments: Record<string, unknown>[];
  votes: Record<string, unknown>[];
};

function normalizePerson(raw: Record<string, unknown>): Person {
  const username = String(raw.username ?? '');
  return {
    id: String(raw.id ?? raw._id ?? ''),
    username,
    display_name: String(raw.display_name ?? raw.displayName ?? username),
    avatar_url: (raw.avatar_url ?? raw.avatarUrl ?? null) as string | null,
    email: String(raw.email ?? ''),
    postal_code: String(raw.postal_code ?? raw.postalCode ?? ''),
    home_district_id: String(raw.home_district_id ?? raw.homeDistrictId ?? ''),
    role: (raw.role as Person['role']) ?? 'resident',
    is_verified: Boolean(raw.is_verified ?? raw.isVerified ?? false),
    is_active_post: Boolean(raw.is_active_post ?? raw.isActivePost ?? false),
    preferred_language: (raw.preferred_language ?? raw.preferredLanguage ?? 'fr') as 'fr' | 'en',
  };
}

function normalizeProfileDistrict(raw: Record<string, unknown>): District {
  const d = normalizeDistrict(raw);
  return {
    id: d.id,
    name_fr: d.name_fr,
    name_en: d.name_en,
    open_north_slug: d.open_north_slug,
    district_type: d.district_type === 'municipality' ? 'municipality' : 'borough',
    manager_id: d.manager_id,
    is_claimed: d.is_claimed,
  };
}

function normalizeProfileComment(raw: Record<string, unknown>): IssueComment {
  return {
    id: String(raw.id ?? raw._id ?? ''),
    issue_id: String(raw.issue_id ?? raw.issueId ?? ''),
    user_id: String(raw.user_id ?? raw.userId ?? ''),
    body: String(raw.body ?? ''),
    is_official_response: Boolean(raw.is_official_response ?? raw.isOfficialResponse ?? false),
    created_at: String(raw.created_at ?? raw.createdAt ?? ''),
  };
}

function normalizeProfileVote(raw: Record<string, unknown>): IssueVote {
  return {
    id: String(raw.id ?? raw._id ?? ''),
    issue_id: String(raw.issue_id ?? raw.issueId ?? ''),
    user_id: String(raw.user_id ?? raw.userId ?? ''),
    vote_type: (raw.vote_type ?? raw.voteType ?? 'upvote') as IssueVote['vote_type'],
    created_at: String(raw.created_at ?? raw.createdAt ?? ''),
  };
}

export async function fetchMyProfile(): Promise<ProfileData> {
  const { data } = await apiClient.get<ApiProfileResponse>('/api/profile/me');
  return {
    persons: Array.isArray(data.persons) ? data.persons.map(normalizePerson) : [],
    districts: Array.isArray(data.districts) ? data.districts.map(normalizeProfileDistrict) : [],
    issues: Array.isArray(data.issues) ? data.issues.map(normalizeIssue) : [],
    comments: Array.isArray(data.comments) ? data.comments.map(normalizeProfileComment) : [],
    votes: Array.isArray(data.votes) ? data.votes.map(normalizeProfileVote) : [],
  };
}

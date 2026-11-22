import { normalizeIssue } from '@/components/utils/map-utils';
import { apiClient } from '@/lib/api/client';
import type { Issue, IssueCategory, IssueStatus, WeatherElement } from '@/models/Issue';

export type CreateIssuePayload = {
  title: string;
  description: string;
  category: IssueCategory;
  elements?: WeatherElement[];
  address: string;
  latitude: number;
  longitude: number;
  districtId: string;
  images?: string[];
  external311Ref?: string | null;
};

export type ApiIssueComment = {
  id: string;
  issueId: string;
  userId: string;
  body: string;
  images: string[];
  isOfficialResponse: boolean;
  createdAt: string;
  updatedAt: string;
  author: {
    username: string;
    displayName: string;
    avatarUrl: string | null;
    role: 'resident' | 'district_manager' | 'admin';
  } | null;
};

export type MyVotesResponse = {
  upvotedIssueIds: string[];
  confirmedIssueIds: string[];
};

export type ToggleVoteResponse = {
  issueId: string;
  voteType: 'upvote' | 'confirm_resolved';
  active: boolean;
  upvoteCount: number;
  resolutionConfirmations: number;
};

export async function fetchIssues(): Promise<Issue[]> {
  const { data } = await apiClient.get<Record<string, unknown>[]>('/api/issues');
  return Array.isArray(data) ? data.map(normalizeIssue) : [];
}

export async function fetchIssuesByDistrict(districtId: string): Promise<Issue[]> {
  const { data } = await apiClient.get<Record<string, unknown>[]>(
    `/api/issues/district/${encodeURIComponent(districtId)}`,
  );
  return Array.isArray(data) ? data.map(normalizeIssue) : [];
}

export async function fetchIssueById(id: string): Promise<Issue> {
  const { data } = await apiClient.get<Record<string, unknown>>(
    `/api/issues/${encodeURIComponent(id)}`,
  );
  return normalizeIssue(data);
}

export async function createIssue(payload: CreateIssuePayload): Promise<Issue> {
  const { data } = await apiClient.post<Record<string, unknown>>('/api/issues', payload);
  return normalizeIssue(data);
}

export async function updateIssueStatus(issueId: string, status: IssueStatus): Promise<Issue> {
  const { data } = await apiClient.patch<Record<string, unknown>>(
    `/api/issues/${encodeURIComponent(issueId)}/status`,
    { status },
  );
  return normalizeIssue(data);
}

export async function fetchIssueComments(issueId: string): Promise<ApiIssueComment[]> {
  const { data } = await apiClient.get<ApiIssueComment[]>(
    `/api/issues/${encodeURIComponent(issueId)}/comments`,
  );
  return Array.isArray(data) ? data : [];
}

export async function createIssueComment(
  issueId: string,
  body: string,
  isOfficialResponse = false,
  images: string[] = [],
): Promise<ApiIssueComment> {
  const { data } = await apiClient.post<ApiIssueComment>(
    `/api/issues/${encodeURIComponent(issueId)}/comments`,
    { body, isOfficialResponse, images },
  );
  return data;
}

export async function fetchMyVotes(): Promise<MyVotesResponse> {
  const { data } = await apiClient.get<MyVotesResponse>('/api/issues/votes/me');
  return {
    upvotedIssueIds: Array.isArray(data?.upvotedIssueIds) ? data.upvotedIssueIds : [],
    confirmedIssueIds: Array.isArray(data?.confirmedIssueIds) ? data.confirmedIssueIds : [],
  };
}

export async function toggleIssueVote(
  issueId: string,
  voteType: 'upvote' | 'confirm_resolved',
): Promise<ToggleVoteResponse> {
  const { data } = await apiClient.post<ToggleVoteResponse>(
    `/api/issues/${encodeURIComponent(issueId)}/votes`,
    { voteType },
  );
  return data;
}

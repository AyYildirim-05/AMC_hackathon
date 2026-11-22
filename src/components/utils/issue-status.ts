import type { IssueStatus } from '@/models/Issue';

/** Dot and marker color per issue status; the same values as IssueCard's status badge dots. */
export const ISSUE_STATUS_COLORS: Record<IssueStatus, string> = {
  not_started: '#64748B',
  in_progress: '#D97706',
  resolved: '#16A34A',
};

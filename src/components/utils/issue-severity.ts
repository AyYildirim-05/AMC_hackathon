import { type ThemeColors } from '@/components/utils/issue-status';
import { type Issue, type IssueUrgency, severityScoreToUrgency } from '@/models/Issue';

export interface SeverityBadgePalette {
  icon: string;
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  accentBorderColor: string;
}

export function getIssueUrgency(
  issue: Pick<Issue, 'severity_score' | 'urgency'>,
): IssueUrgency | null {
  if (issue.urgency) return issue.urgency;
  if (typeof issue.severity_score === 'number' && Number.isFinite(issue.severity_score)) {
    return severityScoreToUrgency(issue.severity_score);
  }
  return null;
}

/** Badge colors per urgency, from the theme (accent for the urgent ones, neutral for low). */
export function getSeverityBadgePalette(
  urgency: IssueUrgency,
  theme: ThemeColors,
): SeverityBadgePalette {
  switch (urgency) {
    case 'high':
      return {
        icon: '🚨',
        backgroundColor: theme.accent100,
        borderColor: theme.accent300,
        textColor: theme.accent700,
        accentBorderColor: theme.accent500,
      };
    case 'medium':
      return {
        icon: '⚠️',
        backgroundColor: theme.neutral100,
        borderColor: theme.accent200,
        textColor: theme.accent600,
        accentBorderColor: theme.accent400,
      };
    case 'low':
      return {
        icon: '🟢',
        backgroundColor: theme.neutral100,
        borderColor: theme.neutral300,
        textColor: theme.neutral700,
        accentBorderColor: theme.neutral500,
      };
  }
}

/**
 * Sorts issues for the borough manager's triage queue: highest AI severity score first
 * (urgent safety hazards at the top), then newest reports first for equal scores.
 */
export function compareIssuesBySeverityDesc(a: Issue, b: Issue): number {
  const scoreA = typeof a.severity_score === 'number' ? a.severity_score : -1;
  const scoreB = typeof b.severity_score === 'number' ? b.severity_score : -1;
  if (scoreB !== scoreA) return scoreB - scoreA;
  return b.created_at.localeCompare(a.created_at);
}

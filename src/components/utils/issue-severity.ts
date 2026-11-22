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

export function getSeverityBadgePalette(
  urgency: IssueUrgency,
  isDark: boolean,
): SeverityBadgePalette {
  switch (urgency) {
    case 'high':
      return {
        icon: '🚨',
        backgroundColor: isDark ? '#3B181B' : '#FEF2F2',
        borderColor: isDark ? '#7F2329' : '#FECACA',
        textColor: isDark ? '#FCA5A5' : '#B91C1C',
        accentBorderColor: isDark ? '#EF4444' : '#DC2626',
      };
    case 'medium':
      return {
        icon: '⚠️',
        backgroundColor: isDark ? '#382B14' : '#FFFBEB',
        borderColor: isDark ? '#785A1F' : '#FDE68A',
        textColor: isDark ? '#FCD34D' : '#B45309',
        accentBorderColor: isDark ? '#F59E0B' : '#D97706',
      };
    case 'low':
      return {
        icon: '🟢',
        backgroundColor: isDark ? '#183326' : '#ECFDF5',
        borderColor: isDark ? '#2B5B44' : '#A7F3D0',
        textColor: isDark ? '#6EE7B7' : '#047857',
        accentBorderColor: isDark ? '#10B981' : '#059669',
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

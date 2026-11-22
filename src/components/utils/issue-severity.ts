import { type ThemeColors } from '@/components/utils/issue-status';
import { type Issue, type IssueUrgency, severityScoreToUrgency } from '@/models/Issue';

export interface SeverityBadgePalette {
  icon: string;
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  accentBorderColor: string;
}

export interface ResolvedIssueSeverity {
  score: number;
  urgency: IssueUrgency;
}

/**
 * Deterministic client fallback for legacy issues saved before AI severity scoring was added,
 * matching the server's fallback rubric. Whenever the backend provides `severity_score`, that
 * Gemini score is always used directly.
 */
export function estimateIssueSeverity(
  issue: Partial<Pick<Issue, 'title' | 'description' | 'category' | 'elements'>>,
): ResolvedIssueSeverity {
  const text = `${issue.title ?? ''} ${issue.description ?? ''}`.toLowerCase();
  let score = 5;

  if (
    /\b(downed|live wire|power line|exposed wire|sinkhole|collapse|collapsed|fire|gas leak|flooded|flooding|electr|fil électrique|effondr|fuite de gaz|inond|danger mortel|urgent)\b/i.test(
      text,
    )
  ) {
    score = 9;
  } else if (
    /\b(blocked|blocking|obstruct|barriers?|broken glass|fallen tree|no light|traffic light|signal out|bloqué|obstru|barrière|clôture|arbre tombé|feu de circulation|dangereux|dangerous)\b/i.test(
      text,
    )
  ) {
    score = 8;
  } else if (
    /\b(pothole|nid-de-poule|sunken|manhole|elevator|ascenseur|streetlight|lampadaire|light|éclair|sidewalk|trottoir|crack|fissur)\b/i.test(
      text,
    )
  ) {
    score = 6;
  } else if (
    /\b(graffiti|litter|trash|déchet|peinture|faded|bench|banc|weed|herbe)\b/i.test(text)
  ) {
    score = 2;
  } else if (issue.category === 'traffic_safety') {
    score = 7;
  } else if (issue.category === 'streetlights_utilities') {
    score = 6;
  }

  if (
    issue.elements &&
    (issue.elements.includes('freezing_rain') ||
      issue.elements.includes('high_wind') ||
      issue.elements.includes('rain_flooding'))
  ) {
    score = Math.min(10, score + 1);
  }

  return { score, urgency: severityScoreToUrgency(score) };
}

/**
 * Always returns a 1–10 severity score and urgency level for an issue: uses the server/Gemini
 * `severity_score` when present, and falls back to `estimateIssueSeverity` for legacy records.
 */
export function getIssueSeverity(
  issue: Partial<
    Pick<Issue, 'severity_score' | 'urgency' | 'title' | 'description' | 'category' | 'elements'>
  >,
): ResolvedIssueSeverity {
  if (typeof issue.severity_score === 'number' && Number.isFinite(issue.severity_score)) {
    const score = Math.min(10, Math.max(1, Math.round(issue.severity_score)));
    return {
      score,
      urgency: issue.urgency ?? severityScoreToUrgency(score),
    };
  }
  return estimateIssueSeverity(issue);
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

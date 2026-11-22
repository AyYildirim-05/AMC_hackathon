import { useMemo } from 'react';

import type { Colors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { IssueStatus } from '@/models/Issue';

export type ThemeColors = (typeof Colors)['light'] | (typeof Colors)['dark'];

/**
 * Marker and dot color per issue status, from the app theme only: to do = danger,
 * in progress = tint, resolved = success. Every map marker, legend and status dot uses these.
 */
export function issueStatusColors(theme: ThemeColors): Record<IssueStatus, string> {
  return {
    not_started: theme.danger,
    in_progress: theme.tint,
    resolved: theme.success,
  };
}

/** `issueStatusColors` for the current light/dark mode; stable until the mode changes. */
export function useIssueStatusColors(): Record<IssueStatus, string> {
  const theme = useTheme();
  return useMemo(() => issueStatusColors(theme), [theme]);
}

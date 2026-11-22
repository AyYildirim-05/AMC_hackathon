import { useMemo } from 'react';

import { useTheme } from '@/hooks/use-theme';

export type Theme = ReturnType<typeof useTheme>;

/**
 * Styles built from the current theme: pass a module-level `(theme) => StyleSheet.create({...})`.
 * They are rebuilt only when the theme (light/dark mode) changes.
 */
export function useThemedStyles<T>(createStyles: (theme: Theme) => T): T {
  const theme = useTheme();
  return useMemo(() => createStyles(theme), [createStyles, theme]);
}

import { type ReactNode } from 'react';
import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/utils/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type PillTone = 'neutral' | 'accent' | 'inverse' | 'outline';

export type PillProps = {
  children: ReactNode;
  tone?: PillTone;
  /** Shows a leading status dot in the text color. */
  dot?: boolean;
  /** Monospace text, for codes such as 311 references. */
  mono?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Small rounded label: statuses, tags, counts. */
export function Pill({ children, tone = 'neutral', dot, mono, style }: PillProps) {
  const theme = useTheme();
  const colors = {
    neutral: { background: theme.backgroundSelected, text: theme.text, border: 'transparent' },
    accent: { background: theme.accent, text: theme.buttonText, border: 'transparent' },
    // On an accent-colored surface: a light pill with accent text.
    inverse: { background: theme.buttonText, text: theme.accent, border: 'transparent' },
    outline: { background: 'transparent', text: theme.text, border: theme.border },
  }[tone];

  return (
    <View
      style={[
        styles.pill,
        { backgroundColor: colors.background, borderColor: colors.border },
        style,
      ]}
    >
      {dot && <View style={[styles.dot, { backgroundColor: colors.text }]} />}
      <ThemedText
        type={mono ? 'code' : 'miniText'}
        weight="semibold"
        style={{ color: colors.text }}
        numberOfLines={1}
      >
        {children}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: 999,
    borderWidth: 1,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
});

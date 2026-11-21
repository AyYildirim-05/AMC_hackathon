import { type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';

export type TabScreenProps = {
  title: string;
  /** Screen content. Without it, a centered placeholder message is shown. */
  children?: ReactNode;
  placeholder?: string;
};

/** Shared frame for the top-level tabs: safe area, title, and room for the tab bar. */
export function TabScreen({ title, children, placeholder }: TabScreenProps) {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ThemedText type="subtitle" style={styles.title}>
          {title}
        </ThemedText>
        {children ?? (
          <ThemedView style={styles.placeholder} align="center" justify="center">
            <ThemedText themeColor="textSecondary">{placeholder}</ThemedText>
          </ThemedView>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
  },
  safeArea: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingBottom: BottomTabInset,
  },
  title: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
  },
  placeholder: {
    flex: 1,
  },
});

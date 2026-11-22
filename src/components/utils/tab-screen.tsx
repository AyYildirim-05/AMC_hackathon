import { type ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/utils/app-header';
import { ThemedText } from '@/components/utils/themed-text';
import { ThemedView } from '@/components/utils/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';

export type TabScreenProps = {
  title: string;
  /** Screen content. Without it, a centered placeholder message is shown. */
  children?: ReactNode;
  placeholder?: string;
  /** Show the app header (district, role, avatar) at the top. Default true. */
  showAppHeader?: boolean;
  /** Show the title under the header. Default true. */
  showTitle?: boolean;
};

/** Shared frame for the top-level tabs: safe area, title, and room for the tab bar. */
export function TabScreen({
  title,
  children,
  placeholder,
  showAppHeader = true,
  showTitle = true,
}: TabScreenProps) {
  // iOS reports the floating native tab bar inside the bottom safe-area inset (about 97pt on an
  // iPhone 18 Pro: the bar plus the home indicator), so that inset alone keeps content above it.
  // Android keeps the starter's fixed inset (not measured).
  const { bottom } = useSafeAreaInsets();
  const bottomInset = Platform.OS === 'ios' ? bottom : BottomTabInset;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView
        style={[styles.safeArea, { paddingBottom: bottomInset }]}
        edges={['top', 'left', 'right']}
      >
        {showAppHeader ? <AppHeader /> : null}
        {showTitle ? (
          <View style={styles.header}>
            <ThemedText type="subtitle" style={styles.title}>
              {title}
            </ThemedText>
          </View>
        ) : null}
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
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
    gap: Spacing.two,
  },
  title: {
    flexShrink: 1,
  },
  placeholder: {
    flex: 1,
  },
});

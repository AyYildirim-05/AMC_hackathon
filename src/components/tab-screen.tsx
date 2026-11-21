import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedButton } from '@/components/themed-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/providers/auth-provider';

export type TabScreenProps = {
  title: string;
  /** Screen content. Without it, a centered placeholder message is shown. */
  children?: ReactNode;
  placeholder?: string;
};

/** Shared frame for the top-level tabs: safe area, title, and room for the tab bar. */
export function TabScreen({ title, children, placeholder }: TabScreenProps) {
  const { t } = useTranslation();
  const { signOut } = useAuth();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <ThemedText type="subtitle" style={styles.title}>
            {title}
          </ThemedText>
          <ThemedButton type="text" tone="danger" size="small" onPress={() => void signOut()}>
            {t('auth.signOutButton')}
          </ThemedButton>
        </View>
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

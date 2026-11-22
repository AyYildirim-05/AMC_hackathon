import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppHeader } from '@/components/utils/app-header';
import { ThemedCard } from '@/components/utils/themed-card';
import { ThemedText } from '@/components/utils/themed-text';
import { Spacing } from '@/constants/theme';
import { useCurrentUser } from '@/hooks/use-current-user';
import { fetchMyProfile } from '@/lib/api/profile';

/**
 * Top of the Home feed: the app header (district, role, avatar) and a greeting with the user's
 * name. The display name comes from the profile (same query as the profile page, so it is fetched
 * once); until it loads, the username stands in.
 */
export function WelcomeCard() {
  const { t } = useTranslation();
  const user = useCurrentUser();
  const { data: profile } = useQuery({
    queryKey: ['profile', 'me', user?.id],
    queryFn: fetchMyProfile,
    enabled: Boolean(user),
  });

  const person = profile?.persons.find((p) => p.username === user?.username);
  const name = person?.display_name || user?.username || '';

  return (
    <ThemedCard testID="welcome-card" variant="filled" padding="none" style={styles.card}>
      <AppHeader />
      {user ? (
        <View style={styles.greeting}>
          <ThemedText testID="welcome-name" type="h3" numberOfLines={1}>
            {t('feed.greeting', { name })}
          </ThemedText>
          {name !== user.username ? (
            <ThemedText type="caption" tone="secondary">
              @{user.username}
            </ThemedText>
          ) : null}
        </View>
      ) : null}
    </ThemedCard>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: Spacing.three, marginTop: Spacing.two },
  greeting: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
    gap: Spacing.half,
  },
});

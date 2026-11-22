import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { IssueCard } from '@/components/layout/IssueCard';
import { Section, StatGrid, StatTile } from '@/components/utils/profile-parts';
import { ThemedText } from '@/components/utils/themed-text';
import { Spacing } from '@/constants/theme';
import type { ResidentProfile as Profile } from '@/lib/profile';

/** A resident's part of a profile: their activity numbers and the issues they reported. */
export function ResidentProfile({ profile }: { profile: Profile }) {
  const { t } = useTranslation();
  const { activity } = profile;

  return (
    <View style={styles.page}>
      <Section title={t('profile.resident.activity')}>
        <StatGrid>
          <StatTile
            icon="report"
            value={String(activity.reports)}
            label={t('profile.resident.reports', { count: activity.reports })}
          />
          <StatTile
            icon="thumbUp"
            value={String(activity.upvotesGiven)}
            label={t('profile.resident.upvotes', { count: activity.upvotesGiven })}
          />
          <StatTile
            icon="verified"
            value={String(activity.confirmationsGiven)}
            label={t('profile.resident.confirmations', { count: activity.confirmationsGiven })}
          />
          <StatTile
            icon="comment"
            value={String(activity.comments)}
            label={t('profile.resident.comments', { count: activity.comments })}
          />
        </StatGrid>
      </Section>

      <Section
        title={t('profile.resident.myReports')}
        aside={t('profile.triage.count', { count: profile.reports.length })}
      >
        {profile.reports.length === 0 ? (
          <ThemedText type="small" tone="secondary">
            {t('profile.resident.noReports')}
          </ThemedText>
        ) : (
          profile.reports.map((issue) => <IssueCard key={issue.id} issue={issue} collapsible />)
        )}
      </Section>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: Spacing.four },
});

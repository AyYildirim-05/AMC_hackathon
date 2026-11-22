import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Pill } from '@/components/utils/pill';
import { districtName, Section, StatGrid, StatTile } from '@/components/utils/profile-parts';
import { ThemedCard } from '@/components/utils/themed-card';
import { ThemedText } from '@/components/utils/themed-text';
import { Spacing } from '@/constants/theme';
import type { AdminProfile as Profile } from '@/lib/profile';

/** An admin's part of a profile: city-wide numbers and every district with its manager. */
export function AdminProfile({ profile }: { profile: Profile }) {
  const { t, i18n } = useTranslation();
  const { totals, stats } = profile;

  return (
    <View style={styles.page}>
      <Section title={t('profile.admin.overview')}>
        <StatGrid>
          <StatTile
            icon="city"
            value={String(totals.districts)}
            label={t('profile.admin.districts', { count: totals.districts })}
          />
          <StatTile
            icon="flag"
            value={String(totals.unclaimedDistricts)}
            label={t('profile.admin.unclaimedDistricts', { count: totals.unclaimedDistricts })}
          />
          <StatTile
            icon="warning"
            value={String(totals.openIssues)}
            label={t('profile.admin.openIssues', { count: totals.openIssues })}
          />
          <StatTile
            icon="percent"
            value={stats.responseRate311 === null ? '—' : `${stats.responseRate311}%`}
            label={t('profile.stats.responseRate')}
            tag="311"
          />
        </StatGrid>
      </Section>

      <Section title={t('profile.admin.allDistricts')}>
        {profile.districts.map(({ district, managerUsername, openIssues }) => (
          <ThemedCard key={district.id} variant="outlined" padding="medium">
            <View style={styles.districtRow}>
              <View style={styles.flex}>
                <ThemedText type="smallBold" numberOfLines={1}>
                  {districtName(district, i18n.language)}
                </ThemedText>
                <ThemedText type="caption" tone="secondary">
                  {managerUsername
                    ? t('profile.admin.managedBy', { username: managerUsername })
                    : t('profile.admin.noManager')}
                </ThemedText>
              </View>
              <Pill tone={district.is_claimed ? 'neutral' : 'outline'}>
                {district.is_claimed ? t('profile.claimed') : t('profile.admin.unclaimed')}
              </Pill>
            </View>
            <ThemedText type="caption" tone="secondary">
              {t('profile.admin.openIssues', { count: openIssues })}: {openIssues}
            </ThemedText>
          </ThemedCard>
        ))}
      </Section>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: Spacing.four },
  flex: { flex: 1 },
  districtRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
});

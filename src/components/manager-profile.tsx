import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ThemedButton } from '@/components/themed-button';
import { ThemedCard } from '@/components/themed-card';
import { districtName as nameOf, Section, StatGrid, StatTile } from '@/components/profile-parts';
import { ThemedText } from '@/components/themed-text';
import { TriageIssueCard } from '@/components/triage-issue-card';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { computeStats, type DistrictProfile, TRIAGE_STATUSES } from '@/lib/profile';
import type { Id, IssueStatus } from '@/models/Issue';

export type ManagerProfileProps = {
  profile: DistrictProfile;
  onUpdateStatus?: (issueId: Id, status: IssueStatus) => void;
};

/** The district manager's part of a profile: territories, operations board, triage, OpenNorth. */
export function ManagerProfile({ profile, onUpdateStatus }: ManagerProfileProps) {
  const { t, i18n } = useTranslation();
  // Status changes stay on this screen until the issues API is wired in.
  const [statusOverrides, setStatusOverrides] = useState<Record<Id, IssueStatus>>({});

  const issues = useMemo(
    () => profile.issues.map((i) => ({ ...i, status: statusOverrides[i.id] ?? i.status })),
    [profile.issues, statusOverrides],
  );
  const stats = useMemo(() => computeStats(issues, profile.comments), [issues, profile.comments]);
  const firstWithIssues = TRIAGE_STATUSES.find((s) => issues.some((i) => i.status === s));
  const [triageTab, setTriageTab] = useState<IssueStatus>(firstWithIssues ?? 'not_started');

  const districtName = nameOf(profile.district, i18n.language);
  const queue = issues.filter((i) => i.status === triageTab);

  return (
    <View style={styles.page}>
      <Section title={t('profile.territories.title')} aside={t('profile.territories.metroView')}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.row}
        >
          {profile.territories.map((territory) => (
            <TerritoryChip
              key={territory.district.id}
              name={nameOf(territory.district, i18n.language)}
              detail={
                territory.isOwn
                  ? t('profile.territories.primary')
                  : territory.managerUsername
                    ? `@${territory.managerUsername}`
                    : ''
              }
              selected={territory.isOwn}
            />
          ))}
        </ScrollView>
      </Section>

      <Section title={t('profile.stats.title')} aside={`● ${t('profile.stats.live')}`}>
        <StatGrid>
          <StatTile
            value={String(stats.activeIssues)}
            label={t('profile.stats.activeIssues', { count: stats.activeIssues })}
          />
          <StatTile
            value={stats.responseRate311 === null ? '—' : `${stats.responseRate311}%`}
            label={t('profile.stats.responseRate')}
            tag="311"
          />
          <StatTile
            value={
              stats.avgFirstResponseHours === null
                ? '—'
                : t('profile.stats.hours', { value: stats.avgFirstResponseHours.toFixed(1) })
            }
            label={t('profile.stats.responseTime')}
            tag={t('profile.stats.target')}
          />
          <StatTile
            value={String(stats.confirmedResolutions)}
            label={t('profile.stats.confirmed', { count: stats.confirmedResolutions })}
            tag={t('profile.stats.citizens')}
          />
        </StatGrid>
      </Section>

      <Section
        title={t('profile.triage.title')}
        aside={t('profile.triage.count', { count: issues.length })}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.row}
        >
          {TRIAGE_STATUSES.map((status) => (
            <ThemedButton
              key={status}
              size="small"
              rounded
              type={status === triageTab ? 'primary' : 'border'}
              accessibilityState={{ selected: status === triageTab }}
              onPress={() => setTriageTab(status)}
            >
              {t('profile.triage.tab', {
                label: t(`profile.triage.status.${status}`),
                count: issues.filter((i) => i.status === status).length,
              })}
            </ThemedButton>
          ))}
        </ScrollView>
        {queue.length === 0 ? (
          <ThemedText type="small" tone="secondary">
            {t('profile.triage.empty')}
          </ThemedText>
        ) : (
          queue.map((issue) => (
            <TriageIssueCard
              key={issue.id}
              issue={issue}
              reporterUsername={profile.reporterUsername[issue.id]}
              latestReply={profile.latestOfficialReply[issue.id]}
              districtName={districtName}
              onStatusChange={(status) => {
                setStatusOverrides((current) => ({ ...current, [issue.id]: status }));
                onUpdateStatus?.(issue.id, status);
              }}
            />
          ))
        )}
      </Section>

      <OpenNorthCard slug={profile.district.open_north_slug} />
    </View>
  );
}

function TerritoryChip({
  name,
  detail,
  selected,
}: {
  name: string;
  detail: string;
  selected: boolean;
}) {
  const theme = useTheme();
  const textColor = { color: selected ? theme.buttonText : theme.text };

  return (
    <View
      accessibilityState={{ selected }}
      style={[
        styles.territory,
        selected
          ? { backgroundColor: theme.accent, borderColor: theme.accent }
          : { borderColor: theme.border },
      ]}
    >
      <ThemedText type="smallBold" numberOfLines={1} style={textColor}>
        {name}
      </ThemedText>
      {detail ? (
        <ThemedText type="caption" numberOfLines={1} style={textColor}>
          {detail}
        </ThemedText>
      ) : null}
    </View>
  );
}

function OpenNorthCard({ slug }: { slug: string }) {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <ThemedCard variant="filled">
      <View>
        <ThemedText type="cardTitle">{t('profile.openNorth.title')}</ThemedText>
        <ThemedText type="small" tone="secondary">
          {t('profile.openNorth.subtitle')}
        </ThemedText>
      </View>
      <View style={[styles.table, { backgroundColor: theme.background }]}>
        <View style={styles.tableRow}>
          <ThemedText type="small" style={styles.flex}>
            {t('profile.openNorth.slug')}
          </ThemedText>
          <ThemedText type="code" style={styles.flex}>
            {slug}
          </ThemedText>
        </View>
        <View style={styles.tableRow}>
          <ThemedText type="small" style={styles.flex}>
            {t('profile.openNorth.lastSurvey')}
          </ThemedText>
          <ThemedText type="small" style={styles.flex}>
            {t('profile.openNorth.automatic')}
          </ThemedText>
        </View>
      </View>
      {/* Disabled until boundary management and 311 history exist. */}
      <View style={styles.actionRow}>
        <ThemedButton type="border" style={styles.action} disabled>
          {t('profile.openNorth.manageBoundaries')}
        </ThemedButton>
        <ThemedButton type="border" style={styles.action} disabled>
          {t('profile.openNorth.history311')}
        </ThemedButton>
      </View>
    </ThemedCard>
  );
}

const styles = StyleSheet.create({
  page: { gap: Spacing.four },
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: Spacing.two },
  territory: {
    minWidth: 180,
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  table: { borderRadius: Spacing.two, padding: Spacing.three, gap: Spacing.two },
  tableRow: { flexDirection: 'row', gap: Spacing.two },
  // Side by side when both labels fit, otherwise stacked, so neither label is truncated.
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  action: { flexGrow: 1, flexBasis: 200 },
});

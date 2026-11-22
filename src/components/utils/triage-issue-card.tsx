import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { formatAddress } from '@/components/utils/formatter';
import { Pill } from '@/components/utils/pill';
import { ThemedButton } from '@/components/utils/themed-button';
import { ThemedCard } from '@/components/utils/themed-card';
import { ThemedText } from '@/components/utils/themed-text';
import { WEATHER_ELEMENT_META } from '@/components/utils/weather-elements';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { type OfficialReply, TRIAGE_STATUSES } from '@/lib/profile';
import { ISSUE_STATUS_COLORS } from '@/components/utils/issue-status';
import type { Issue, IssueStatus } from '@/models/Issue';

export type TriageIssueCardProps = {
  issue: Issue;
  reporterUsername: string;
  latestReply?: OfficialReply;
  /** District name shown in the official-response heading. */
  districtName: string;
  onStatusChange: (status: IssueStatus) => void;
  // Actions without a handler render disabled: the backend flows don't exist yet.
  onPublishResponse?: () => void;
  onAssignLocal?: () => void;
  onLink311?: () => void;
};

/** A district manager's view of one issue: details, intervention status and actions. */
export function TriageIssueCard({
  issue,
  reporterUsername,
  latestReply,
  districtName,
  onStatusChange,
  onPublishResponse,
  onAssignLocal,
  onLink311,
}: TriageIssueCardProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const [statusOpen, setStatusOpen] = useState(false);
  const statusLabel = t(`profile.triage.status.${issue.status}`);

  const chooseStatus = (status: IssueStatus) => {
    setStatusOpen(false);
    if (status !== issue.status) onStatusChange(status);
  };

  return (
    <ThemedCard variant="outlined">
      <View style={styles.tagRow}>
        <Pill tone="accent">{t(`issue.category.${issue.category}`)}</Pill>
        {issue.external_311_ref && (
          <Pill tone="outline" mono>
            {issue.external_311_ref}
          </Pill>
        )}
        {(issue.elements ?? []).map((el) => {
          const meta = WEATHER_ELEMENT_META[el];
          return (
            <Pill key={el} tone="outline">
              {`${meta.icon} ${t(`issue.elements.${el}`, { defaultValue: meta.fallbackLabel })}`}
            </Pill>
          );
        })}
      </View>

      <View style={styles.section}>
        <ThemedText type="cardTitle">{issue.title}</ThemedText>
        <ThemedText type="small" tone="secondary" numberOfLines={2}>
          {issue.description}
        </ThemedText>
      </View>

      <View style={[styles.box, { borderColor: theme.border }]}>
        <View style={styles.flex}>
          <ThemedText type="smallBold" numberOfLines={1}>
            {formatAddress(issue.address)}
          </ThemedText>
          <ThemedText type="caption" tone="secondary">
            {t('profile.triage.reportedBy', { username: reporterUsername })} •{' '}
            {t('profile.triage.supports', { count: issue.upvote_count })}
          </ThemedText>
        </View>
        {issue.resolution_confirmations > 0 && (
          <Pill tone="accent">
            {t('profile.triage.confirmations', { count: issue.resolution_confirmations })}
          </Pill>
        )}
      </View>

      <View style={styles.section}>
        <ThemedText type="overline">{t('profile.triage.interventionStatus')}</ThemedText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('profile.triage.changeStatus', { status: statusLabel })}
          accessibilityState={{ expanded: statusOpen }}
          onPress={() => setStatusOpen((open) => !open)}
          style={[
            styles.select,
            { borderColor: theme.border, backgroundColor: theme.backgroundElement },
          ]}
        >
          <View style={[styles.dot, { backgroundColor: ISSUE_STATUS_COLORS[issue.status] }]} />
          <ThemedText type="smallBold" style={styles.flex}>
            {statusLabel}
          </ThemedText>
          <ThemedText type="small">{statusOpen ? '▴' : '▾'}</ThemedText>
        </Pressable>
        {statusOpen && (
          <View
            accessibilityRole="radiogroup"
            style={[styles.options, { borderColor: theme.border }]}
          >
            {TRIAGE_STATUSES.map((status) => (
              <Pressable
                key={status}
                accessibilityRole="radio"
                accessibilityState={{ checked: status === issue.status }}
                onPress={() => chooseStatus(status)}
                style={styles.option}
              >
                <View style={[styles.dot, { backgroundColor: ISSUE_STATUS_COLORS[status] }]} />
                <ThemedText type={status === issue.status ? 'smallBold' : 'small'}>
                  {t(`profile.triage.status.${status}`)}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      <View style={[styles.box, styles.replyBox, { backgroundColor: theme.backgroundElement }]}>
        <View style={styles.replyHeader}>
          <ThemedText type="smallBold" style={styles.flex}>
            {t('profile.triage.lastResponse', { district: districtName })}
          </ThemedText>
          {latestReply && (
            <ThemedText type="caption" tone="secondary">
              {formatReplyTime(latestReply.createdAt, i18n.language)}
            </ThemedText>
          )}
        </View>
        <ThemedText type="caption" tone="secondary" style={styles.quote}>
          {latestReply ? `« ${latestReply.body} »` : t('profile.triage.noResponse')}
        </ThemedText>
      </View>

      <ThemedButton fullWidth disabled={!onPublishResponse} onPress={onPublishResponse}>
        {t('profile.triage.publish')}
      </ThemedButton>
      <View style={styles.actionRow}>
        <ThemedButton
          type="secondary"
          style={styles.action}
          disabled={!onAssignLocal}
          onPress={onAssignLocal}
        >
          {t('profile.triage.assign')}
        </ThemedButton>
        <ThemedButton type="border" style={styles.action} disabled={!onLink311} onPress={onLink311}>
          {t('profile.triage.link311')}
        </ThemedButton>
      </View>
    </ThemedCard>
  );
}

/** Day and time of a reply in the reader's locale and time zone, e.g. "18 nov., 06 h 42". */
const formatReplyTime = (iso: string, locale: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleString(locale, {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  section: { gap: Spacing.two },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    borderWidth: 1,
    borderRadius: Spacing.three,
  },
  replyBox: { flexDirection: 'column', alignItems: 'stretch', borderWidth: 0 },
  replyHeader: { flexDirection: 'row', gap: Spacing.two },
  quote: { fontStyle: 'italic' },
  select: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    borderWidth: 1,
    borderRadius: Spacing.three,
  },
  options: { borderWidth: 1, borderRadius: Spacing.three, overflow: 'hidden' },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  // Side by side when both labels fit, otherwise stacked, so neither label is truncated.
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  action: { flexGrow: 1, flexBasis: 200 },
});

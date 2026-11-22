import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { IssueCard } from '@/components/layout/IssueCard';
import { IssueDetailScreen } from '@/components/layout/IssueDetailScreen';
import { type BoroughFilter, IssueFeedFilters } from '@/components/layout/IssueFeedFilters';
import { WelcomeCard } from '@/components/layout/WelcomeCard';
import { type District, filterMapIssues, type StatusFilter } from '@/components/utils/map-utils';
import { ParallaxFlatList } from '@/components/utils/parallax-flat-list';
import { TabScreen } from '@/components/utils/tab-screen';
import { ThemedText } from '@/components/utils/themed-text';
import { Spacing } from '@/constants/theme';
import { useCurrentUser } from '@/hooks/use-current-user';
import { type Theme, useThemedStyles } from '@/hooks/use-themed-styles';
import { fetchDistricts } from '@/lib/api/districts';
import { fetchIssues, fetchMyVotes, toggleIssueVote } from '@/lib/api/issues';
import type { Issue } from '@/models/Issue';
import { useAuth } from '@/providers/auth-provider';

export default function IssuesScreen() {
  const { t, i18n } = useTranslation();
  const styles = useThemedStyles(createStyles);
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();
  const user = useCurrentUser();

  const { data: issues = [] } = useQuery<Issue[]>({
    queryKey: ['issues'],
    queryFn: fetchIssues,
  });

  const { data: myVotes } = useQuery({
    queryKey: ['votes', 'me'],
    queryFn: fetchMyVotes,
    enabled: isAuthenticated,
  });

  const voteMutation = useMutation({
    mutationFn: ({
      issueId,
      voteType,
    }: {
      issueId: string;
      voteType: 'upvote' | 'confirm_resolved';
    }) => toggleIssueVote(issueId, voteType),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['issues'] });
      void queryClient.invalidateQueries({ queryKey: ['votes', 'me'] });
      void queryClient.invalidateQueries({ queryKey: ['profile', 'me'] });
    },
  });

  const { data: districts = [] } = useQuery<District[]>({
    queryKey: ['districts'],
    queryFn: fetchDistricts,
  });

  // Search and filters. The feed starts on the user's own borough; any other borough (or all of
  // them) can be picked instead.
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [borough, setBorough] = useState<BoroughFilter>('home');
  const homeDistrictId = user?.homeDistrictId ?? null;
  const districtId =
    borough === 'home' ? (homeDistrictId ?? 'all') : borough === 'all' ? 'all' : borough;

  // Matching the search and the borough, before the status filter (for the status chip counts).
  const inBorough = useMemo(
    () => filterMapIssues(issues, { query, category: 'all', status: 'all', districtId }, districts),
    [issues, query, districtId, districts],
  );
  const statusCounts = useMemo(() => {
    const counts = { all: inBorough.length, not_started: 0, in_progress: 0, resolved: 0 };
    for (const issue of inBorough) counts[issue.status] += 1;
    return counts;
  }, [inBorough]);
  const visibleIssues = useMemo(
    () => (status === 'all' ? inBorough : inBorough.filter((i) => i.status === status)),
    [inBorough, status],
  );
  const resetFilters = () => {
    setQuery('');
    setStatus('all');
    setBorough('all');
  };

  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const selectedIssue = selectedIssueId
    ? (issues.find((i) => i.id === selectedIssueId) ?? null)
    : null;

  const upvotedSet = new Set(myVotes?.upvotedIssueIds ?? []);
  const confirmedSet = new Set(myVotes?.confirmedIssueIds ?? []);

  return (
    // The welcome card carries the app header, so the frame doesn't repeat it.
    <TabScreen title={t('tabs.issues')} showAppHeader={false} showTitle={false}>
      <ParallaxFlatList
        header={
          // The filters scroll at half speed and fade while the reports slide over them.
          <View style={styles.header}>
            <WelcomeCard />
            <IssueFeedFilters
              query={query}
              onChangeQuery={setQuery}
              status={status}
              onChangeStatus={setStatus}
              statusCounts={statusCounts}
              borough={borough}
              onChangeBorough={setBorough}
              districts={districts}
              homeDistrictId={homeDistrictId}
              language={i18n.language}
            />
            <ThemedText
              testID="feed-results-count"
              type="caption"
              tone="secondary"
              style={styles.count}
            >
              {t('feed.results', { count: visibleIssues.length })}
            </ThemedText>
          </View>
        }
        data={visibleIssues}
        keyExtractor={(issue) => issue.id}
        renderItem={({ item }) => (
          <IssueCard
            issue={item}
            isUpvoted={upvotedSet.has(item.id)}
            isConfirmed={confirmedSet.has(item.id)}
            onUpvote={() => voteMutation.mutate({ issueId: item.id, voteType: 'upvote' })}
            onConfirmResolution={() =>
              voteMutation.mutate({ issueId: item.id, voteType: 'confirm_resolved' })
            }
            // Tapping unfolds the card; the comments button and the photo open the details.
            collapsible
            onCommentsPress={() => setSelectedIssueId(item.id)}
            onImagePress={() => setSelectedIssueId(item.id)}
          />
        )}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <View testID="feed-empty" style={styles.empty}>
            <ThemedText type="smallBold">{t('feed.emptyTitle')}</ThemedText>
            <Pressable
              testID="feed-reset-filters"
              accessibilityRole="button"
              onPress={resetFilters}
              style={styles.resetButton}
            >
              <ThemedText type="smallBold" style={styles.resetText}>
                {t('feed.reset')}
              </ThemedText>
            </Pressable>
          </View>
        }
      />

      {selectedIssue && (
        <IssueDetailScreen
          issue={selectedIssue}
          visible={Boolean(selectedIssue)}
          onClose={() => setSelectedIssueId(null)}
        />
      )}
    </TabScreen>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    list: {
      gap: Spacing.three,
      paddingHorizontal: Spacing.three,
      paddingBottom: Spacing.four,
    },
    // The list pads its items; the filters bring their own side spacing.
    header: { marginHorizontal: -Spacing.three },
    title: {
      paddingHorizontal: Spacing.four,
      paddingTop: Spacing.three,
      paddingBottom: Spacing.two,
    },
    count: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.two },
    empty: { alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.five },
    resetButton: {
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.two,
      borderRadius: 999,
      backgroundColor: theme.accent,
    },
    resetText: { color: theme.buttonText },
  });

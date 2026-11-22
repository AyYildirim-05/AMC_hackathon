import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, StyleSheet } from 'react-native';

import dummyIssues from '../../dummy_data/issues.json';

import { IssueCard } from '@/components/IssueCard';
import { IssueDetailScreen } from '@/components/IssueDetailScreen';
import { TabScreen } from '@/components/tab-screen';
import { Spacing } from '@/constants/theme';
import {
  fetchIssues,
  fetchMyVotes,
  isLiveApiEnabled,
  isServerObjectId,
  toggleIssueVote,
} from '@/lib/api/issues';
import type { Issue } from '@/models/Issue';
import { useAuth } from '@/providers/auth-provider';

const FALLBACK_ISSUES = dummyIssues.issues as Issue[];

export default function IssuesScreen() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();
  const liveApi = isLiveApiEnabled();

  const { data: issues = liveApi ? [] : FALLBACK_ISSUES } = useQuery<Issue[]>({
    queryKey: ['issues'],
    queryFn: fetchIssues,
    enabled: liveApi,
  });

  const { data: myVotes } = useQuery({
    queryKey: ['votes', 'me'],
    queryFn: fetchMyVotes,
    enabled: liveApi && isAuthenticated,
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

  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const selectedIssue = selectedIssueId
    ? (issues.find((i) => i.id === selectedIssueId) ?? null)
    : null;

  const upvotedSet = new Set(myVotes?.upvotedIssueIds ?? []);
  const confirmedSet = new Set(myVotes?.confirmedIssueIds ?? []);

  return (
    <TabScreen title={t('tabs.issues')}>
      <FlatList
        data={issues}
        keyExtractor={(issue) => issue.id}
        renderItem={({ item }) => (
          <IssueCard
            issue={item}
            isUpvoted={upvotedSet.has(item.id)}
            isConfirmed={confirmedSet.has(item.id)}
            onUpvote={
              liveApi && isServerObjectId(item.id)
                ? () => voteMutation.mutate({ issueId: item.id, voteType: 'upvote' })
                : undefined
            }
            onConfirmResolution={
              liveApi && isServerObjectId(item.id)
                ? () => voteMutation.mutate({ issueId: item.id, voteType: 'confirm_resolved' })
                : undefined
            }
            onPress={() => setSelectedIssueId(item.id)}
            onCommentsPress={() => setSelectedIssueId(item.id)}
            onImagePress={() => setSelectedIssueId(item.id)}
          />
        )}
        contentContainerStyle={styles.list}
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

const styles = StyleSheet.create({
  list: {
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.four,
  },
});

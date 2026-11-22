import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, StyleSheet } from 'react-native';

import { IssueCard } from '@/components/layout/IssueCard';
import { IssueDetailScreen } from '@/components/layout/IssueDetailScreen';
import { TabScreen } from '@/components/utils/tab-screen';
import { Spacing } from '@/constants/theme';
import { fetchIssues, fetchMyVotes, toggleIssueVote } from '@/lib/api/issues';
import type { Issue } from '@/models/Issue';
import { useAuth } from '@/providers/auth-provider';

export default function IssuesScreen() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();

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
            onUpvote={() => voteMutation.mutate({ issueId: item.id, voteType: 'upvote' })}
            onConfirmResolution={() =>
              voteMutation.mutate({ issueId: item.id, voteType: 'confirm_resolved' })
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

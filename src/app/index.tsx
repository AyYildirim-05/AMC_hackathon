import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, StyleSheet } from 'react-native';

import dummyIssues from '../../dummy_data/issues.json';

import { IssueCard } from '@/components/layout/IssueCard';
import { IssueDetailScreen } from '@/components/layout/IssueDetailScreen';
import { TabScreen } from '@/components/utils/tab-screen';
import { Spacing } from '@/constants/theme';
import type { Issue } from '@/models/Issue';

// Dummy data until the issues API exists.
const issues = dummyIssues.issues as Issue[];

export default function IssuesScreen() {
  const { t } = useTranslation();
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);

  return (
    <TabScreen title={t('tabs.issues')}>
      <FlatList
        data={issues}
        keyExtractor={(issue) => issue.id}
        renderItem={({ item }) => (
          <IssueCard
            issue={item}
            onPress={() => setSelectedIssue(item)}
            onCommentsPress={() => setSelectedIssue(item)}
            onImagePress={() => setSelectedIssue(item)}
          />
        )}
        contentContainerStyle={styles.list}
      />

      {selectedIssue && (
        <IssueDetailScreen
          issue={selectedIssue}
          visible={Boolean(selectedIssue)}
          onClose={() => setSelectedIssue(null)}
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

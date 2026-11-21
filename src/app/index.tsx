import { useTranslation } from 'react-i18next';
import { FlatList, StyleSheet } from 'react-native';

import dummyIssues from '../../dummy_data/issues.json';

import { IssueCard } from '@/components/IssueCard';
import { TabScreen } from '@/components/tab-screen';
import { Spacing } from '@/constants/theme';
import type { Issue } from '@/models/Issue';

// Dummy data until the issues API exists.
const issues = dummyIssues.issues as Issue[];

export default function IssuesScreen() {
  const { t } = useTranslation();

  return (
    <TabScreen title={t('tabs.issues')}>
      <FlatList
        data={issues}
        keyExtractor={(issue) => issue.id}
        renderItem={({ item }) => <IssueCard issue={item} />}
        contentContainerStyle={styles.list}
      />
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

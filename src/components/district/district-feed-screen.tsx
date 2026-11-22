import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import dummyDistricts from '../../../dummy_data/districts.json';
import dummyIssues from '../../../dummy_data/issues.json';
import dummyPersons from '../../../dummy_data/person.json';

import { IssueCard } from '@/components/layout/IssueCard';
import { IssueDetailScreen } from '@/components/layout/IssueDetailScreen';
import { type District } from '@/components/utils/map-utils';
import { TabScreen } from '@/components/utils/tab-screen';
import { ThemedText } from '@/components/utils/themed-text';
import { formatIssueDate } from '@/components/utils/formatter';
import { Spacing } from '@/constants/theme';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useTheme } from '@/hooks/use-theme';
import { ISSUE_CATEGORIES, type Issue, type IssueCategory } from '@/models/Issue';

// Dummy data until the issues and districts APIs are wired into this screen.
const ISSUES = dummyIssues.issues as Issue[];
const DISTRICTS = dummyDistricts.districts as District[];

type CategoryFilter = 'all' | IssueCategory;
type SortMode = 'recent' | 'popular';

const CATEGORY_ICONS: Record<IssueCategory, string> = {
  traffic_safety: '🚲',
  roads_potholes: '⚠️',
  streetlights_utilities: '💡',
};

/** Amber "works alert" colors from the mockup, readable in both modes. */
const ALERT_COLORS = {
  light: { background: '#FFF4E0', border: '#F5C77A', title: '#3A2400', label: '#855300' },
  dark: { background: '#3A2814', border: '#6B4515', title: '#FDE68A', label: '#FFB95F' },
};

/**
 * The user's home district in the sample data: matched by username, falling back to the first
 * district (the signed-in account's ids come from the server and don't exist in dummy_data).
 */
function homeDistrictIdFor(username: string | undefined): string {
  const person = dummyPersons.persons.find((p) => p.username === username);
  return person?.home_district_id ?? DISTRICTS[0].id;
}

/**
 * The borough feed (District tab): live sync strip, category filters, the current works alert,
 * recent reports in and around the selected district, and a call to report a new problem.
 */
export function DistrictFeedScreen() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const isDark = theme.text !== '#1C211F';
  const router = useRouter();
  const user = useCurrentUser();

  const [districtId, setDistrictId] = useState(() => homeDistrictIdFor(user?.username));
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [sort, setSort] = useState<SortMode>('recent');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [upvoted, setUpvoted] = useState<Set<string>>(new Set());
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);

  const district = DISTRICTS.find((d) => d.id === districtId) ?? DISTRICTS[0];
  const language = i18n.language === 'fr' ? 'fr' : 'en';
  const districtName = (d: District) => (language === 'fr' ? d.name_fr : d.name_en);

  const feed = useMemo(() => {
    const filtered = ISSUES.filter((issue) => category === 'all' || issue.category === category);
    // The selected district's reports first, then neighbouring ones.
    const own = (issue: Issue) => (issue.district_id === district.id ? 0 : 1);
    return [...filtered].sort(
      (a, b) =>
        own(a) - own(b) ||
        (sort === 'popular'
          ? b.upvote_count - a.upvote_count
          : b.created_at.localeCompare(a.created_at)),
    );
  }, [category, sort, district.id]);

  // The most supported in-progress report in this district with an official update.
  const alert = useMemo(
    () =>
      ISSUES.filter(
        (i) => i.district_id === district.id && i.status === 'in_progress' && i.official_response,
      ).sort((a, b) => b.upvote_count - a.upvote_count)[0] ?? null,
    [district.id],
  );

  const countFor = (filter: CategoryFilter) =>
    ISSUES.filter((i) => filter === 'all' || i.category === filter).length;

  const toggleUpvote = (id: string) =>
    setUpvoted((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const alertColors = ALERT_COLORS[isDark ? 'dark' : 'light'];
  const chipStyle = (selected: boolean) => [
    styles.chip,
    selected
      ? { backgroundColor: theme.accent, borderColor: theme.accent }
      : { backgroundColor: theme.background, borderColor: theme.backgroundSelected },
  ];

  const header = (
    <View style={styles.headerStack}>
      {/* OpenNorth sync strip + district picker */}
      <View style={styles.syncRow}>
        <Pressable
          testID="district-feed-picker"
          accessibilityRole="button"
          accessibilityLabel={t('districtFeed.chooseDistrict')}
          onPress={() => setPickerOpen(true)}
          style={[styles.syncChip, { backgroundColor: theme.backgroundElement }]}
        >
          <View style={[styles.liveDot, { backgroundColor: theme.success }]} />
          <ThemedText type="miniText" weight="semibold">
            {t('districtFeed.sync')}
          </ThemedText>
          <ThemedText type="code" tone="secondary" numberOfLines={1} style={styles.shrink}>
            {district.open_north_slug}
          </ThemedText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => setPickerOpen(true)}
          style={[styles.filterButton, { borderColor: theme.backgroundSelected }]}
        >
          <ThemedText type="miniText" weight="semibold">
            ☰ {t('districtFeed.filter')}
          </ThemedText>
        </Pressable>
      </View>

      {/* Category tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        accessibilityRole="tablist"
        contentContainerStyle={styles.chips}
      >
        {(['all', ...ISSUE_CATEGORIES] as CategoryFilter[]).map((key) => {
          const selected = key === category;
          const textColor = selected ? theme.buttonText : theme.text;
          return (
            <Pressable
              key={key}
              testID={`district-feed-category-${key}`}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => setCategory(key)}
              style={chipStyle(selected)}
            >
              {key === 'all' ? (
                <>
                  <ThemedText type="miniText" weight="semibold" style={{ color: textColor }}>
                    {t('districtFeed.all')}
                  </ThemedText>
                  <View style={[styles.countBadge, { backgroundColor: theme.buttonText }]}>
                    <ThemedText type="miniText" weight="bold" style={{ color: theme.accent }}>
                      {countFor('all')}
                    </ThemedText>
                  </View>
                </>
              ) : (
                <ThemedText type="miniText" weight="semibold" style={{ color: textColor }}>
                  {CATEGORY_ICONS[key]} {t(`issue.category.${key}`)}
                </ThemedText>
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Works alert */}
      {alert ? (
        <View
          testID="district-feed-alert"
          style={[
            styles.alert,
            { backgroundColor: alertColors.background, borderColor: alertColors.border },
          ]}
        >
          <View style={styles.alertTop}>
            <View style={styles.alertIcon}>
              <ThemedText style={styles.alertIconText}>✱</ThemedText>
            </View>
            <View style={styles.flex}>
              <ThemedText type="overline" style={{ color: alertColors.label }}>
                {t('districtFeed.alertLabel')}
              </ThemedText>
              <ThemedText type="smallBold" style={{ color: alertColors.title }} numberOfLines={2}>
                {alert.title}
              </ThemedText>
            </View>
            <View style={[styles.datePill, { borderColor: alertColors.border }]}>
              <ThemedText type="miniText" weight="semibold" style={{ color: alertColors.label }}>
                {formatIssueDate(alert.updated_at, language)}
              </ThemedText>
            </View>
          </View>
          <ThemedText type="caption" style={{ color: alertColors.title }}>
            {alert.official_response?.comment}
          </ThemedText>
          <View style={styles.alertBottom}>
            <ThemedText type="miniText" style={{ color: alertColors.label }}>
              ⟳ {t('districtFeed.alertSync', { time: alert.updated_at.slice(11, 16) })}
            </ThemedText>
            <Pressable
              testID="district-feed-alert-details"
              accessibilityRole="button"
              onPress={() => setSelectedIssue(alert)}
              hitSlop={8}
            >
              <ThemedText type="miniText" weight="bold" style={{ color: alertColors.title }}>
                {t('districtFeed.details')} →
              </ThemedText>
            </Pressable>
          </View>
        </View>
      ) : null}

      {/* Feed header */}
      <View style={styles.feedHeader}>
        <View style={styles.flex}>
          <ThemedText type="h3" accessibilityRole="header">
            {t('districtFeed.recent')}
          </ThemedText>
          <ThemedText type="caption" tone="secondary">
            {t('districtFeed.around', { district: districtName(district) })}
          </ThemedText>
        </View>
        <Pressable
          testID="district-feed-sort"
          accessibilityRole="button"
          onPress={() => setSort((s) => (s === 'recent' ? 'popular' : 'recent'))}
          hitSlop={8}
        >
          <ThemedText type="miniText" weight="semibold" tone="accent">
            ⇅ {t(`districtFeed.sort.${sort}`)}
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );

  const footer = (
    <View style={[styles.cta, { backgroundColor: theme.accent }]}>
      <View style={styles.flex}>
        <ThemedText type="smallBold" style={{ color: theme.buttonText }}>
          {t('districtFeed.ctaTitle')}
        </ThemedText>
        <ThemedText type="caption" style={{ color: theme.buttonText }}>
          {t('districtFeed.ctaBody', { district: districtName(district) })}
        </ThemedText>
      </View>
      <Pressable
        testID="district-feed-report-button"
        accessibilityRole="button"
        onPress={() => router.navigate('/report')}
        style={({ pressed }) => [
          styles.ctaButton,
          { backgroundColor: theme.buttonText },
          pressed && styles.pressed,
        ]}
      >
        <ThemedText type="smallBold" style={{ color: theme.accent }}>
          📷 {t('districtFeed.ctaButton')}
        </ThemedText>
      </Pressable>
    </View>
  );

  return (
    <TabScreen title={t('tabs.district')}>
      <FlatList
        data={feed}
        keyExtractor={(issue) => issue.id}
        ListHeaderComponent={header}
        ListFooterComponent={footer}
        ListEmptyComponent={
          <ThemedText tone="secondary" style={styles.empty}>
            {t('districtFeed.empty')}
          </ThemedText>
        }
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const isUpvoted = upvoted.has(item.id);
          const other = DISTRICTS.find((d) => d.id === item.district_id);
          const outside = item.district_id !== district.id;
          return (
            <View>
              {outside && other ? (
                <View
                  testID={`district-feed-outside-${item.id}`}
                  style={[styles.ribbon, { backgroundColor: theme.backgroundElement }]}
                >
                  <ThemedText type="miniText" weight="semibold" style={styles.shrink}>
                    ⇄ {t('districtFeed.outside')} • {districtName(other)}
                  </ThemedText>
                  <ThemedText type="code" tone="secondary" numberOfLines={1} style={styles.shrink}>
                    {other.open_north_slug}
                  </ThemedText>
                </View>
              ) : null}
              <IssueCard
                issue={{ ...item, upvote_count: item.upvote_count + (isUpvoted ? 1 : 0) }}
                isUpvoted={isUpvoted}
                onUpvote={() => toggleUpvote(item.id)}
                onPress={() => setSelectedIssue(item)}
                onCommentsPress={() => setSelectedIssue(item)}
                onImagePress={() => setSelectedIssue(item)}
                style={outside ? styles.attachedCard : undefined}
              />
            </View>
          );
        }}
      />

      {/* District picker */}
      <Modal
        visible={pickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setPickerOpen(false)}>
          <View style={[styles.sheet, { backgroundColor: theme.background }]}>
            <ThemedText type="smallBold" accessibilityRole="header">
              {t('districtFeed.chooseDistrict')}
            </ThemedText>
            {DISTRICTS.map((d) => {
              const selected = d.id === district.id;
              return (
                <Pressable
                  key={d.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => {
                    setDistrictId(d.id);
                    setPickerOpen(false);
                  }}
                  style={[
                    styles.sheetRow,
                    selected && { backgroundColor: theme.backgroundSelected },
                  ]}
                >
                  <ThemedText weight={selected ? 'bold' : 'regular'}>{districtName(d)}</ThemedText>
                  <ThemedText type="code" tone="secondary">
                    {d.open_north_slug}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>

      {selectedIssue ? (
        <IssueDetailScreen issue={selectedIssue} visible onClose={() => setSelectedIssue(null)} />
      ) : null}
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  list: { gap: Spacing.three, paddingHorizontal: Spacing.three, paddingBottom: Spacing.four },
  headerStack: { gap: Spacing.three },
  flex: { flex: 1 },
  shrink: { flexShrink: 1 },
  pressed: { opacity: 0.8 },
  syncRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  syncChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 999,
  },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  filterButton: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 999,
    borderWidth: 1,
  },
  chips: { gap: Spacing.two },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 999,
    borderWidth: 1,
  },
  countBadge: {
    minWidth: 20,
    alignItems: 'center',
    paddingHorizontal: Spacing.one,
    borderRadius: 10,
  },
  alert: { gap: Spacing.two, padding: Spacing.three, borderRadius: 16, borderWidth: 1 },
  alertTop: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  alertIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FEA619',
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertIconText: { color: '#3A2400', fontSize: 18, fontWeight: '700' },
  datePill: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: 999,
    borderWidth: 1,
  },
  alertBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  feedHeader: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.two },
  ribbon: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  attachedCard: { borderTopLeftRadius: 0, borderTopRightRadius: 0 },
  empty: { textAlign: 'center', paddingVertical: Spacing.four },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: 16,
  },
  ctaButton: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: 999 },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    gap: Spacing.one,
    padding: Spacing.three,
    paddingBottom: Spacing.five,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  sheetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: 12,
  },
});

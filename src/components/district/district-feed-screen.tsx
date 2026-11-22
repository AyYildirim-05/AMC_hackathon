import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { type Theme, useThemedStyles } from '@/hooks/use-themed-styles';
import { IssueCard } from '@/components/layout/IssueCard';
import { IssueDetailScreen } from '@/components/layout/IssueDetailScreen';
import { BoroughPickerSheet } from '@/components/utils/borough-picker-sheet';
import { type District } from '@/components/utils/map-utils';
import { TabScreen } from '@/components/utils/tab-screen';
import { ThemedText } from '@/components/utils/themed-text';
import { formatIssueDate } from '@/components/utils/formatter';
import { Spacing } from '@/constants/theme';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useTheme } from '@/hooks/use-theme';
import { fetchDistricts } from '@/lib/api/districts';
import { fetchIssues, fetchMyVotes, toggleIssueVote } from '@/lib/api/issues';
import { ISSUE_CATEGORIES, type Issue, type IssueCategory } from '@/models/Issue';
import { useAuth } from '@/providers/auth-provider';

type CategoryFilter = 'all' | IssueCategory;
type SortMode = 'recent' | 'popular';

const CATEGORY_ICONS: Record<IssueCategory, string> = {
  traffic_safety: '🚲',
  roads_potholes: '⚠️',
  streetlights_utilities: '💡',
};

/** "Works alert" colors from the theme; the shade numbers keep their role in both modes. */
const alertColorsFor = (theme: Theme) => ({
  background: theme.neutral100,
  border: theme.accent300,
  title: theme.text,
  label: theme.accent700,
});

/**
 * The borough feed (District tab): live sync strip, category filters, the current works alert,
 * recent reports in and around the selected district, and a call to report a new problem.
 */
export function DistrictFeedScreen() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const user = useCurrentUser();
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const { data: issues = [] } = useQuery<Issue[]>({
    queryKey: ['issues'],
    queryFn: fetchIssues,
  });

  const { data: districts = [] } = useQuery<District[]>({
    queryKey: ['districts'],
    queryFn: fetchDistricts,
  });

  const { data: myVotes } = useQuery({
    queryKey: ['votes', 'me'],
    queryFn: fetchMyVotes,
    enabled: isAuthenticated,
  });

  const voteMutation = useMutation({
    mutationFn: (issueId: string) => toggleIssueVote(issueId, 'upvote'),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['issues'] });
      void queryClient.invalidateQueries({ queryKey: ['votes', 'me'] });
      void queryClient.invalidateQueries({ queryKey: ['profile', 'me'] });
    },
  });

  const [pickedDistrictId, setPickedDistrictId] = useState<string | null>(null);
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [sort, setSort] = useState<SortMode>('recent');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);

  const defaultDistrictId = useMemo(() => {
    if (user?.homeDistrictId && districts.some((d) => d.id === user.homeDistrictId)) {
      return user.homeDistrictId;
    }
    return districts[0]?.id ?? '';
  }, [user?.homeDistrictId, districts]);

  const activeDistrictId = pickedDistrictId ?? defaultDistrictId;
  const district: District = districts.find((d) => d.id === activeDistrictId) ??
    districts[0] ?? {
      id: '',
      name_fr: '',
      name_en: '',
      open_north_slug: '',
      district_type: 'borough',
      manager_id: null,
      is_claimed: false,
      created_at: '',
    };

  const selectedIssue = selectedIssueId
    ? (issues.find((i) => i.id === selectedIssueId) ?? null)
    : null;

  const upvoted = useMemo(
    () => new Set(myVotes?.upvotedIssueIds ?? []),
    [myVotes?.upvotedIssueIds],
  );

  const language = i18n.language === 'fr' ? 'fr' : 'en';
  const districtName = (d: District) => (language === 'fr' ? d.name_fr : d.name_en);

  const feed = useMemo(() => {
    const filtered = issues.filter((issue) => category === 'all' || issue.category === category);
    // The selected district's reports first, then neighbouring ones.
    const own = (issue: Issue) => (issue.district_id === district.id ? 0 : 1);
    return [...filtered].sort(
      (a, b) =>
        own(a) - own(b) ||
        (sort === 'popular'
          ? b.upvote_count - a.upvote_count
          : b.created_at.localeCompare(a.created_at)),
    );
  }, [issues, category, sort, district.id]);

  // The most supported in-progress report in this district with an official update.
  const alert = useMemo(
    () =>
      issues
        .filter(
          (i) => i.district_id === district.id && i.status === 'in_progress' && i.official_response,
        )
        .sort((a, b) => b.upvote_count - a.upvote_count)[0] ?? null,
    [issues, district.id],
  );

  const countFor = (filter: CategoryFilter) =>
    issues.filter((i) => filter === 'all' || i.category === filter).length;

  const toggleUpvote = (id: string) => {
    voteMutation.mutate(id);
  };

  const alertColors = alertColorsFor(theme);
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
              onPress={() => setSelectedIssueId(alert.id)}
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
          const other = districts.find((d) => d.id === item.district_id);
          const outside = Boolean(district.id) && item.district_id !== district.id;
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
                issue={item}
                isUpvoted={isUpvoted}
                onUpvote={() => toggleUpvote(item.id)}
                // Tapping unfolds the card; the comments button and the photo open the details.
                collapsible
                onCommentsPress={() => setSelectedIssueId(item.id)}
                onImagePress={() => setSelectedIssueId(item.id)}
                style={outside ? styles.attachedCard : undefined}
              />
            </View>
          );
        }}
      />

      {/* District picker */}
      <BoroughPickerSheet
        visible={pickerOpen}
        title={t('districtFeed.chooseDistrict')}
        testID="district-feed-picker-sheet"
        options={districts.map((d) => ({
          key: d.id,
          label: districtName(d),
          selected: d.id === district.id,
          testID: `district-feed-option-${d.open_north_slug}`,
        }))}
        onSelect={(id) => {
          setPickedDistrictId(id);
          setPickerOpen(false);
        }}
        onClose={() => setPickerOpen(false)}
      />

      {selectedIssue ? (
        <IssueDetailScreen issue={selectedIssue} visible onClose={() => setSelectedIssueId(null)} />
      ) : null}
    </TabScreen>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
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
      backgroundColor: theme.accent400,
      alignItems: 'center',
      justifyContent: 'center',
    },
    alertIconText: { color: theme.neutral900, fontSize: 18, fontWeight: '700' },
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
    ctaButton: {
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.two,
      borderRadius: 999,
    },
  });

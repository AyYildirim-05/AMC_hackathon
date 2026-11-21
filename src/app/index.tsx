import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CivicPromptCard } from '@/components/feed/civic-prompt-card';
import { FeedHeader } from '@/components/feed/feed-header';
import { IssueCard } from '@/components/feed/issue-card';
import { UrgentAlertBanner } from '@/components/feed/urgent-alert-banner';
import { ThemedButton } from '@/components/themed-button';
import { ThemedCard } from '@/components/themed-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import districtsJson from '../../dummy_data/districts.json';
import commentsJson from '../../dummy_data/issue_comments.json';
import votesJson from '../../dummy_data/issue_votes.json';
import issuesJson from '../../dummy_data/issues.json';
import personsJson from '../../dummy_data/person.json';

const CATEGORY_ICONS: Record<string, SymbolViewProps['name']> = {
  roads_potholes: { ios: 'exclamationmark.triangle', android: 'warning', web: 'warning' },
  snow_ice: { ios: 'snowflake', android: 'ac_unit', web: 'ac_unit' },
  trash_cleanliness: { ios: 'trash', android: 'delete', web: 'delete' },
  parks_trees: { ios: 'leaf', android: 'park', web: 'park' },
  traffic_safety: { ios: 'bicycle', android: 'directions_bike', web: 'directions_bike' },
  streetlights_utilities: { ios: 'lightbulb', android: 'lightbulb', web: 'lightbulb' },
  other: { ios: 'ellipsis.circle', android: 'more_horiz', web: 'more_horiz' },
};

const districts = districtsJson.districts;
const persons = personsJson.persons;
const issues = issuesJson.issues;
const comments = commentsJson.issue_comments;
const votes = votesJson.issue_votes;

const districtById = new Map(districts.map((d) => [d.id, d]));
const personById = new Map(persons.map((p) => [p.id, p]));
const currentUser = persons[0];
const defaultDistrict = districtById.get(currentUser.home_district_id) ?? districts[0];

function getInitials(username: string): string {
  const parts = username.split(/[_.\-\s]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return username.slice(0, 2).toUpperCase();
}

function getDistrictName(district: (typeof districts)[number], lang: string): string {
  return lang === 'en' ? district.name_en : district.name_fr;
}

function formatShortDate(iso: string, lang: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(lang === 'en' ? 'en-CA' : 'fr-CA', {
    day: 'numeric',
    month: 'short',
  }).format(date);
}

function formatTime(iso: string, lang: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(lang === 'en' ? 'en-CA' : 'fr-CA', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function getInitialVotes(voteType: 'upvote' | 'confirm_resolved'): Record<string, boolean> {
  const map: Record<string, boolean> = {};
  for (const vote of votes) {
    if (vote.user_id === currentUser.id && vote.vote_type === voteType) {
      map[vote.issue_id] = true;
    }
  }
  return map;
}

const INITIAL_UPVOTES = getInitialVotes('upvote');
const INITIAL_RESOLUTIONS = getInitialVotes('confirm_resolved');

const enrichedIssues = issues.map((issue) => {
  const district = districtById.get(issue.district_id) ?? districts[0];
  const author = personById.get(issue.created_by_id) ?? persons[0];
  const issueComments = comments.filter((c) => c.issue_id === issue.id);
  const officialComments = issueComments.filter((c) => c.is_official_response);
  const latestOfficial = officialComments[officialComments.length - 1];
  const officialAuthor = latestOfficial ? personById.get(latestOfficial.user_id) : undefined;

  return {
    ...issue,
    district,
    author,
    authorInitials: getInitials(author.username),
    commentCount: issueComments.length,
    officialResponse:
      latestOfficial && officialAuthor
        ? {
            username: `@${officialAuthor.username}`,
            role: officialAuthor.role,
            body: latestOfficial.body,
            createdAt: latestOfficial.created_at,
          }
        : null,
  };
});

export default function SignalementsFeedScreen() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();

  const [activeDistrict, setActiveDistrict] = useState(defaultDistrict);
  const [districtPickerOpen, setDistrictPickerOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'popular'>('recent');
  const [upvotedIds, setUpvotedIds] = useState<Record<string, boolean>>(INITIAL_UPVOTES);
  const [resolvedIds, setResolvedIds] = useState<Record<string, boolean>>(INITIAL_RESOLUTIONS);
  const [followedIds, setFollowedIds] = useState<Record<string, boolean>>({});

  const availableCategories = useMemo(
    () => ['all', ...new Set(enrichedIssues.map((item) => item.category))],
    [],
  );

  const priorityAlertIssue = useMemo(() => {
    return (
      enrichedIssues.find(
        (item) => item.district.id === activeDistrict.id && item.status === 'in_progress',
      ) ??
      enrichedIssues.find((item) => item.status === 'in_progress') ??
      null
    );
  }, [activeDistrict.id]);

  const filteredIssues = useMemo(() => {
    const list =
      activeCategory === 'all'
        ? enrichedIssues
        : enrichedIssues.filter((item) => item.category === activeCategory);

    return [...list].sort((a, b) => {
      if (sortBy === 'popular') {
        const aVotes =
          a.upvote_count + (upvotedIds[a.id] ? 1 : 0) - (INITIAL_UPVOTES[a.id] ? 1 : 0);
        const bVotes =
          b.upvote_count + (upvotedIds[b.id] ? 1 : 0) - (INITIAL_UPVOTES[b.id] ? 1 : 0);
        return bVotes - aVotes;
      }
      return b.created_at.localeCompare(a.created_at);
    });
  }, [activeCategory, sortBy, upvotedIds]);

  const activeDistrictName = getDistrictName(activeDistrict, i18n.language);

  const getRoleLabel = (role: string) => {
    if (role === 'district_manager') return t('feed.card.managerRole');
    if (role === 'admin') return t('feed.card.adminRole');
    return t('feed.card.residentRole');
  };

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.centeredShell}>
          <FeedHeader
            districtName={activeDistrictName}
            isDistrictClaimed={activeDistrict.is_claimed}
            username={currentUser.username}
            userInitials={getInitials(currentUser.username)}
            districtPickerOpen={districtPickerOpen}
            onPressDistrict={() => setDistrictPickerOpen((open) => !open)}
          />

          {districtPickerOpen ? (
            <View style={styles.pickerWrap}>
              <ThemedCard variant="outlined" padding="small" style={styles.pickerCard}>
                <ThemedText type="overline" tone="secondary" style={styles.pickerTitle}>
                  {t('feed.district.selectTitle')}
                </ThemedText>
                <View style={styles.pickerList}>
                  {districts.map((district) => {
                    const selected = district.id === activeDistrict.id;
                    return (
                      <ThemedButton
                        key={district.id}
                        type={selected ? 'primary' : 'secondary'}
                        size="small"
                        fullWidth
                        onPress={() => {
                          setActiveDistrict(district);
                          setDistrictPickerOpen(false);
                        }}
                        style={styles.pickerOption}
                      >
                        {`${getDistrictName(district, i18n.language)} • ${
                          district.is_claimed
                            ? t('feed.district.claimed')
                            : t('feed.district.unclaimed')
                        }`}
                      </ThemedButton>
                    );
                  })}
                </View>
              </ThemedCard>
            </View>
          ) : null}

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* OpenNorth Sync Strip + Filter Button */}
            <View style={styles.syncStrip}>
              <ThemedView type="backgroundElement" style={styles.openNorthPill}>
                <View
                  style={[
                    styles.syncDot,
                    {
                      backgroundColor: activeDistrict.is_claimed
                        ? theme.success
                        : theme.textSecondary,
                    },
                  ]}
                />
                <ThemedText type="caption" weight="semibold" themeColor="text">
                  {t('feed.openNorthSync')}
                </ThemedText>
                <ThemedText type="code" tone="secondary" numberOfLines={1} style={styles.slugText}>
                  {activeDistrict.open_north_slug}
                </ThemedText>
              </ThemedView>

              <ThemedButton
                type="secondary"
                size="small"
                style={styles.filterBtn}
                textStyle={styles.filterBtnText}
                onPress={() => setSortBy((prev) => (prev === 'recent' ? 'popular' : 'recent'))}
                icon={
                  <SymbolView
                    name={{ ios: 'slider.horizontal.3', android: 'tune', web: 'tune' }}
                    size={14}
                    tintColor={theme.accent}
                  />
                }
              >
                {t('feed.filter')}
              </ThemedButton>
            </View>

            {/* Horizontal Category Pills */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryScroll}
            >
              {availableCategories.map((categoryKey) => {
                const selected = categoryKey === activeCategory;
                const icon = categoryKey === 'all' ? undefined : CATEGORY_ICONS[categoryKey];
                return (
                  <ThemedButton
                    key={categoryKey}
                    type={selected ? 'primary' : 'secondary'}
                    size="small"
                    rounded
                    accessibilityState={{ selected }}
                    onPress={() => setActiveCategory(categoryKey)}
                    style={styles.categoryChip}
                    textStyle={styles.categoryChipText}
                    icon={
                      icon ? (
                        <SymbolView
                          name={icon}
                          size={14}
                          tintColor={selected ? theme.buttonText : theme.accent}
                        />
                      ) : undefined
                    }
                  >
                    {categoryKey === 'all'
                      ? `${t('feed.categories.all')} (${enrichedIssues.length})`
                      : t(`feed.categories.${categoryKey}` as never)}
                  </ThemedButton>
                );
              })}
            </ScrollView>

            {/* Priority Alert Banner */}
            {priorityAlertIssue ? (
              <View style={styles.sectionPad}>
                <UrgentAlertBanner
                  title={priorityAlertIssue.title}
                  body={priorityAlertIssue.officialResponse?.body ?? priorityAlertIssue.description}
                  statusLabel={t(`feed.status.${priorityAlertIssue.status}` as never)}
                  updatedTime={formatTime(
                    priorityAlertIssue.officialResponse?.createdAt ?? priorityAlertIssue.updated_at,
                    i18n.language,
                  )}
                  districtName={getDistrictName(priorityAlertIssue.district, i18n.language)}
                />
              </View>
            ) : null}

            {/* Issues Feed Header */}
            <View style={styles.feedHeaderRow}>
              <View style={styles.feedTitleGroup}>
                <ThemedText type="h3" style={styles.feedHeading}>
                  {t('feed.section.title')}
                </ThemedText>
                <ThemedText type="caption" tone="secondary" weight="semibold">
                  {t('feed.section.subtitle', { district: activeDistrictName })}
                </ThemedText>
              </View>

              <ThemedButton
                type="text"
                size="small"
                style={styles.sortBtn}
                textStyle={styles.sortBtnText}
                onPress={() => setSortBy((prev) => (prev === 'recent' ? 'popular' : 'recent'))}
                icon={
                  <SymbolView
                    name={{ ios: 'arrow.up.arrow.down', android: 'sort', web: 'sort' }}
                    size={13}
                    tintColor={theme.accent}
                  />
                }
              >
                {sortBy === 'recent' ? t('feed.section.sortRecent') : t('feed.section.sortPopular')}
              </ThemedButton>
            </View>

            {/* Issue Cards List */}
            <View style={styles.cardsColumn}>
              {filteredIssues.length > 0 ? (
                filteredIssues.map((issue) => {
                  const isUpvoted = Boolean(upvotedIds[issue.id]);
                  const isResolved = Boolean(resolvedIds[issue.id]);
                  const upvoteCount = Math.max(
                    0,
                    issue.upvote_count + (isUpvoted ? 1 : 0) - (INITIAL_UPVOTES[issue.id] ? 1 : 0),
                  );
                  const resolutionConfirmations = Math.max(
                    0,
                    issue.resolution_confirmations +
                      (isResolved ? 1 : 0) -
                      (INITIAL_RESOLUTIONS[issue.id] ? 1 : 0),
                  );

                  return (
                    <IssueCard
                      key={issue.id}
                      id={issue.id}
                      title={issue.title}
                      description={issue.description}
                      category={issue.category}
                      categoryLabel={t(`feed.categories.${issue.category}` as never)}
                      status={issue.status}
                      statusLabel={t(`feed.status.${issue.status}` as never)}
                      images={issue.images}
                      address={issue.address}
                      authorUsername={issue.author.username}
                      authorInitials={issue.authorInitials}
                      dateLabel={formatShortDate(issue.created_at, i18n.language)}
                      districtName={getDistrictName(issue.district, i18n.language)}
                      districtTypeLabel={t(
                        `feed.district.${issue.district.district_type}` as never,
                      )}
                      districtSlug={issue.district.open_north_slug}
                      isDistrictClaimed={issue.district.is_claimed}
                      isOutOfDistrict={issue.district.id !== activeDistrict.id}
                      external311Ref={issue.external_311_ref}
                      officialResponse={
                        issue.officialResponse
                          ? {
                              username: issue.officialResponse.username,
                              roleLabel: getRoleLabel(issue.officialResponse.role),
                              body: issue.officialResponse.body,
                            }
                          : null
                      }
                      upvoteCount={upvoteCount}
                      resolutionConfirmations={resolutionConfirmations}
                      commentCount={issue.commentCount}
                      isUpvoted={isUpvoted}
                      isResolvedConfirmed={isResolved}
                      isFollowing={Boolean(followedIds[issue.id])}
                      onToggleUpvote={(id) =>
                        setUpvotedIds((prev) => ({ ...prev, [id]: !prev[id] }))
                      }
                      onToggleConfirmResolved={(id) =>
                        setResolvedIds((prev) => ({ ...prev, [id]: !prev[id] }))
                      }
                      onToggleFollow={(id) =>
                        setFollowedIds((prev) => ({ ...prev, [id]: !prev[id] }))
                      }
                    />
                  );
                })
              ) : (
                <ThemedView type="backgroundElement" style={styles.emptyState}>
                  <ThemedText type="small" tone="secondary" align="center">
                    {t('feed.card.empty')}
                  </ThemedText>
                </ThemedView>
              )}
            </View>

            {/* Community Engagement Prompt Card */}
            <View style={styles.promptSection}>
              <CivicPromptCard districtName={activeDistrictName} />
            </View>
          </ScrollView>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    alignItems: 'center',
  },
  centeredShell: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  pickerWrap: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
  },
  pickerCard: {
    borderRadius: Spacing.three,
  },
  pickerTitle: {
    fontSize: 10,
    letterSpacing: 1,
  },
  pickerList: {
    gap: Spacing.one + Spacing.half,
  },
  pickerOption: {
    justifyContent: 'flex-start',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: Spacing.two + Spacing.one,
    paddingBottom: BottomTabInset + Spacing.five,
    gap: Spacing.three,
  },
  syncStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
  },
  openNorthPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + Spacing.half,
    paddingHorizontal: Spacing.two + Spacing.half,
    paddingVertical: Spacing.one + Spacing.half,
    borderRadius: 999,
    flexShrink: 1,
  },
  syncDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
  },
  slugText: {
    fontSize: 11,
    flexShrink: 1,
  },
  filterBtn: {
    minHeight: 32,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two + Spacing.one,
    borderRadius: Spacing.two + Spacing.one,
  },
  filterBtnText: {
    fontSize: 12,
    lineHeight: 16,
  },
  categoryScroll: {
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
  },
  categoryChip: {
    minHeight: 34,
    paddingVertical: Spacing.one + Spacing.half,
    paddingHorizontal: Spacing.three,
  },
  categoryChipText: {
    fontSize: 13,
    lineHeight: 17,
  },
  sectionPad: {
    paddingHorizontal: Spacing.three,
  },
  feedHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
  },
  feedTitleGroup: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: Spacing.two,
    flex: 1,
  },
  feedHeading: {
    fontSize: 19,
    lineHeight: 24,
  },
  sortBtn: {
    minHeight: 28,
    paddingVertical: 2,
    paddingHorizontal: Spacing.one,
  },
  sortBtnText: {
    fontSize: 12,
    lineHeight: 16,
  },
  cardsColumn: {
    paddingHorizontal: Spacing.three,
    gap: Spacing.three,
  },
  emptyState: {
    padding: Spacing.four,
    borderRadius: Spacing.three,
  },
  promptSection: {
    paddingHorizontal: Spacing.three,
    marginTop: Spacing.one,
  },
});

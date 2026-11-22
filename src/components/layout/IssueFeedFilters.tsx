import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { MapIcon } from '@/components/map/MapIcon';
import { BoroughPickerSheet } from '@/components/utils/borough-picker-sheet';
import { useIssueStatusColors } from '@/components/utils/issue-status';
import { type District, type StatusFilter } from '@/components/utils/map-utils';
import { Spacing } from '@/constants/theme';
import { type Theme, useThemedStyles } from '@/hooks/use-themed-styles';
import { useTheme } from '@/hooks/use-theme';
import { ISSUE_STATUSES, type IssueStatus } from '@/models/Issue';

/** `home`: the borough the user lives in; `all`: every borough; otherwise a district id. */
export type BoroughFilter = 'home' | 'all' | string;

export type IssueFeedFiltersProps = {
  query: string;
  onChangeQuery: (query: string) => void;
  status: StatusFilter;
  onChangeStatus: (status: StatusFilter) => void;
  /** Issues per status for the current search and borough (before the status filter). */
  statusCounts: Record<'all' | IssueStatus, number>;
  borough: BoroughFilter;
  onChangeBorough: (borough: BoroughFilter) => void;
  districts: readonly District[];
  /** The user's home district, or null when unknown (then "My borough" is not offered). */
  homeDistrictId: string | null;
  language: string;
};

/** Search, status chips and a borough picker above the Home issue feed. */
export function IssueFeedFilters({
  query,
  onChangeQuery,
  status,
  onChangeStatus,
  statusCounts,
  borough,
  onChangeBorough,
  districts,
  homeDistrictId,
  language,
}: IssueFeedFiltersProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const statusColors = useIssueStatusColors();
  const [pickerOpen, setPickerOpen] = useState(false);

  const nameOf = (district: District) =>
    language.startsWith('en') ? district.name_en : district.name_fr;
  const homeDistrict = districts.find((d) => d.id === homeDistrictId) ?? null;
  const boroughLabel =
    borough === 'all'
      ? t('feed.boroughAll')
      : borough === 'home'
        ? homeDistrict
          ? t('feed.boroughMine', { borough: nameOf(homeDistrict) })
          : t('feed.boroughAll')
        : (() => {
            const district = districts.find((d) => d.id === borough);
            return district ? nameOf(district) : t('feed.boroughAll');
          })();

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <MapIcon name="search" size={16} color={theme.textSecondary} />
        <TextInput
          testID="feed-search-input"
          value={query}
          onChangeText={onChangeQuery}
          placeholder={t('feed.searchPlaceholder')}
          placeholderTextColor={theme.textSecondary}
          style={styles.searchInput}
          returnKeyType="search"
          autoCorrect={false}
        />
        {query.length > 0 ? (
          <Pressable
            testID="feed-search-clear"
            accessibilityRole="button"
            accessibilityLabel={t('feed.clearSearch')}
            onPress={() => onChangeQuery('')}
            hitSlop={8}
            style={styles.clearButton}
          >
            <MapIcon name="close" size={12} color={theme.textSecondary} />
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        <Pressable
          testID="feed-borough-button"
          accessibilityRole="button"
          accessibilityLabel={t('feed.boroughTitle')}
          accessibilityValue={{ text: boroughLabel }}
          onPress={() => setPickerOpen(true)}
          style={[styles.chip, styles.boroughChip]}
        >
          <MapIcon name="city" size={13} color={theme.buttonText} />
          <Text numberOfLines={1} style={[styles.chipText, { color: theme.buttonText }]}>
            {boroughLabel} ▾
          </Text>
        </Pressable>

        {(['all', ...ISSUE_STATUSES] as const).map((key) => {
          const selected = status === key;
          return (
            <Pressable
              key={key}
              testID={`feed-status-${key}`}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onChangeStatus(key)}
              style={[styles.chip, selected && styles.chipSelected]}
            >
              {key !== 'all' ? (
                <View style={[styles.statusDot, { backgroundColor: statusColors[key] }]} />
              ) : null}
              <Text style={[styles.chipText, { color: selected ? theme.background : theme.text }]}>
                {key === 'all' ? t('feed.statusAll') : t(`issue.status.${key}`)}
              </Text>
              <Text
                style={[
                  styles.chipCount,
                  { color: selected ? theme.background : theme.textSecondary },
                ]}
              >
                {statusCounts[key]}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <BoroughPickerSheet
        visible={pickerOpen}
        title={t('feed.boroughTitle')}
        testID="feed-borough-picker"
        options={[
          ...(homeDistrict
            ? [
                {
                  key: 'home',
                  label: t('feed.boroughMine', { borough: nameOf(homeDistrict) }),
                  selected: borough === 'home',
                  testID: 'feed-borough-option-home',
                },
              ]
            : []),
          {
            key: 'all',
            label: t('feed.boroughAll'),
            selected: borough === 'all' || (borough === 'home' && !homeDistrict),
            testID: 'feed-borough-option-all',
            hideWhileSearching: true,
          },
          ...districts
            .filter((d) => d.id !== homeDistrictId)
            .map((d) => ({
              key: d.id,
              label: nameOf(d),
              selected: borough === d.id,
              testID: `feed-borough-option-${d.open_north_slug}`,
            })),
        ]}
        onSelect={(key) => {
          onChangeBorough(key);
          setPickerOpen(false);
        }}
        onClose={() => setPickerOpen(false)}
      />
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: { gap: Spacing.two, paddingBottom: Spacing.two },
    searchBar: {
      marginHorizontal: Spacing.three,
      height: 40,
      borderRadius: 999,
      paddingHorizontal: 14,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.two,
      backgroundColor: theme.backgroundElement,
    },
    searchInput: { flex: 1, minWidth: 0, fontSize: 14, color: theme.text, paddingVertical: 0 },
    clearButton: {
      width: 22,
      height: 22,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.backgroundSelected,
    },
    chips: { paddingHorizontal: Spacing.three, gap: Spacing.two, alignItems: 'center' },
    chip: {
      height: 32,
      paddingHorizontal: 12,
      borderRadius: 999,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: theme.backgroundElement,
    },
    chipSelected: { backgroundColor: theme.text },
    boroughChip: { backgroundColor: theme.accent, maxWidth: 240 },
    chipText: { fontSize: 12.5, fontWeight: '600', color: theme.text, flexShrink: 1 },
    chipCount: { fontSize: 11.5, fontWeight: '700' },
    statusDot: { width: 8, height: 8, borderRadius: 4 },
  });

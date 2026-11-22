import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { type Theme, useThemedStyles } from '@/hooks/use-themed-styles';
import { getIssueSeverity, getSeverityBadgePalette } from '@/components/utils/issue-severity';
import { useIssueStatusColors } from '@/components/utils/issue-status';
import { shortStreetLabel } from '@/components/utils/map-utils';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Issue, IssueCategory } from '@/models/Issue';

import { MapIcon, type MapIconName } from './MapIcon';

export interface IssueListSheetProps {
  /** The issues currently shown on the map (already filtered). */
  issues: readonly Issue[];
  onSelectIssue: (issue: Issue) => void;
  /** District label for a row, or null when unknown. */
  districtNameFor: (issue: Issue) => string | null;
  onResetFilters: () => void;
  /** Room for the tab bar floating over the bottom of the map. */
  bottomInset?: number;
}

function categoryIcon(category: IssueCategory): MapIconName {
  switch (category) {
    case 'traffic_safety':
      return 'bike';
    case 'streetlights_utilities':
      return 'lightbulb';
    case 'roads_potholes':
    default:
      return 'pothole';
  }
}

/** Bottom sheet listing every report on the map; shown while no marker is selected. */
export function IssueListSheet({
  issues,
  onSelectIssue,
  districtNameFor,
  onResetFilters,
  bottomInset = 0,
}: IssueListSheetProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const statusColors = useIssueStatusColors();

  // Same colors as the page and the tab bar above it (theme only), so the floating iOS tab bar
  // looks the same on the map as on every other tab.
  const surfaceBg = theme.background;
  const rowBg = theme.backgroundElement;
  const primaryText = theme.text;
  const secondaryText = theme.textSecondary;
  const iconColor = theme.text;

  return (
    <View
      testID="map-issue-list"
      style={[
        styles.sheet,
        {
          backgroundColor: surfaceBg,
          shadowColor: theme.shadow,
          paddingBottom: Spacing.three + bottomInset,
        },
      ]}
    >
      <View style={[styles.dragHandle, { backgroundColor: theme.neutral200 }]} />

      {issues.length === 0 ? (
        <View testID="map-empty-sheet" style={styles.emptyContent}>
          <Text style={[styles.emptyTitle, { color: primaryText }]}>{t('map.emptyTitle')}</Text>
          <Pressable
            testID="map-reset-filters-button"
            accessibilityRole="button"
            onPress={onResetFilters}
            style={({ pressed }) => [styles.primaryCta, pressed && styles.pressed]}
          >
            <Text style={styles.primaryCtaText}>{t('map.resetFilters')}</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={styles.header}>
            <Text
              testID="map-issue-list-title"
              accessibilityRole="header"
              style={[styles.title, { color: primaryText }]}
            >
              {t('map.list.title', { count: issues.length })}
            </Text>
            <Text style={[styles.hint, { color: secondaryText }]}>{t('map.list.hint')}</Text>
          </View>

          <FlatList
            data={issues}
            keyExtractor={(issue) => issue.id}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const district = districtNameFor(item);
              const street = shortStreetLabel(item.address);
              const severity = getIssueSeverity(item);
              const severityPalette = getSeverityBadgePalette(severity.urgency, theme);
              return (
                <Pressable
                  testID={`map-list-row-${item.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={item.title}
                  onPress={() => onSelectIssue(item)}
                  style={({ pressed }) => [
                    styles.row,
                    { backgroundColor: rowBg },
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={[styles.iconCircle, { backgroundColor: surfaceBg }]}>
                    <MapIcon name={categoryIcon(item.category)} size={16} color={iconColor} />
                  </View>
                  <View style={styles.rowText}>
                    <Text numberOfLines={1} style={[styles.rowTitle, { color: primaryText }]}>
                      {item.title}
                    </Text>
                    <Text numberOfLines={1} style={[styles.rowMeta, { color: secondaryText }]}>
                      {district ? `${street} • ${district}` : street}
                    </Text>
                  </View>
                  <View
                    testID={`map-list-severity-${item.id}`}
                    style={[
                      styles.severityPill,
                      {
                        backgroundColor: severityPalette.backgroundColor,
                        borderColor: severityPalette.borderColor,
                      },
                    ]}
                  >
                    <Text
                      numberOfLines={1}
                      style={[styles.severityPillText, { color: severityPalette.textColor }]}
                    >
                      {`${severityPalette.icon} ${severity.score}/10`}
                    </Text>
                  </View>
                  <View style={styles.statusCol}>
                    <View
                      style={[styles.statusDot, { backgroundColor: statusColors[item.status] }]}
                    />
                    <Text numberOfLines={1} style={[styles.statusText, { color: secondaryText }]}>
                      {t(`issue.status.${item.status}`)}
                    </Text>
                  </View>
                </Pressable>
              );
            }}
          />
        </>
      )}
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    sheet: {
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: Spacing.three,
      paddingTop: 8,
      gap: 8,
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.14,
      shadowRadius: 14,
      elevation: 10,
      backgroundColor: 'green',
    },
    dragHandle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3 },
    header: { gap: 2 },
    title: { fontSize: 16, fontWeight: '700' },
    hint: { fontSize: 12 },
    // About three rows visible, the same height as the details card; the rest scroll.
    list: { maxHeight: 170 },
    listContent: { gap: 6 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 10,
      paddingVertical: 9,
      borderRadius: 14,
    },
    iconCircle: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowText: { flex: 1, minWidth: 0, gap: 2 },
    rowTitle: { fontSize: 14, fontWeight: '600' },
    rowMeta: { fontSize: 12 },
    severityPill: {
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: 999,
      borderWidth: 1,
    },
    severityPillText: { fontSize: 11, fontWeight: '700' },
    statusCol: { flexDirection: 'row', alignItems: 'center', gap: 5, maxWidth: 110 },
    statusDot: { width: 8, height: 8, borderRadius: 4 },
    statusText: { fontSize: 11.5, fontWeight: '600', flexShrink: 1 },
    emptyContent: { alignItems: 'center', gap: 12, paddingVertical: Spacing.three },
    emptyTitle: { fontSize: 15, fontWeight: '600', textAlign: 'center' },
    primaryCta: {
      backgroundColor: theme.neutral800,
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: 999,
    },
    primaryCtaText: { color: theme.neutral100, fontWeight: '700', fontSize: 13 },
    pressed: { opacity: 0.85 },
  });

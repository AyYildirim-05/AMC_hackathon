import { Image } from 'expo-image';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { type Theme, useThemedStyles } from '@/hooks/use-themed-styles';
import { computeInitials, formatAddress, formatIssueDate } from '@/components/utils/formatter';
import { getIssueSeverity, getSeverityBadgePalette } from '@/components/utils/issue-severity';
import { WEATHER_ELEMENT_META } from '@/components/utils/weather-elements';
import { Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Issue, IssueCategory, IssueStatus } from '@/models/Issue';

import { MapIcon, type MapIconName } from './MapIcon';

export interface IncidentPreviewSheetProps {
  issue: Issue | null;
  districtName: string | null;
  isUpvoted: boolean;
  upvoteCount: number;
  justShared?: boolean;
  onToggleUpvote: () => void;
  onShare: () => void;
  onOpenDetails: () => void;
  onResetFilters: () => void;
  /** Shows an "All reports" link that returns to the list of reports. */
  onBackToList?: () => void;
  /** Room for the tab bar floating over the bottom of the map. */
  bottomInset?: number;
}

function getCategoryIcon(category: IssueCategory): MapIconName {
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

function getStatusPillColors(status: IssueStatus, theme: Theme) {
  switch (status) {
    case 'in_progress':
      return {
        bg: theme.backgroundElement,
        text: theme.neutral800,
        dot: theme.neutral800,
      };
    case 'resolved':
      return {
        bg: theme.background,
        text: theme.neutral700,
        dot: theme.neutral600,
      };
    case 'not_started':
    default:
      return {
        bg: theme.background,
        text: theme.neutral700,
        dot: theme.neutral600,
      };
  }
}

/**
 * Bottom sheet incident preview card floating over the bottom of the map.
 * Supports peek/expanded toggle via the drag handle, upvoting, sharing, and opening full details.
 */
export function IncidentPreviewSheet({
  issue,
  districtName,
  isUpvoted,
  upvoteCount,
  justShared = false,
  onToggleUpvote,
  onShare,
  onOpenDetails,
  onResetFilters,
  onBackToList,
  bottomInset = 0,
}: IncidentPreviewSheetProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const [collapsed, setCollapsed] = useState(false);

  // Same colors as the page and the tab bar above it (theme only), so the floating iOS tab bar
  // looks the same on the map as on every other tab.
  const surfaceBg = theme.background;
  const subtleBg = theme.backgroundElement;
  const actionBg = theme.backgroundElement;
  const primaryText = theme.text;
  const secondaryText = theme.textSecondary;

  if (!issue) {
    return (
      <View
        testID="map-empty-sheet"
        style={[styles.sheet, { backgroundColor: surfaceBg, shadowColor: theme.shadow }]}
      >
        <View style={[styles.dragHandle, { backgroundColor: theme.neutral200 }]} />
        <View style={styles.emptyContent}>
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
      </View>
    );
  }

  const categoryIcon = getCategoryIcon(issue.category);
  const categoryLabel = t(`issue.category.${issue.category}`);
  const statusColors = getStatusPillColors(issue.status, theme);
  const severity = getIssueSeverity(issue);
  const severityPalette = getSeverityBadgePalette(severity.urgency, theme);
  const severityLabel = t('issue.severityBadge', {
    urgency: t(`issue.urgency.${severity.urgency}`, { defaultValue: severity.urgency }),
    score: severity.score,
    defaultValue: `${severity.urgency} • ${severity.score}/10`,
  });
  const statusLabel =
    issue.status === 'in_progress' && issue.official_response
      ? t('map.teamNotified')
      : t(`issue.status.${issue.status}`);
  const formattedDate = formatIssueDate(issue.created_at, i18n.language || 'fr');
  const formattedAddress = formatAddress(issue.address);
  const hasPhoto = issue.images.length > 0;
  const officialInitial = issue.official_response
    ? computeInitials(issue.official_response.author).slice(0, 1)
    : 'V';

  return (
    <View
      testID="map-preview-sheet"
      style={[
        styles.sheet,
        {
          backgroundColor: surfaceBg,
          shadowColor: theme.shadow,
          paddingBottom: Spacing.three + bottomInset,
        },
      ]}
    >
      {/* Drag Handle (tap toggles compact/expanded) */}
      <Pressable
        testID="map-sheet-handle"
        accessibilityRole="button"
        accessibilityLabel={collapsed ? t('map.viewRecord') : t('map.closeModal')}
        onPress={() => setCollapsed((prev) => !prev)}
        hitSlop={10}
        style={styles.handleHitArea}
      >
        <View style={[styles.dragHandle, { backgroundColor: theme.neutral200 }]} />
      </Pressable>

      {onBackToList ? (
        <Pressable
          testID="map-back-to-list"
          accessibilityRole="button"
          onPress={onBackToList}
          hitSlop={8}
          style={({ pressed }) => [styles.backLink, pressed && styles.pressed]}
        >
          <Text style={[styles.backLinkText, { color: secondaryText }]}>
            ‹ {t('map.list.back')}
          </Text>
        </Pressable>
      ) : null}

      {/* Header Row: Category Badge, Status Badge & Reference ID */}
      <View style={styles.headerRow}>
        <View style={styles.badgeGroup}>
          <View style={[styles.categoryBadge, { backgroundColor: theme.neutral200 }]}>
            <MapIcon name={categoryIcon} size={13} color={theme.text} />
            <Text style={[styles.categoryBadgeText, { color: theme.text }]}>{categoryLabel}</Text>
          </View>

          <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColors.dot }]} />
            <Text style={[styles.statusBadgeText, { color: statusColors.text }]}>
              {statusLabel}
            </Text>
          </View>

          <View
            testID="map-preview-severity-badge"
            style={[
              styles.categoryBadge,
              {
                backgroundColor: severityPalette.backgroundColor,
                borderWidth: 1,
                borderColor: severityPalette.borderColor,
              },
            ]}
          >
            <Text style={styles.elementIcon}>{severityPalette.icon}</Text>
            <Text style={[styles.categoryBadgeText, { color: severityPalette.textColor }]}>
              {severityLabel}
            </Text>
          </View>

          {(issue.elements ?? []).map((el) => {
            const meta = WEATHER_ELEMENT_META[el];
            return (
              <View
                key={el}
                testID={`map-preview-element-${el}`}
                style={[styles.categoryBadge, { backgroundColor: theme.background }]}
              >
                <Text style={styles.elementIcon}>{meta.icon}</Text>
                <Text style={[styles.categoryBadgeText, { color: theme.accent800 }]}>
                  {t(`issue.elements.${el}`, { defaultValue: meta.fallbackLabel })}
                </Text>
              </View>
            );
          })}
        </View>

        {issue.external_311_ref ? (
          <Text style={[styles.refCode, { color: secondaryText }]}>#{issue.external_311_ref}</Text>
        ) : null}
      </View>

      {/* Main Body: Image Thumbnail + Core Issue Description (tap opens full record) */}
      <Pressable
        testID="map-preview-body"
        accessibilityRole="button"
        accessibilityLabel={issue.title}
        onPress={onOpenDetails}
        style={({ pressed }) => [styles.bodyRow, pressed && styles.pressed]}
      >
        <View style={[styles.thumbnailBox, { backgroundColor: subtleBg }]}>
          {hasPhoto ? (
            <>
              <Image
                source={{ uri: issue.images[0] }}
                style={styles.thumbnailImage}
                contentFit="cover"
                accessibilityLabel={issue.title}
              />
              <View style={styles.photoCountBadge}>
                <MapIcon name="camera" size={10} color={theme.neutral100} />
                <Text style={styles.photoCountText}>{issue.images.length}</Text>
              </View>
            </>
          ) : (
            <View style={styles.placeholderThumb}>
              <MapIcon name={categoryIcon} size={28} color={theme.neutral700} />
            </View>
          )}
        </View>

        <View style={styles.bodyMeta}>
          <Text
            numberOfLines={collapsed ? 1 : 2}
            style={[styles.issueTitle, { color: primaryText }]}
          >
            {issue.title}
          </Text>

          <View style={styles.addressRow}>
            <MapIcon name="location" size={14} color={theme.neutral700} />
            <Text numberOfLines={1} style={[styles.addressText, { color: secondaryText }]}>
              {formattedAddress}
            </Text>
          </View>

          <View style={styles.subMetaRow}>
            {formattedDate ? (
              <Text style={[styles.dateMeta, { color: secondaryText }]}>
                {t('map.reportedOn', { date: formattedDate })}
              </Text>
            ) : null}
            {formattedDate && districtName ? (
              <Text style={[styles.dotSep, { color: secondaryText }]}>•</Text>
            ) : null}
            {districtName ? (
              <Text numberOfLines={1} style={[styles.boroughMeta, { color: theme.neutral800 }]}>
                {districtName}
              </Text>
            ) : null}
          </View>
        </View>
      </Pressable>

      {/* Official Borough Team Update Excerpt (hidden when collapsed) */}
      {!collapsed && issue.official_response ? (
        <View style={[styles.officialCard, { backgroundColor: subtleBg }]}>
          <View style={[styles.officialAvatar, { backgroundColor: theme.neutral200 }]}>
            <Text style={[styles.officialInitial, { color: theme.text }]}>{officialInitial}</Text>
          </View>
          <View style={styles.officialBody}>
            <View style={styles.officialHeader}>
              <Text numberOfLines={1} style={[styles.officialAuthor, { color: primaryText }]}>
                {districtName ?? issue.official_response.author}
              </Text>
              <MapIcon name="verified" size={13} color={theme.neutral700} />
            </View>
            <Text numberOfLines={1} style={[styles.officialQuote, { color: secondaryText }]}>
              « {issue.official_response.comment} »
            </Text>
          </View>
        </View>
      ) : null}

      {/* Interaction & Action Buttons */}
      <View style={styles.actionsRow}>
        {/* Upvote / Endorse Button */}
        <Pressable
          testID="map-preview-upvote"
          accessibilityRole="button"
          accessibilityLabel={t('map.upvoteAction')}
          accessibilityState={{ selected: isUpvoted }}
          onPress={onToggleUpvote}
          style={({ pressed }) => [
            styles.upvoteBtn,
            {
              backgroundColor: isUpvoted ? theme.neutral200 : actionBg,
            },
            pressed && styles.pressed,
          ]}
        >
          <MapIcon
            name="thumbUp"
            size={16}
            color={isUpvoted ? theme.neutral800 : theme.neutral700}
          />
          <Text
            style={[
              styles.upvoteText,
              {
                color: isUpvoted ? theme.text : primaryText,
              },
            ]}
          >
            {upvoteCount}
          </Text>
        </Pressable>

        {/* Share Button */}
        <Pressable
          testID="map-preview-share"
          accessibilityRole="button"
          accessibilityLabel={t('map.shareAction')}
          onPress={onShare}
          style={({ pressed }) => [
            styles.shareBtn,
            {
              backgroundColor: justShared ? theme.neutral200 : actionBg,
            },
            pressed && styles.pressed,
          ]}
        >
          <MapIcon
            name={justShared ? 'verified' : 'share'}
            size={17}
            color={justShared ? theme.neutral800 : secondaryText}
          />
        </Pressable>

        {/* Primary Action Button: View Full Incident Record */}
        <Pressable
          testID="map-preview-view-record"
          accessibilityRole="button"
          onPress={onOpenDetails}
          style={({ pressed }) => [styles.primaryCta, pressed && styles.pressed]}
        >
          <Text style={styles.primaryCtaText}>{t('map.viewRecord')}</Text>
          <MapIcon name="arrowForward" size={16} color={theme.neutral200} />
        </Pressable>
      </View>
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
      paddingBottom: Spacing.three,
      gap: 10,
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.14,
      shadowRadius: 14,
      elevation: 10,
    },
    backLink: { alignSelf: 'flex-start' },
    backLinkText: { fontSize: 13, fontWeight: '600' },
    handleHitArea: {
      alignItems: 'center',
      paddingVertical: 4,
    },
    dragHandle: {
      width: 40,
      height: 5,
      borderRadius: 999,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    badgeGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 6,
      flexShrink: 1,
    },
    categoryBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
    },
    categoryBadgeText: {
      fontSize: 11,
      fontWeight: '600',
    },
    elementIcon: {
      fontSize: 11,
    },
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999,
    },
    statusDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    statusBadgeText: {
      fontSize: 11,
      fontWeight: '600',
    },
    refCode: {
      fontSize: 10.5,
      fontWeight: '600',
      fontFamily: Fonts.mono,
      flexShrink: 0,
    },
    bodyRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
    },
    thumbnailBox: {
      width: 76,
      height: 76,
      borderRadius: 12,
      overflow: 'hidden',
      position: 'relative',
    },
    thumbnailImage: {
      width: '100%',
      height: '100%',
    },
    placeholderThumb: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    photoCountBadge: {
      position: 'absolute',
      bottom: 4,
      right: 4,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      backgroundColor: `${theme.neutral800}D6`,
      paddingHorizontal: 5,
      paddingVertical: 2,
      borderRadius: 5,
    },
    photoCountText: {
      color: theme.neutral100,
      fontSize: 9.5,
      fontWeight: '700',
      fontFamily: Fonts.mono,
    },
    bodyMeta: {
      flex: 1,
      minWidth: 0,
      gap: 3,
    },
    issueTitle: {
      fontSize: 15.5,
      lineHeight: 20,
      fontWeight: '700',
    },
    addressRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    addressText: {
      fontSize: 12,
      flexShrink: 1,
    },
    subMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 1,
    },
    dateMeta: {
      fontSize: 11,
      opacity: 0.85,
    },
    dotSep: {
      fontSize: 11,
      opacity: 0.6,
    },
    boroughMeta: {
      fontSize: 11,
      fontWeight: '600',
      flexShrink: 1,
    },
    officialCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 12,
    },
    officialAvatar: {
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    officialInitial: {
      fontSize: 11,
      fontWeight: '700',
    },
    officialBody: {
      flex: 1,
      minWidth: 0,
    },
    officialHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    officialAuthor: {
      fontSize: 12,
      fontWeight: '700',
      flexShrink: 1,
    },
    officialQuote: {
      fontSize: 11.5,
      lineHeight: 16,
    },
    actionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingTop: 2,
    },
    upvoteBtn: {
      height: 44,
      paddingHorizontal: 14,
      borderRadius: 999,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    upvoteText: {
      fontSize: 13,
      fontWeight: '700',
    },
    shareBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryCta: {
      flex: 1,
      height: 44,
      borderRadius: 999,
      backgroundColor: theme.neutral800,
      paddingHorizontal: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    primaryCtaText: {
      color: theme.neutral200,
      fontSize: 13.5,
      fontWeight: '700',
      letterSpacing: 0.2,
    },
    emptyContent: {
      alignItems: 'center',
      paddingVertical: 14,
      gap: 12,
    },
    emptyTitle: {
      fontSize: 15,
      fontWeight: '600',
    },
    pressed: {
      opacity: 0.85,
      transform: [{ scale: 0.98 }],
    },
  });

import { Image } from 'expo-image';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { computeInitials, formatAddress, formatIssueDate } from '@/components/utils/formatter';
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

function getStatusPillColors(status: IssueStatus, isDark: boolean) {
  switch (status) {
    case 'in_progress':
      return {
        bg: isDark ? '#183827' : '#E3EFE7',
        text: isDark ? '#A6E3B9' : '#14532D',
        dot: isDark ? '#86EFAC' : '#14532D',
      };
    case 'resolved':
      return {
        bg: isDark ? '#0F3824' : '#DCFCE7',
        text: isDark ? '#86EFAC' : '#15803D',
        dot: '#16A34A',
      };
    case 'not_started':
    default:
      return {
        bg: isDark ? '#28322D' : '#EEF2F0',
        text: isDark ? '#CBD5E1' : '#475569',
        dot: '#64748B',
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
}: IncidentPreviewSheetProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const isDark = theme.text !== '#1C211F';
  const [collapsed, setCollapsed] = useState(false);

  const surfaceBg = isDark ? '#212A25' : '#FFFFFF';
  const subtleBg = isDark ? '#2A362F' : '#F0F5F1';
  const actionBg = isDark ? '#2D3A33' : '#EAEFEB';
  const primaryText = isDark ? '#ECF4EF' : '#181D1B';
  const secondaryText = isDark ? '#9ECEB0' : '#434844';

  if (!issue) {
    return (
      <View
        testID="map-empty-sheet"
        style={[styles.sheet, { backgroundColor: surfaceBg, shadowColor: theme.shadow }]}
      >
        <View style={[styles.dragHandle, { backgroundColor: isDark ? '#3B4B42' : '#DFE4E0' }]} />
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
  const statusColors = getStatusPillColors(issue.status, isDark);
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
      style={[styles.sheet, { backgroundColor: surfaceBg, shadowColor: theme.shadow }]}
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
        <View style={[styles.dragHandle, { backgroundColor: isDark ? '#3B4B42' : '#DFE4E0' }]} />
      </Pressable>

      {/* Header Row: Category Badge, Status Badge & Reference ID */}
      <View style={styles.headerRow}>
        <View style={styles.badgeGroup}>
          <View style={[styles.categoryBadge, { backgroundColor: isDark ? '#2B4A39' : '#C6EBD3' }]}>
            <MapIcon name={categoryIcon} size={13} color={isDark ? '#D7F5E2' : '#002112'} />
            <Text style={[styles.categoryBadgeText, { color: isDark ? '#D7F5E2' : '#002112' }]}>
              {categoryLabel}
            </Text>
          </View>

          <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColors.dot }]} />
            <Text style={[styles.statusBadgeText, { color: statusColors.text }]}>
              {statusLabel}
            </Text>
          </View>
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
                <MapIcon name="camera" size={10} color="#FFFFFF" />
                <Text style={styles.photoCountText}>{issue.images.length}</Text>
              </View>
            </>
          ) : (
            <View style={styles.placeholderThumb}>
              <MapIcon name={categoryIcon} size={28} color={isDark ? '#A6E3B9' : '#446552'} />
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
            <MapIcon name="location" size={14} color={isDark ? '#8CB69C' : '#446552'} />
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
              <Text
                numberOfLines={1}
                style={[styles.boroughMeta, { color: isDark ? '#C6EBD3' : '#39473F' }]}
              >
                {districtName}
              </Text>
            ) : null}
          </View>
        </View>
      </Pressable>

      {/* Official Borough Team Update Excerpt (hidden when collapsed) */}
      {!collapsed && issue.official_response ? (
        <View style={[styles.officialCard, { backgroundColor: subtleBg }]}>
          <View
            style={[styles.officialAvatar, { backgroundColor: isDark ? '#2B4A39' : '#C6EBD3' }]}
          >
            <Text style={[styles.officialInitial, { color: isDark ? '#D7F5E2' : '#002112' }]}>
              {officialInitial}
            </Text>
          </View>
          <View style={styles.officialBody}>
            <View style={styles.officialHeader}>
              <Text numberOfLines={1} style={[styles.officialAuthor, { color: primaryText }]}>
                {districtName ?? issue.official_response.author}
              </Text>
              <MapIcon name="verified" size={13} color={isDark ? '#86EFAC' : '#446552'} />
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
              backgroundColor: isUpvoted ? (isDark ? '#1F4D36' : '#C6EBD3') : actionBg,
            },
            pressed && styles.pressed,
          ]}
        >
          <MapIcon
            name="thumbUp"
            size={16}
            color={isUpvoted ? (isDark ? '#86EFAC' : '#14532D') : isDark ? '#A6E3B9' : '#446552'}
          />
          <Text
            style={[
              styles.upvoteText,
              { color: isUpvoted ? (isDark ? '#ECFDF5' : '#002112') : primaryText },
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
              backgroundColor: justShared ? (isDark ? '#1F4D36' : '#C6EBD3') : actionBg,
            },
            pressed && styles.pressed,
          ]}
        >
          <MapIcon
            name={justShared ? 'verified' : 'share'}
            size={17}
            color={justShared ? (isDark ? '#86EFAC' : '#14532D') : secondaryText}
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
          <MapIcon name="arrowForward" size={16} color="#C6EBD3" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
    backgroundColor: 'rgba(57, 71, 63, 0.84)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 5,
  },
  photoCountText: {
    color: '#FFFFFF',
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
    backgroundColor: '#39473F',
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryCtaText: {
    color: '#C6EBD3',
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

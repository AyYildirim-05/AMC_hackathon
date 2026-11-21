import { Image } from 'expo-image';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ThemedButton } from '@/components/themed-button';
import { ThemedCard } from '@/components/themed-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type IssueCardProps = {
  id: string;
  title: string;
  description: string;
  category: string;
  categoryLabel: string;
  status: string;
  statusLabel: string;
  images: string[];
  address: string;
  authorUsername: string;
  authorInitials: string;
  dateLabel: string;
  districtName: string;
  districtTypeLabel: string;
  districtSlug: string;
  isDistrictClaimed: boolean;
  isOutOfDistrict: boolean;
  external311Ref: string | null;
  officialResponse: {
    username: string;
    roleLabel: string;
    body: string;
  } | null;
  upvoteCount: number;
  resolutionConfirmations: number;
  commentCount: number;
  isUpvoted: boolean;
  isResolvedConfirmed: boolean;
  isFollowing: boolean;
  onToggleUpvote: (id: string) => void;
  onToggleConfirmResolved: (id: string) => void;
  onToggleFollow: (id: string) => void;
  onPressCard?: (id: string) => void;
};

const categoryIconMap: Record<string, SymbolViewProps['name']> = {
  roads_potholes: { ios: 'exclamationmark.triangle', android: 'car_crash', web: 'car_crash' },
  snow_ice: { ios: 'snowflake', android: 'ac_unit', web: 'ac_unit' },
  trash_cleanliness: { ios: 'trash', android: 'delete', web: 'delete' },
  parks_trees: { ios: 'leaf', android: 'park', web: 'park' },
  traffic_safety: { ios: 'bicycle', android: 'pedal_bike', web: 'pedal_bike' },
  streetlights_utilities: {
    ios: 'figure.roll',
    android: 'accessible_forward',
    web: 'accessible_forward',
  },
  other: { ios: 'ellipsis.circle', android: 'more_horiz', web: 'more_horiz' },
};

function IssuePhoto({ uri, style }: { uri: string; style: object }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [failed, setFailed] = useState(false);

  if (failed) {
    const filename = uri.split('/').pop() ?? uri;
    return (
      <ThemedView type="backgroundSelected" style={[style, styles.photoFallback]}>
        <SymbolView
          name={{ ios: 'photo', android: 'image', web: 'image' }}
          size={24}
          tintColor={theme.textSecondary}
        />
        <ThemedText type="caption" tone="secondary" numberOfLines={1} style={styles.fallbackLabel}>
          {filename || t('feed.card.photoUnavailable')}
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <Image source={{ uri }} style={style} contentFit="cover" onError={() => setFailed(true)} />
  );
}

export function IssueCard({
  id,
  title,
  description,
  category,
  categoryLabel,
  status,
  statusLabel,
  images,
  address,
  authorUsername,
  authorInitials,
  dateLabel,
  districtName,
  districtTypeLabel,
  districtSlug,
  isDistrictClaimed,
  isOutOfDistrict,
  external311Ref,
  officialResponse,
  upvoteCount,
  resolutionConfirmations,
  commentCount,
  isUpvoted,
  isResolvedConfirmed,
  isFollowing,
  onToggleUpvote,
  onToggleConfirmResolved,
  onToggleFollow,
  onPressCard,
}: IssueCardProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const statusTone = getStatusStyle(status, theme);

  const outOfDistrictBanner = isOutOfDistrict ? (
    <ThemedView type="backgroundSelected" style={styles.outOfDistrictRibbon}>
      <View style={styles.outOfDistrictLeft}>
        <SymbolView
          name={{ ios: 'arrow.triangle.swap', android: 'swap_calls', web: 'swap_calls' }}
          size={13}
          tintColor={theme.accent}
        />
        <ThemedText
          type="caption"
          weight="semibold"
          numberOfLines={1}
          style={styles.outOfDistrictLabel}
        >
          {t('feed.card.outOfDistrict')}
        </ThemedText>
        <ThemedText
          type="caption"
          tone="secondary"
          numberOfLines={1}
          style={styles.outOfDistrictName}
        >
          • {districtTypeLabel} {districtName}
        </ThemedText>
      </View>
      <ThemedText type="code" tone="secondary" numberOfLines={1} style={styles.slugCode}>
        {districtSlug}
      </ThemedText>
    </ThemedView>
  ) : null;

  return (
    <ThemedCard
      variant="elevated"
      padding="medium"
      media={outOfDistrictBanner}
      onPress={onPressCard ? () => onPressCard(id) : undefined}
      style={styles.card}
    >
      {/* Author Meta & Status Pill */}
      <View style={styles.metaRow}>
        <View style={styles.authorGroup}>
          <ThemedView type="backgroundSelected" style={styles.initialsCircle}>
            <ThemedText type="caption" weight="bold" themeColor="text">
              {authorInitials}
            </ThemedText>
          </ThemedView>

          <View style={styles.authorDetails}>
            <View style={styles.authorNameRow}>
              <ThemedText type="caption" weight="semibold" numberOfLines={1}>
                @{authorUsername}
              </ThemedText>
              <ThemedText type="caption" tone="secondary">
                • {dateLabel}
              </ThemedText>
            </View>
            <View style={styles.locationRow}>
              <SymbolView
                name={{ ios: 'mappin', android: 'location_on', web: 'location_on' }}
                size={12}
                tintColor={theme.textSecondary}
              />
              <ThemedText type="caption" tone="secondary" numberOfLines={1} style={styles.address}>
                {address}
              </ThemedText>
            </View>
          </View>
        </View>

        <View
          style={[
            styles.statusPill,
            { backgroundColor: statusTone.bg, borderColor: statusTone.border },
          ]}
        >
          <View style={[styles.statusDot, { backgroundColor: statusTone.dot }]} />
          <ThemedText
            type="caption"
            weight="semibold"
            style={[styles.statusText, { color: statusTone.text }]}
          >
            {statusLabel}
          </ThemedText>
        </View>
      </View>

      {/* Title & Description */}
      <View style={styles.textBlock}>
        <ThemedText type="cardTitle" style={styles.cardTitle}>
          {title}
        </ThemedText>
        <ThemedText type="cardBody" numberOfLines={2}>
          {description}
        </ThemedText>
      </View>

      {/* Media: 1 full photo or 2-column grid */}
      {images.length === 1 ? (
        <View style={[styles.singleImageWrap, { backgroundColor: theme.backgroundSelected }]}>
          <IssuePhoto uri={images[0]} style={styles.singleImage} />
          <View style={[styles.photoBadge, { backgroundColor: theme.border }]}>
            <SymbolView
              name={{ ios: 'camera', android: 'photo_camera', web: 'photo_camera' }}
              size={12}
              tintColor={theme.buttonText}
            />
            <ThemedText type="caption" themeColor="buttonText" style={styles.photoBadgeText}>
              {t('feed.card.photoCount', { count: 1 })}
            </ThemedText>
          </View>
        </View>
      ) : null}

      {images.length >= 2 ? (
        <View style={styles.multiImageRow}>
          <View style={[styles.gridImageWrap, { backgroundColor: theme.backgroundSelected }]}>
            <IssuePhoto uri={images[0]} style={styles.gridImage} />
          </View>
          <View style={[styles.gridImageWrap, { backgroundColor: theme.backgroundSelected }]}>
            <IssuePhoto uri={images[1]} style={styles.gridImage} />
            <View style={styles.moreBadge}>
              <ThemedText type="caption" weight="bold" style={styles.moreOverlayText}>
                {t('feed.card.morePhotos', { count: images.length - 1 })}
              </ThemedText>
            </View>
          </View>
        </View>
      ) : null}

      {/* Official District Manager Response */}
      {officialResponse ? (
        <ThemedView
          type="background"
          style={[styles.officialBox, { borderColor: theme.backgroundSelected }]}
        >
          <View
            style={[
              styles.officialIcon,
              {
                backgroundColor: isDistrictClaimed
                  ? theme.primaryBtnBackground
                  : theme.backgroundSelected,
              },
            ]}
          >
            <SymbolView
              name={
                isDistrictClaimed
                  ? { ios: 'checkmark.seal.fill', android: 'verified', web: 'verified' }
                  : { ios: 'wrench.and.screwdriver', android: 'engineering', web: 'engineering' }
              }
              size={13}
              tintColor={isDistrictClaimed ? theme.buttonText : theme.text}
            />
          </View>
          <View style={styles.officialBody}>
            <View style={styles.officialHeader}>
              <ThemedText type="caption" weight="bold" tone="accent">
                {officialResponse.username}
              </ThemedText>
              <ThemedView type="backgroundSelected" style={styles.rolePill}>
                <ThemedText type="caption" weight="semibold" style={styles.roleText}>
                  {officialResponse.roleLabel} • {districtName}
                </ThemedText>
              </ThemedView>
            </View>
            <ThemedText type="caption" tone="secondary" italic numberOfLines={2}>
              &ldquo;{officialResponse.body}&rdquo;
            </ThemedText>
          </View>
        </ThemedView>
      ) : null}

      {/* Category Pill + 311 Ref + Unclaimed Badge */}
      <View style={styles.tagsRow}>
        <ThemedView type="background" style={styles.tagPill}>
          <SymbolView
            name={categoryIconMap[category] ?? categoryIconMap.other}
            size={12}
            tintColor={theme.accent}
          />
          <ThemedText type="caption" weight="medium" tone="secondary">
            {categoryLabel}
          </ThemedText>
        </ThemedView>

        {external311Ref ? (
          <ThemedView type="background" style={styles.tagPill}>
            <ThemedText type="code" tone="secondary" style={styles.refCode}>
              {external311Ref}
            </ThemedText>
          </ThemedView>
        ) : null}

        {!isDistrictClaimed ? (
          <ThemedView type="backgroundSelected" style={styles.tagPill}>
            <ThemedText type="caption" weight="semibold">
              {districtName} ({t('feed.district.unclaimed')})
            </ThemedText>
          </ThemedView>
        ) : null}
      </View>

      {/* Actions Footer */}
      <View style={[styles.actionsRow, { borderTopColor: theme.backgroundSelected }]}>
        <View style={styles.leftActions}>
          <ThemedButton
            type={isUpvoted ? 'primary' : 'border'}
            size="small"
            rounded
            onPress={() => onToggleUpvote(id)}
            style={styles.compactBtn}
            textStyle={styles.compactBtnText}
            icon={
              <SymbolView
                name={{
                  ios: isUpvoted ? 'hand.thumbsup.fill' : 'hand.thumbsup',
                  android: 'thumb_up',
                  web: 'thumb_up',
                }}
                size={14}
                tintColor={isUpvoted ? theme.buttonText : theme.accent}
              />
            }
          >
            {String(upvoteCount)}
          </ThemedButton>

          {status === 'in_progress' ? (
            <ThemedButton
              type={isResolvedConfirmed ? 'primary' : 'border'}
              tone="success"
              size="small"
              rounded
              onPress={() => onToggleConfirmResolved(id)}
              style={styles.compactBtn}
              textStyle={styles.compactBtnText}
              icon={
                <SymbolView
                  name={{ ios: 'checkmark.circle', android: 'check_circle', web: 'check_circle' }}
                  size={14}
                  tintColor={isResolvedConfirmed ? theme.buttonText : theme.success}
                />
              }
            >
              {t('feed.card.resolvedCount', { count: resolutionConfirmations })}
            </ThemedButton>
          ) : null}

          {upvoteCount === 0 && status === 'not_started' ? (
            <ThemedText type="caption" tone="secondary" numberOfLines={1} style={styles.hintText}>
              {t('feed.card.firstToSupport')}
            </ThemedText>
          ) : null}
        </View>

        {commentCount > 0 ? (
          <ThemedButton
            type="text"
            tone="neutral"
            size="small"
            style={styles.secondaryActionBtn}
            textStyle={styles.compactBtnText}
            onPress={onPressCard ? () => onPressCard(id) : undefined}
            icon={
              <SymbolView
                name={{
                  ios: 'bubble.left',
                  android: 'chat_bubble_outline',
                  web: 'chat_bubble_outline',
                }}
                size={14}
                tintColor={theme.textSecondary}
              />
            }
          >
            {t('feed.card.commentsCount', { count: commentCount })}
          </ThemedButton>
        ) : (
          <ThemedButton
            type="text"
            tone="accent"
            size="small"
            iconPosition="right"
            style={styles.secondaryActionBtn}
            textStyle={styles.compactBtnText}
            onPress={() => onToggleFollow(id)}
            icon={
              <SymbolView
                name={{
                  ios: 'bell',
                  android: isFollowing ? 'notifications' : 'notifications_none',
                  web: isFollowing ? 'notifications' : 'notifications_none',
                }}
                size={14}
                tintColor={theme.accent}
              />
            }
          >
            {isFollowing ? t('feed.card.following') : t('feed.card.follow')}
          </ThemedButton>
        )}
      </View>
    </ThemedCard>
  );
}

function getStatusStyle(status: string, theme: ReturnType<typeof useTheme>) {
  switch (status) {
    case 'in_progress':
      return {
        bg: theme.background,
        border: theme.danger,
        dot: theme.danger,
        text: theme.danger,
      };
    case 'completed':
      return {
        bg: theme.success,
        border: theme.success,
        dot: theme.buttonText,
        text: theme.buttonText,
      };
    case 'cancelled':
      return {
        bg: theme.background,
        border: theme.danger,
        dot: theme.danger,
        text: theme.danger,
      };
    case 'postponed':
    case 'not_started':
    default:
      return {
        bg: theme.background,
        border: theme.backgroundSelected,
        dot: theme.textSecondary,
        text: theme.textSecondary,
      };
  }
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Spacing.three,
  },
  outOfDistrictRibbon: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + Spacing.half,
    gap: Spacing.two,
  },
  outOfDistrictLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
  },
  outOfDistrictLabel: {
    flexShrink: 0,
  },
  outOfDistrictName: {
    flexShrink: 1,
  },
  slugCode: {
    fontSize: 10,
    flexShrink: 1,
    maxWidth: '34%',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  authorGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    flex: 1,
    minWidth: 0,
  },
  initialsCircle: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  authorDetails: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  authorNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  address: {
    flexShrink: 1,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
  },
  statusText: {
    fontSize: 11,
    lineHeight: 14,
  },
  textBlock: {
    gap: Spacing.one,
  },
  cardTitle: {
    lineHeight: 23,
  },
  singleImageWrap: {
    width: '100%',
    height: 176,
    borderRadius: Spacing.two + Spacing.one,
    overflow: 'hidden',
    position: 'relative',
  },
  singleImage: {
    width: '100%',
    height: '100%',
  },
  photoFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.three,
    gap: Spacing.one,
  },
  fallbackLabel: {
    maxWidth: '90%',
  },
  photoBadge: {
    position: 'absolute',
    left: Spacing.two,
    bottom: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
    borderRadius: Spacing.one + Spacing.half,
    opacity: 0.9,
  },
  photoBadgeText: {
    fontSize: 11,
    lineHeight: 14,
  },
  multiImageRow: {
    flexDirection: 'row',
    gap: Spacing.one + Spacing.half,
  },
  gridImageWrap: {
    flex: 1,
    height: 116,
    borderRadius: Spacing.two + Spacing.one,
    overflow: 'hidden',
    position: 'relative',
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },
  moreBadge: {
    position: 'absolute',
    right: Spacing.two,
    bottom: Spacing.two,
    backgroundColor: 'rgba(28, 33, 31, 0.72)',
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
    borderRadius: Spacing.one + Spacing.half,
  },
  moreOverlayText: {
    color: '#FFFFFF',
    fontSize: 11,
    lineHeight: 14,
  },
  officialBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    padding: Spacing.two + Spacing.half,
    borderRadius: Spacing.two + Spacing.one,
    borderWidth: StyleSheet.hairlineWidth,
  },
  officialIcon: {
    width: 24,
    height: 24,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  officialBody: {
    flex: 1,
    gap: Spacing.half,
  },
  officialHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  rolePill: {
    paddingHorizontal: Spacing.one + Spacing.half,
    paddingVertical: 1,
    borderRadius: Spacing.one,
  },
  roleText: {
    fontSize: 10,
    lineHeight: 13,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one + Spacing.half,
  },
  tagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.two,
  },
  refCode: {
    fontSize: 11,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingTop: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  leftActions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.two,
    flex: 1,
  },
  compactBtn: {
    minHeight: 32,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two + Spacing.one,
  },
  compactBtnText: {
    fontSize: 12,
    lineHeight: 16,
  },
  secondaryActionBtn: {
    minHeight: 32,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.one + Spacing.half,
  },
  hintText: {
    flexShrink: 1,
  },
});

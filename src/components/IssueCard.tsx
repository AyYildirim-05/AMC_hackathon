import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { Pressable, type StyleProp, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  type Issue,
  type IssueAuthor,
  type IssueCategory,
  type IssueStatus,
  type OfficialResponse,
} from '@/models/Issue';
import { computeInitials, formatAddress, formatIssueDate } from './utils/formatter';

export { computeInitials, formatAddress, formatIssueDate };
export type { IssueAuthor, OfficialResponse };

export interface IssueCardProps {
  /** The issue domain model. */
  issue: Issue;
  /** Accessibility label for the card button when pressable. Defaults to issue title. */
  accessibilityLabel?: string;
  /** Callback when tapping the whole card. */
  onPress?: () => void;
  /** Callback when tapping the upvote button. */
  onUpvote?: () => void;
  /** Callback when tapping the resolution confirmation button. */
  onConfirmResolution?: () => void;
  /** Callback when tapping the comment counter. */
  onCommentsPress?: () => void;
  /** Callback when tapping the attached photo. */
  onImagePress?: (index: number) => void;
  /** Whether the current user has upvoted. */
  isUpvoted?: boolean;
  /** Whether the current user has confirmed resolution. */
  isConfirmed?: boolean;
  /** Maximum number of description lines before truncation (defaults to 3). */
  descriptionNumberOfLines?: number;
  /** Additional container styles. */
  style?: StyleProp<ViewStyle>;
  /** Optional testID. */
  testID?: string;
}

/** Subtle native location pin icon matching the design. */
function PinIcon({ color }: { color: string }) {
  return (
    <View style={styles.pinContainer}>
      <View style={[styles.pinCircle, { borderColor: color }]} />
      <View style={[styles.pinPoint, { borderTopColor: color }]} />
    </View>
  );
}

/** Native comment bubble icon. */
function CommentBubbleIcon({ color }: { color: string }) {
  return (
    <View style={styles.bubbleContainer}>
      <View style={[styles.bubbleBody, { borderColor: color }]} />
      <View style={[styles.bubbleTail, { borderTopColor: color }]} />
    </View>
  );
}

export function IssueCard({
  issue,
  accessibilityLabel,
  onPress,
  onUpvote,
  onConfirmResolution,
  onCommentsPress,
  onImagePress,
  isUpvoted = false,
  isConfirmed = false,
  descriptionNumberOfLines = 3,
  style,
  testID,
}: IssueCardProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const isDark = theme.text !== '#1C211F';

  // Safe translation helper with fallback if translation returns raw key or fails
  const translateSafe = (key: string, fallback: string): string => {
    try {
      const res = (t as unknown as (k: string) => string)(key);
      return res && res !== key ? String(res) : fallback;
    } catch {
      return fallback;
    }
  };

  // 1. Author directly from issue
  const author = issue.author;
  const authorHandle = author?.username ?? 'citoyen';
  const authorInitials =
    author?.initials ??
    (author?.name ? computeInitials(author.name) : undefined) ??
    computeInitials(authorHandle);

  // 2. Official response directly from issue
  const officialResponse = issue.official_response ?? null;

  // 3. Comments count directly from issue
  const commentsCount = issue.comments_count ?? 0;

  // 4. Format date and address
  const formattedDate = formatIssueDate(issue.created_at, i18n?.language || 'fr');
  const formattedAddress = formatAddress(issue.address);

  // 5. Status styling
  const statusConfig = getStatusConfig(issue.status, translateSafe, isDark);

  // 6. Category styling & icon
  const categoryConfig = getCategoryConfig(issue.category, translateSafe);

  // 7. Interactive wrappers
  const isCardPressable = Boolean(onPress);

  return (
    <Pressable
      testID={testID}
      accessibilityRole={isCardPressable ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel ?? issue.title}
      disabled={!isCardPressable}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: isDark ? '#232B27' : '#FFFFFF',
          borderColor: isDark ? '#35433C' : '#E5E7EB',
          shadowColor: theme.shadow,
        },
        pressed && isCardPressable && styles.cardPressed,
        style,
      ]}
    >
      {/* ─── Header: Avatar, User, Date, Location & Status ─── */}
      <View style={styles.headerRow}>
        <View style={styles.headerUserInfo}>
          {/* Avatar */}
          <View style={[styles.avatar, { backgroundColor: isDark ? '#33443C' : '#DDE8E2' }]}>
            {author?.avatarUrl || author?.avatar_url ? (
              <Image
                source={{ uri: author.avatarUrl ?? author.avatar_url }}
                style={styles.avatarImage}
              />
            ) : (
              <ThemedText
                style={[styles.avatarInitials, { color: isDark ? '#C7E2D3' : '#23382D' }]}
              >
                {authorInitials}
              </ThemedText>
            )}
          </View>

          {/* User Details */}
          <View style={styles.headerTextGroup}>
            <View style={styles.userHandleRow}>
              <Text style={[styles.userHandle, { color: isDark ? '#E5F2EA' : '#1C211F' }]}>
                @{authorHandle}
              </Text>
              {formattedDate ? (
                <>
                  <Text style={[styles.separatorDot, { color: isDark ? '#8CB69C' : '#698875' }]}>
                    •
                  </Text>
                  <Text style={[styles.dateText, { color: isDark ? '#8CB69C' : '#698875' }]}>
                    {formattedDate}
                  </Text>
                </>
              ) : null}
            </View>

            {formattedAddress ? (
              <View style={styles.addressRow}>
                <PinIcon color={isDark ? '#8CB69C' : '#698875'} />
                <Text
                  numberOfLines={1}
                  ellipsizeMode="tail"
                  style={[styles.addressText, { color: isDark ? '#8CB69C' : '#698875' }]}
                >
                  {formattedAddress}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Status Badge */}
        <View
          style={[
            styles.statusBadge,
            {
              backgroundColor: statusConfig.backgroundColor,
              borderColor: statusConfig.borderColor,
            },
          ]}
        >
          <View style={[styles.statusDot, { backgroundColor: statusConfig.dotColor }]} />
          <Text style={[styles.statusText, { color: statusConfig.textColor }]}>
            {statusConfig.label}
          </Text>
        </View>
      </View>

      {/* ─── Title & Description ─── */}
      <View style={styles.contentSection}>
        <ThemedText
          type="cardTitle"
          style={[styles.title, { color: isDark ? '#E5F2EA' : '#1C211F' }]}
        >
          {issue.title}
        </ThemedText>

        {issue.description ? (
          <ThemedText
            numberOfLines={descriptionNumberOfLines}
            style={[styles.description, { color: isDark ? '#9ECEB0' : '#495C51' }]}
          >
            {issue.description}
          </ThemedText>
        ) : null}
      </View>

      {/* ─── Attached Photo(s) ─── */}
      {issue.images && issue.images.length > 0 ? (
        <Pressable
          testID="issue-photo-button"
          accessibilityRole={onImagePress ? 'button' : undefined}
          accessibilityLabel={issue.title}
          disabled={!onImagePress}
          onPress={() => onImagePress?.(0)}
          style={styles.imageContainer}
        >
          <Image
            source={{ uri: issue.images[0] }}
            style={styles.photo}
            contentFit="cover"
            accessibilityLabel={issue.title}
          />
          {/* Photo count pill overlay */}
          <View style={styles.photoCountBadge}>
            <Text style={styles.photoIcon}>📷</Text>
            <Text style={styles.photoCountText}>
              {issue.images.length > 1
                ? t('issue.photos', {
                    count: issue.images.length,
                    defaultValue: `${issue.images.length} photos`,
                  })
                : t('issue.photo', { count: 1, defaultValue: '1 photo' })}
            </Text>
          </View>
        </Pressable>
      ) : null}

      {/* ─── Official Response Callout (if any) ─── */}
      {officialResponse ? (
        <View
          style={[
            styles.officialBox,
            {
              backgroundColor: isDark ? '#1C2D24' : '#EAF5EE',
              borderColor: isDark ? '#264936' : '#CFE6D7',
            },
          ]}
        >
          <View style={styles.officialHeaderRow}>
            {/* Dark green badge with check */}
            <View style={styles.officialAvatarBadge}>
              <Text style={styles.officialCheckmark}>✓</Text>
            </View>

            <Text style={[styles.officialHandle, { color: isDark ? '#E5F2EA' : '#1C211F' }]}>
              @{officialResponse.author}
            </Text>

            <View
              style={[styles.officialRolePill, { backgroundColor: isDark ? '#254233' : '#D8EADF' }]}
            >
              <Text style={[styles.officialRoleText, { color: isDark ? '#A6D2B7' : '#194B34' }]}>
                {officialResponse.role ??
                  t('issue.districtManager', { defaultValue: 'Gestionnaire Arrondissement' })}
              </Text>
            </View>
          </View>

          <Text style={[styles.officialCommentText, { color: isDark ? '#A6D2B7' : '#39473F' }]}>
            &ldquo;{officialResponse.comment}&rdquo;
          </Text>
        </View>
      ) : null}

      {/* ─── Tags: Category & 311 Reference ─── */}
      <View style={styles.tagsRow}>
        {/* Category Pill */}
        <View
          style={[
            styles.tagPill,
            {
              backgroundColor: isDark ? '#2A3830' : '#EDF3EE',
              borderColor: isDark ? '#384C42' : '#DFE7E1',
            },
          ]}
        >
          <Text style={styles.tagIcon}>{categoryConfig.icon}</Text>
          <Text style={[styles.tagText, { color: isDark ? '#C2DDD0' : '#39473F' }]}>
            {categoryConfig.label}
          </Text>
        </View>

        {/* 311 Reference Pill */}
        {issue.external_311_ref ? (
          <View
            style={[
              styles.tagPill,
              {
                backgroundColor: isDark ? '#2A3830' : '#E2ECE7',
                borderColor: isDark ? '#384C42' : '#D0DDD6',
              },
            ]}
          >
            <Text style={[styles.refTagText, { color: isDark ? '#C2DDD0' : '#39473F' }]}>
              #{issue.external_311_ref}
            </Text>
          </View>
        ) : null}
      </View>

      {/* ─── Footer: Upvote, Confirmations & Comments ─── */}
      <View style={styles.footerRow}>
        <View style={styles.footerLeftActions}>
          {/* Upvote Pill Button */}
          <Pressable
            testID="issue-upvote-button"
            accessibilityRole="button"
            accessibilityLabel={t('issue.upvoteLabel', {
              count: issue.upvote_count,
              defaultValue: `Upvote, ${issue.upvote_count} votes`,
            })}
            disabled={!onUpvote}
            onPress={onUpvote}
            style={({ pressed }) => [
              styles.upvoteButton,
              {
                backgroundColor: isUpvoted
                  ? isDark
                    ? '#166534'
                    : '#064E3B'
                  : isDark
                    ? '#33443C'
                    : '#1C211F',
              },
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={styles.upvoteArrow}>▲</Text>
            <Text style={styles.upvoteCount}>{issue.upvote_count}</Text>
          </Pressable>

          {/* Confirm Resolution Pill Button */}
          <Pressable
            testID="issue-confirm-button"
            accessibilityRole="button"
            accessibilityLabel={t('issue.confirmed', {
              count: issue.resolution_confirmations,
              defaultValue: `${issue.resolution_confirmations} confirmed`,
            })}
            disabled={!onConfirmResolution}
            onPress={onConfirmResolution}
            style={({ pressed }) => [
              styles.confirmedButton,
              {
                backgroundColor: isConfirmed
                  ? isDark
                    ? '#1F4D36'
                    : '#A7F3D0'
                  : isDark
                    ? '#1A3326'
                    : '#D4F4E2',
                borderColor: isDark ? '#2F6647' : '#A6E3B9',
              },
              pressed && styles.buttonPressed,
            ]}
          >
            <View style={styles.confirmedCheckCircle}>
              <Text style={styles.confirmedCheckIcon}>✓</Text>
            </View>
            <Text style={[styles.confirmedText, { color: isDark ? '#A6E3B9' : '#0F5132' }]}>
              {issue.resolution_confirmations > 1
                ? t('issue.confirmedPlural', {
                    count: issue.resolution_confirmations,
                    defaultValue: `${issue.resolution_confirmations} confirmés`,
                  })
                : t('issue.confirmed', {
                    count: issue.resolution_confirmations,
                    defaultValue: `${issue.resolution_confirmations} confirmé`,
                  })}
            </Text>
          </Pressable>
        </View>

        {/* Comment Count / Button */}
        <Pressable
          testID="issue-comments-button"
          accessibilityRole="button"
          accessibilityLabel={t('issue.commentsLabel', {
            count: commentsCount,
            defaultValue: `${commentsCount} comments`,
          })}
          disabled={!onCommentsPress}
          onPress={onCommentsPress}
          style={({ pressed }) => [
            styles.commentsButton,
            {
              backgroundColor: isDark ? '#2A3830' : '#F3F5F4',
              borderColor: isDark ? '#384C42' : '#E2E7E4',
            },
            pressed && styles.buttonPressed,
          ]}
        >
          <CommentBubbleIcon color={isDark ? '#C2DDD0' : '#495C51'} />
          <Text style={[styles.commentsCountText, { color: isDark ? '#C2DDD0' : '#495C51' }]}>
            {commentsCount}
          </Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

export default IssueCard;

type SafeTranslateFn = (key: any, fallback: string) => string;

/** Returns visual style configuration for issue statuses. */
function getStatusConfig(status: IssueStatus, t: SafeTranslateFn, isDark: boolean) {
  switch (status) {
    case 'in_progress':
      return {
        label: t('issue.status.in_progress', 'En cours'),
        backgroundColor: isDark ? '#3A2814' : '#FEF3C7',
        borderColor: isDark ? '#6B4515' : '#FDE68A',
        textColor: isDark ? '#FDE68A' : '#B45309',
        dotColor: '#D97706',
      };
    case 'resolved':
      return {
        label: t('issue.status.resolved', 'Résolu'),
        backgroundColor: isDark ? '#0F3824' : '#DCFCE7',
        borderColor: isDark ? '#1C6B45' : '#BBF7D0',
        textColor: isDark ? '#86EFAC' : '#15803D',
        dotColor: '#16A34A',
      };
    case 'not_started':
    default:
      return {
        label: t('issue.status.not_started', 'À faire'),
        backgroundColor: isDark ? '#25302A' : '#F1F5F9',
        borderColor: isDark ? '#3B4D43' : '#E2E8F0',
        textColor: isDark ? '#CBD5E1' : '#475569',
        dotColor: '#64748B',
      };
  }
}

/** Returns category icon and localized label. */
function getCategoryConfig(category: IssueCategory, t: SafeTranslateFn) {
  switch (category) {
    case 'traffic_safety':
      return {
        icon: '🚲',
        label: t('issue.category.traffic_safety', 'Sécurité cycliste'),
      };
    case 'roads_potholes':
      return {
        icon: '🕳️',
        label: t('issue.category.roads_potholes', 'Nids-de-poule'),
      };
    case 'streetlights_utilities':
      return {
        icon: '💡',
        label: t('issue.category.streetlights_utilities', 'Éclairage public'),
      };
    default:
      return {
        icon: '📋',
        label: String(category),
      };
  }
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: Spacing.three,
    gap: Spacing.three,
    alignSelf: 'stretch',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  cardPressed: {
    opacity: 0.95,
    transform: [{ scale: 0.995 }],
  },

  // ── Header ──
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  headerUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarInitials: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  headerTextGroup: {
    flexDirection: 'column',
    gap: 2,
    flex: 1,
  },
  userHandleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  userHandle: {
    fontSize: 14,
    fontWeight: '600',
  },
  separatorDot: {
    marginHorizontal: 4,
    fontSize: 12,
  },
  dateText: {
    fontSize: 13,
    fontWeight: '400',
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addressText: {
    fontSize: 12.5,
    fontWeight: '400',
    flexShrink: 1,
  },

  // Pin geometry
  pinContainer: {
    width: 10,
    height: 13,
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginTop: 1,
  },
  pinCircle: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
  },
  pinPoint: {
    width: 0,
    height: 0,
    borderLeftWidth: 2.5,
    borderRightWidth: 2.5,
    borderTopWidth: 3.5,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -1,
  },

  // Status Badge
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // ── Content ──
  contentSection: {
    gap: 6,
  },
  title: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
  },

  // ── Photo ──
  imageContainer: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
    height: 200,
    width: '100%',
    backgroundColor: '#E5E7EB',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  photoCountBadge: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(28, 33, 31, 0.75)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  photoIcon: {
    fontSize: 11,
  },
  photoCountText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },

  // ── Official Response Box ──
  officialBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    gap: 6,
  },
  officialHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  officialAvatarBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#14532D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  officialCheckmark: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  officialHandle: {
    fontSize: 13.5,
    fontWeight: '600',
  },
  officialRolePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  officialRoleText: {
    fontSize: 11,
    fontWeight: '500',
  },
  officialCommentText: {
    fontSize: 13,
    fontStyle: 'italic',
    lineHeight: 18,
  },

  // ── Tags ──
  tagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  tagIcon: {
    fontSize: 13,
  },
  tagText: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  refTagText: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: Fonts.mono,
  },

  // ── Footer ──
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 2,
  },
  footerLeftActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  upvoteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  upvoteArrow: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  upvoteCount: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  confirmedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  confirmedCheckCircle: {
    width: 15,
    height: 15,
    borderRadius: 7.5,
    borderWidth: 1.2,
    borderColor: '#0F5132',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmedCheckIcon: {
    color: '#0F5132',
    fontSize: 9,
    fontWeight: '800',
    marginTop: -1,
  },
  confirmedText: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  commentsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  commentsCountText: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  buttonPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.96 }],
  },

  // Comment Bubble geometry
  bubbleContainer: {
    width: 14,
    height: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 1,
  },
  bubbleBody: {
    width: 13,
    height: 9,
    borderRadius: 3,
    borderWidth: 1.5,
  },
  bubbleTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderTopWidth: 3,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    alignSelf: 'flex-start',
    marginLeft: 3,
    marginTop: -1,
  },
});

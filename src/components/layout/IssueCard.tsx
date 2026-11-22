import { Image } from 'expo-image';
import { type ReactNode, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, type StyleProp, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import Reanimated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { type Theme, useThemedStyles } from '@/hooks/use-themed-styles';
import { CARD_SHADOW } from '@/components/utils/themed-card';
import { getIssueSeverity, getSeverityBadgePalette } from '@/components/utils/issue-severity';
import { ThemedText } from '@/components/utils/themed-text';
import { WEATHER_ELEMENT_META } from '@/components/utils/weather-elements';
import { Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  type Issue,
  type IssueAuthor,
  type IssueCategory,
  type IssueStatus,
  type OfficialResponse,
} from '@/models/Issue';
import { computeInitials, formatAddress, formatIssueDate } from '@/components/utils/formatter';

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
  /**
   * Show only the top part (header and title) until tapped; a tap unfolds the rest part by part,
   * top to bottom, and another tap folds it back. `onPress` is not used then.
   */
  collapsible?: boolean;
  /** Additional container styles. */
  style?: StyleProp<ViewStyle>;
  /** Optional testID. */
  testID?: string;
}

/** Gap between two parts starting to drop, so each one swings off the bottom of the part above. */
const UNFOLD_STAGGER_MS = 200;
/** Folding back runs in reverse order (last part first), and runs faster. */
const FOLD_STAGGER_MS = 110;
const FOLD_MS = 200;
/** The drop's spring: a little overshoot, like a panel swinging past flat and settling. */
const UNFOLD_SPRING = { damping: 11, stiffness: 120, mass: 1 };
/** The overshoot the height formula still follows (sin keeps the panel attached past flat). */
const MAX_PROGRESS = 1.15;

/**
 * One part of a collapsible card: a panel hinged on the bottom edge of the part above. It stays
 * mounted all the time. Progress 0 means folded (edge-on, zero height) and 1 means flat. The outer
 * view's height follows the panel's projected height, sin(90° · progress) of its natural height,
 * so whatever sits below stays attached to its bottom edge.
 *
 * Runs on Reanimated (UI thread): React Native's JS-driven `Animated` does not repaint height and
 * transforms on its own under the New Architecture, so the panels froze at their first frame.
 */
function FoldPart({
  open,
  order,
  count,
  children,
}: {
  open: boolean;
  /** Position among the card's parts, top to bottom. */
  order: number;
  count: number;
  children: ReactNode;
}) {
  const styles = useThemedStyles(createStyles);
  const progress = useSharedValue(0);
  // The panel's natural height. The panel is absolutely positioned, so the outer view's animated
  // (at first zero) height cannot squeeze it: in normal flow it would shrink to fit and measure
  // almost nothing, and the card would never grow.
  const height = useSharedValue(0);

  useEffect(() => {
    progress.set(
      open
        ? // Top to bottom: each part drops from the bottom of the one above and overshoots a little.
          withDelay(order * UNFOLD_STAGGER_MS, withSpring(1, UNFOLD_SPRING))
        : // Bottom to top: the last part folds up first.
          withDelay(
            (count - 1 - order) * FOLD_STAGGER_MS,
            withTiming(0, { duration: FOLD_MS, easing: Easing.in(Easing.cubic) }),
          ),
    );
  }, [open, order, count, progress]);

  const outerStyle = useAnimatedStyle(() => {
    const p = Math.min(Math.max(progress.get(), 0), MAX_PROGRESS);
    return { height: Math.sin((Math.PI / 2) * p) * height.get() };
  });
  const panelStyle = useAnimatedStyle(() => {
    const p = progress.get();
    return {
      opacity: height.get() ? interpolate(p, [0, 0.04, 1], [0, 1, 1], Extrapolation.CLAMP) : 0,
      // Past 1 (overshoot) the panel swings a little beyond flat.
      transform: [{ perspective: 900 }, { rotateX: `${-90 * (1 - p)}deg` }],
    };
  });
  // Darkens the panel while it is turned away from the viewer.
  const shadeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.get(), [0, 1], [0.35, 0], Extrapolation.CLAMP),
  }));

  return (
    <Reanimated.View
      pointerEvents={open ? 'auto' : 'none'}
      accessibilityElementsHidden={!open}
      importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}
      style={outerStyle}
    >
      <Reanimated.View
        onLayout={(e) => height.set(e.nativeEvent.layout.height)}
        style={[styles.unfoldPart, styles.foldPanel, panelStyle]}
      >
        {children}
        <Reanimated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, styles.shade, shadeStyle]}
        />
      </Reanimated.View>
    </Reanimated.View>
  );
}

/** Subtle native location pin icon matching the design. */
function PinIcon({ color }: { color: string }) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.pinContainer}>
      <View style={[styles.pinCircle, { borderColor: color }]} />
      <View style={[styles.pinPoint, { borderTopColor: color }]} />
    </View>
  );
}

/** Native comment bubble icon. */
function CommentBubbleIcon({ color }: { color: string }) {
  const styles = useThemedStyles(createStyles);
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
  collapsible = false,
  style,
  testID,
}: IssueCardProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

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
  const statusConfig = getStatusConfig(issue.status, translateSafe, theme);

  // 6. Category styling & icon
  const categoryConfig = getCategoryConfig(issue.category, translateSafe);
  const severity = getIssueSeverity(issue);
  const severityPalette = getSeverityBadgePalette(severity.urgency, theme);
  const severityText = t('issue.severityBadge', {
    urgency: translateSafe(`issue.urgency.${severity.urgency}`, severity.urgency),
    score: severity.score,
    defaultValue: `${translateSafe(`issue.urgency.${severity.urgency}`, severity.urgency)} • ${severity.score}/10`,
  });

  // 7. Interactive wrappers
  const [expanded, setExpanded] = useState(false);
  // Each part runs its own unfold/fold (staggered by its position) when this flips.
  const toggleExpanded = () => setExpanded((prev) => !prev);
  const isCardPressable = collapsible || Boolean(onPress);

  // The card's parts, top to bottom. A collapsible card shows only the top part (header and title)
  // and unfolds the others one after another when tapped.
  const headerPart = (
    <View style={styles.headerRow}>
      <View style={styles.headerUserInfo}>
        {/* Avatar */}
        <View style={[styles.avatar, { backgroundColor: theme.neutral200 }]}>
          {author?.avatarUrl || author?.avatar_url ? (
            <Image
              source={{ uri: author.avatarUrl ?? author.avatar_url }}
              style={styles.avatarImage}
            />
          ) : (
            <ThemedText style={[styles.avatarInitials, { color: theme.neutral900 }]}>
              {authorInitials}
            </ThemedText>
          )}
        </View>

        {/* User Details */}
        <View style={styles.headerTextGroup}>
          <View style={styles.userHandleRow}>
            <Text style={[styles.userHandle, { color: theme.text }]}>@{authorHandle}</Text>
            {formattedDate ? (
              <>
                <Text style={[styles.separatorDot, { color: theme.neutral600 }]}>•</Text>
                <Text style={[styles.dateText, { color: theme.neutral600 }]}>{formattedDate}</Text>
              </>
            ) : null}
          </View>

          {formattedAddress ? (
            <View style={styles.addressRow}>
              <PinIcon color={theme.neutral600} />
              <Text
                numberOfLines={1}
                ellipsizeMode="tail"
                style={[styles.addressText, { color: theme.neutral600 }]}
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
  );
  const titlePart = (
    <ThemedText type="cardTitle" style={[styles.title, { color: theme.text }]}>
      {issue.title}
    </ThemedText>
  );
  const severityPart = (
    <View
      testID="issue-severity-badge"
      style={[
        styles.tagPill,
        styles.severityInlinePill,
        {
          backgroundColor: severityPalette.backgroundColor,
          borderColor: severityPalette.borderColor,
        },
      ]}
    >
      <Text style={styles.tagIcon}>{severityPalette.icon}</Text>
      <Text style={[styles.tagText, { color: severityPalette.textColor }]}>{severityText}</Text>
    </View>
  );
  const descriptionPart = issue.description ? (
    <ThemedText
      numberOfLines={descriptionNumberOfLines}
      style={[styles.description, { color: theme.neutral700 }]}
    >
      {issue.description}
    </ThemedText>
  ) : null;
  const photoPart =
    issue.images && issue.images.length > 0 ? (
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
    ) : null;
  const officialPart = officialResponse ? (
    <View
      style={[
        styles.officialBox,
        {
          backgroundColor: theme.background,
          borderColor: theme.neutral200,
        },
      ]}
    >
      <View style={styles.officialHeaderRow}>
        {/* Dark green badge with check */}
        <View style={styles.officialAvatarBadge}>
          <Text style={styles.officialCheckmark}>✓</Text>
        </View>

        <Text style={[styles.officialHandle, { color: theme.text }]}>
          @{officialResponse.author}
        </Text>

        <View style={[styles.officialRolePill, { backgroundColor: theme.neutral200 }]}>
          <Text style={[styles.officialRoleText, { color: theme.neutral800 }]}>
            {officialResponse.role ??
              t('issue.districtManager', { defaultValue: 'Gestionnaire Arrondissement' })}
          </Text>
        </View>
      </View>

      <Text style={[styles.officialCommentText, { color: theme.neutral800 }]}>
        &ldquo;{officialResponse.comment}&rdquo;
      </Text>
    </View>
  ) : null;
  const tagsPart = (
    <View style={styles.tagsRow}>
      {/* Category Pill */}
      <View
        style={[
          styles.tagPill,
          {
            backgroundColor: theme.background,
            borderColor: theme.neutral200,
          },
        ]}
      >
        <Text style={styles.tagIcon}>{categoryConfig.icon}</Text>
        <Text style={[styles.tagText, { color: theme.neutral800 }]}>{categoryConfig.label}</Text>
      </View>

      {/* 311 Reference Pill */}
      {issue.external_311_ref ? (
        <View
          style={[
            styles.tagPill,
            {
              backgroundColor: theme.backgroundElement,
              borderColor: theme.neutral300,
            },
          ]}
        >
          <Text style={[styles.refTagText, { color: theme.neutral800 }]}>
            #{issue.external_311_ref}
          </Text>
        </View>
      ) : null}

      {/* Weather Element Pills */}
      {(issue.elements ?? []).map((el) => {
        const meta = WEATHER_ELEMENT_META[el];
        return (
          <View
            key={el}
            testID={`issue-element-pill-${el}`}
            style={[
              styles.tagPill,
              {
                backgroundColor: theme.background,
                borderColor: theme.neutral300,
              },
            ]}
          >
            <Text style={styles.tagIcon}>{meta.icon}</Text>
            <Text style={[styles.tagText, { color: theme.accent800 }]}>
              {translateSafe(`issue.elements.${el}`, meta.fallbackLabel)}
            </Text>
          </View>
        );
      })}
    </View>
  );
  const footerPart = (
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
              backgroundColor: isUpvoted ? theme.neutral800 : theme.text,
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
              backgroundColor: isConfirmed ? theme.neutral200 : theme.backgroundElement,
              borderColor: theme.neutral300,
            },
            pressed && styles.buttonPressed,
          ]}
        >
          <View style={styles.confirmedCheckCircle}>
            <Text style={styles.confirmedCheckIcon}>✓</Text>
          </View>
          <Text style={[styles.confirmedText, { color: theme.neutral800 }]}>
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
            backgroundColor: theme.neutral100,
            borderColor: theme.neutral200,
          },
          pressed && styles.buttonPressed,
        ]}
      >
        <CommentBubbleIcon color={theme.neutral700} />
        <Text style={[styles.commentsCountText, { color: theme.neutral700 }]}>{commentsCount}</Text>
      </Pressable>
    </View>
  );

  const unfoldParts = [
    descriptionPart || photoPart ? (
      <View key="body" style={{ gap: Spacing.three }}>
        {descriptionPart}
        {photoPart}
      </View>
    ) : null,
    officialPart ? <View key="official">{officialPart}</View> : null,
    <View key="actions" style={{ gap: Spacing.three }}>
      {tagsPart}
      {footerPart}
    </View>,
  ].filter((part) => part !== null);

  return (
    <Pressable
      testID={testID}
      accessibilityRole={isCardPressable ? 'button' : undefined}
      accessibilityState={collapsible ? { expanded } : undefined}
      accessibilityLabel={accessibilityLabel ?? issue.title}
      disabled={!isCardPressable}
      onPress={collapsible ? toggleExpanded : onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: theme.neutral100,
          borderColor: theme.neutral200,
          shadowColor: theme.shadow,
        },
        collapsible && styles.cardCollapsible,
        pressed && isCardPressable && styles.cardPressed,
        style,
      ]}
    >
      {collapsible ? (
        <>
          <View style={styles.topPart}>
            {headerPart}
            {titlePart}
            {severityPart}
          </View>
          {unfoldParts.map((part, order) => (
            <FoldPart key={part.key} open={expanded} order={order} count={unfoldParts.length}>
              {part}
            </FoldPart>
          ))}
        </>
      ) : (
        <>
          {headerPart}
          <View style={styles.contentSection}>
            {titlePart}
            {severityPart}
            {descriptionPart}
          </View>
          {photoPart}
          {officialPart}
          {tagsPart}
          {footerPart}
        </>
      )}
    </Pressable>
  );
}

export default IssueCard;

type SafeTranslateFn = (key: any, fallback: string) => string;

/** Returns visual style configuration for issue statuses. */
function getStatusConfig(status: IssueStatus, t: SafeTranslateFn, theme: Theme) {
  switch (status) {
    case 'in_progress':
      return {
        label: t('issue.status.in_progress', 'En cours'),
        backgroundColor: theme.background,
        borderColor: theme.accent200,
        textColor: theme.accent600,
        dotColor: theme.accent500,
      };
    case 'resolved':
      return {
        label: t('issue.status.resolved', 'Résolu'),
        backgroundColor: theme.background,
        borderColor: theme.backgroundElement,
        textColor: theme.neutral700,
        dotColor: theme.neutral600,
      };
    case 'not_started':
    default:
      return {
        label: t('issue.status.not_started', 'À faire'),
        backgroundColor: theme.neutral100,
        borderColor: theme.neutral200,
        textColor: theme.neutral700,
        dotColor: theme.neutral600,
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

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      borderRadius: 20,
      borderWidth: 1,
      padding: Spacing.three,
      gap: Spacing.three,
      alignSelf: 'stretch',
      ...CARD_SHADOW,
    },
    // Collapsible: the parts space themselves (a folded part must not leave a gap behind).
    cardCollapsible: { gap: 0 },
    topPart: { gap: Spacing.three },
    // The same space above each part as between the parts of a full card.
    // Pinned to the top of its slot at its natural height; turns around its top edge, the bottom
    // edge of the part above.
    foldPanel: { position: 'absolute', top: 0, left: 0, right: 0, transformOrigin: 'top' },
    shade: { backgroundColor: theme.text },
    unfoldPart: { paddingTop: Spacing.three },
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
      backgroundColor: theme.neutral200,
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
      backgroundColor: `${theme.text}BF`,
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    photoIcon: {
      fontSize: 11,
    },
    photoCountText: {
      color: theme.neutral100,
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
      backgroundColor: theme.neutral800,
      alignItems: 'center',
      justifyContent: 'center',
    },
    officialCheckmark: {
      color: theme.neutral100,
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
    severityInlinePill: {
      alignSelf: 'flex-start',
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
      color: theme.neutral100,
      fontSize: 10,
      fontWeight: '700',
    },
    upvoteCount: {
      color: theme.neutral100,
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
      borderColor: theme.neutral800,
      alignItems: 'center',
      justifyContent: 'center',
    },
    confirmedCheckIcon: {
      color: theme.neutral800,
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

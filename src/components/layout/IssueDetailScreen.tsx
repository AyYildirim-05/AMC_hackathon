import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { brand } from '@/brand';
import { useTheme } from '@/hooks/use-theme';
import { type Theme, useThemedStyles } from '@/hooks/use-themed-styles';
import { getIssueSeverity, getSeverityBadgePalette } from '@/components/utils/issue-severity';
import { type District } from '@/components/utils/map-utils';
import { ProfilePanelProvider } from '@/components/layout/profile-panel';
import { ProfileButton } from '@/components/utils/profile-button';
import { ThemedText } from '@/components/utils/themed-text';
import { WEATHER_ELEMENT_META } from '@/components/utils/weather-elements';
import { computeInitials } from '@/components/utils/formatter';
import { Fonts, Spacing } from '@/constants/theme';
import { useCurrentUser } from '@/hooks/use-current-user';
import { fetchDistricts } from '@/lib/api/districts';
import {
  type ApiIssueComment,
  createIssueComment,
  fetchIssueComments,
  fetchMyVotes,
  refetchAllIssueQueries,
  toggleIssueVote,
} from '@/lib/api/issues';
import { getApiErrorMessage } from '@/lib/auth/auth-api';
import { uploadIssuePhotos } from '@/lib/uploads/cloudinary';
import { type Issue } from '@/models/Issue';
import { useAuth } from '@/providers/auth-provider';

const MAX_COMMENT_PHOTOS = 3;

export interface IssueCommentItem {
  id: string;
  issue_id: string;
  user_id: string;
  body: string;
  images: string[];
  is_official_response: boolean;
  created_at: string;
  username: string;
  displayName: string;
  badge?: string;
  isFieldVerification?: boolean;
}

export interface TimelineStepItem {
  id: string;
  title: string;
  subtitle: string;
  time: string;
  status: 'completed' | 'active' | 'pending';
}

export interface IssueDetailScreenProps {
  /** The issue to display details for. */
  issue: Issue;
  /** Whether the modal is visible. */
  visible: boolean;
  /** Callback to close the detail view. */
  onClose: () => void;
  /** Optional callback when upvoting. */
  onUpvote?: (issueId: string, count: number) => void;
  /** Optional callback when confirming resolution. */
  onConfirmResolution?: (issueId: string, count: number) => void;
  /** Optional testID. */
  testID?: string;
}

/** Looks up borough or district name from fetched districts. */
export function getDistrictName(districtId?: string, districts?: readonly District[]): string {
  if (!districtId || !districts) return 'Montréal';
  const match = districts.find((d) => d.id === districtId);
  return match?.name_fr || match?.name_en || 'Montréal';
}

function mapApiCommentToItem(c: ApiIssueComment): IssueCommentItem {
  const username = c.author?.username || (c.isOfficialResponse ? 'city_official' : 'citoyen');
  const isVerification = !c.isOfficialResponse && c.body.toLowerCase().includes('confirmed');
  return {
    id: c.id,
    issue_id: c.issueId,
    user_id: c.userId,
    body: c.body,
    images: Array.isArray(c.images) ? c.images : [],
    is_official_response: c.isOfficialResponse,
    created_at: c.createdAt,
    username,
    displayName: `@${username}`,
    badge: c.isOfficialResponse ? undefined : isVerification ? 'Field Verification' : 'Resident',
    isFieldVerification: isVerification,
  };
}

/** Helper to format time strings like '08:15'. */
function formatTimeString(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '08:00';
    return d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch {
    return '08:00';
  }
}

/** Helper to format comment dates like 'Nov 18 • 08:15'. */
function formatCommentDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return 'Nov 18 • 08:15';
    const month = d.toLocaleDateString('en-US', { month: 'short' });
    const day = d.getUTCDate();
    const time = d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    return `${month} ${day} • ${time}`;
  } catch {
    return 'Nov 18 • 08:15';
  }
}

/** Builds timeline steps reflecting municipal intervention. */
function getTimelineSteps(issue: Issue, districtNameOverride?: string): TimelineStepItem[] {
  const district = districtNameOverride ?? getDistrictName(issue.district_id);
  const districtShort = district.replace('Le ', '');

  if (issue.id === 'f47ac10b-58cc-4372-a567-0e02b2c3d479') {
    return [
      {
        id: 'step-1',
        title: 'Signalé par le citoyen',
        subtitle: `Ticket créé et géolocalisé via ${brand.name}`,
        time: '08:00',
        status: 'completed',
      },
      {
        id: 'step-2',
        title: `Transmis aux inspecteurs du ${districtShort}`,
        subtitle: 'Synchronisé avec le système central 311 de Montréal',
        time: '09:30',
        status: 'completed',
      },
      {
        id: 'step-3',
        title: 'Équipe dépêchée sur les lieux (Actif)',
        subtitle: "Inspecteur de la voirie assigné pour contrôle de permis d'entrave",
        time: '11:42',
        status: 'active',
      },
      {
        id: 'step-4',
        title: 'Résolution finale & réouverture de la voie',
        subtitle: 'Clôture du dossier après retrait des entraves',
        time: 'À venir',
        status: 'pending',
      },
    ];
  }

  // Dynamic steps based on status
  const createdTime = formatTimeString(issue.created_at);
  const isResolved = issue.status === 'resolved';
  const isInProgress = issue.status === 'in_progress';

  return [
    {
      id: 'step-1',
      title: 'Signalé par le citoyen',
      subtitle: `Ticket créé et géolocalisé via ${brand.name}`,
      time: createdTime,
      status: 'completed',
    },
    {
      id: 'step-2',
      title: `Transmis aux inspecteurs du ${districtShort}`,
      subtitle: 'Synchronisé avec le système central 311 de Montréal',
      time: '09:30',
      status: 'completed',
    },
    {
      id: 'step-3',
      title:
        isInProgress || isResolved
          ? 'Équipe dépêchée sur les lieux (Actif)'
          : "En attente d'assignation",
      subtitle:
        isInProgress || isResolved
          ? "Inspecteur assigné pour intervention sur l'enjeu"
          : 'Prise en charge par les services municipaux',
      time: isInProgress || isResolved ? '11:42' : 'À venir',
      status: isResolved ? 'completed' : isInProgress ? 'active' : 'pending',
    },
    {
      id: 'step-4',
      title: 'Résolution finale & réouverture de la voie',
      subtitle: 'Clôture du dossier après confirmation municipale',
      time: isResolved ? '17:00' : 'À venir',
      status: isResolved ? 'completed' : 'pending',
    },
  ];
}

export function IssueDetailScreen({
  issue,
  visible,
  onClose,
  onUpvote,
  onConfirmResolution,
  testID = 'issue-detail-screen',
}: IssueDetailScreenProps) {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation();
  const user = useCurrentUser();
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const { data: apiDistricts } = useQuery<District[]>({
    queryKey: ['districts'],
    queryFn: fetchDistricts,
  });

  const { data: apiComments } = useQuery<ApiIssueComment[]>({
    queryKey: ['issues', issue.id, 'comments'],
    queryFn: () => fetchIssueComments(issue.id),
    enabled: visible,
  });

  const { data: myVotes } = useQuery({
    queryKey: ['votes', 'me'],
    queryFn: fetchMyVotes,
    enabled: visible && isAuthenticated,
  });

  // Optimistic vote state synced with server responses
  const [localVotes, setLocalVotes] = useState<{
    issueId: string;
    isUpvoted: boolean;
    upvoteCount: number;
    isConfirmed: boolean;
    confirmCount: number;
  } | null>(null);
  const [newCommentText, setNewCommentText] = useState<string>('');
  const [pendingPhotos, setPendingPhotos] = useState<string[]>([]);
  const commentPhotoMetaRef = useRef<
    Record<string, { base64?: string | null; mimeType?: string | null; fileName?: string | null }>
  >({});
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  const serverIsUpvoted = myVotes ? myVotes.upvotedIssueIds.includes(issue.id) : false;
  const serverIsConfirmed = myVotes ? myVotes.confirmedIssueIds.includes(issue.id) : false;

  const activeOverride = localVotes?.issueId === issue.id ? localVotes : null;
  const isUpvoted = activeOverride ? activeOverride.isUpvoted : serverIsUpvoted;
  const upvoteCount = activeOverride ? activeOverride.upvoteCount : issue.upvote_count || 0;
  const isConfirmed = activeOverride ? activeOverride.isConfirmed : serverIsConfirmed;
  const confirmCount = activeOverride
    ? activeOverride.confirmCount
    : issue.resolution_confirmations || 0;

  const voteMutation = useMutation({
    mutationFn: (voteType: 'upvote' | 'confirm_resolved') => toggleIssueVote(issue.id, voteType),
    onSuccess: (res) => {
      setLocalVotes({
        issueId: issue.id,
        isUpvoted: res.voteType === 'upvote' ? res.active : isUpvoted,
        upvoteCount: res.upvoteCount,
        isConfirmed: res.voteType === 'confirm_resolved' ? res.active : isConfirmed,
        confirmCount: res.resolutionConfirmations,
      });
      if (res.voteType === 'upvote') {
        onUpvote?.(issue.id, res.upvoteCount);
      } else {
        onConfirmResolution?.(issue.id, res.resolutionConfirmations);
      }
      void refetchAllIssueQueries(queryClient);
    },
  });

  const commentMutation = useMutation({
    mutationFn: ({
      body,
      isOfficial,
      images,
    }: {
      body: string;
      isOfficial: boolean;
      images: string[];
    }) => createIssueComment(issue.id, body, isOfficial, images),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['issues', issue.id, 'comments'],
        refetchType: 'all',
      });
      void refetchAllIssueQueries(queryClient);
    },
  });

  const comments = useMemo<IssueCommentItem[]>(
    () => (apiComments ?? []).map(mapApiCommentToItem),
    [apiComments],
  );

  const authorHandle = issue.author?.username || 'citoyen';
  const matchedDistrict = apiDistricts?.find((d) => d.id === issue.district_id);
  const districtName = getDistrictName(issue.district_id, apiDistricts);
  const timelineSteps = getTimelineSteps(issue, districtName);

  const handleToggleUpvote = () => {
    const nextState = !isUpvoted;
    const nextCount = nextState ? upvoteCount + 1 : Math.max(0, upvoteCount - 1);
    setLocalVotes({
      issueId: issue.id,
      isUpvoted: nextState,
      upvoteCount: nextCount,
      isConfirmed,
      confirmCount,
    });
    voteMutation.mutate('upvote');
  };

  const handleToggleConfirm = () => {
    const nextState = !isConfirmed;
    const nextCount = nextState ? confirmCount + 1 : Math.max(0, confirmCount - 1);
    setLocalVotes({
      issueId: issue.id,
      isUpvoted,
      upvoteCount,
      isConfirmed: nextState,
      confirmCount: nextCount,
    });
    voteMutation.mutate('confirm_resolved');
  };

  const canSendComment =
    !isSubmittingComment && (newCommentText.trim().length > 0 || pendingPhotos.length > 0);

  const handlePickCommentPhoto = async () => {
    if (isSubmittingComment) return;
    if (pendingPhotos.length >= MAX_COMMENT_PHOTOS) {
      Alert.alert(
        'Photo limit reached',
        `You can attach up to ${MAX_COMMENT_PHOTOS} photos per comment.`,
      );
      return;
    }

    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.6,
        base64: true,
      });
      if (!res.canceled && res.assets?.[0]?.uri) {
        const asset = res.assets[0];
        commentPhotoMetaRef.current[asset.uri] = {
          base64: asset.base64,
          mimeType: asset.mimeType,
          fileName: asset.fileName,
        };
        setPendingPhotos((prev) => [...prev, asset.uri].slice(0, MAX_COMMENT_PHOTOS));
      }
    } catch {
      Alert.alert('Error', 'Unable to open your photo library.');
    }
  };

  const handleRemovePendingPhoto = (index: number) => {
    setPendingPhotos((prev) => {
      const removed = prev[index];
      if (removed) delete commentPhotoMetaRef.current[removed];
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleAddComment = async () => {
    const trimmed = newCommentText.trim();
    if (isSubmittingComment || (!trimmed && pendingPhotos.length === 0)) return;

    const isDistrictManagerForIssue =
      Boolean(user?.id) &&
      ((matchedDistrict?.manager_id != null && matchedDistrict.manager_id === user?.id) ||
        user?.role === 'admin');

    setIsSubmittingComment(true);
    try {
      let uploadedImages: string[] = [];
      if (pendingPhotos.length > 0) {
        const existingRemote = pendingPhotos.filter((uri) =>
          /^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\//i.test(uri),
        );
        const localUris = pendingPhotos.filter((uri) => !/^https?:\/\//i.test(uri));
        const newlyUploaded =
          localUris.length > 0
            ? await uploadIssuePhotos(
                localUris.map((uri) => {
                  const meta = commentPhotoMetaRef.current[uri];
                  return meta && (meta.base64 || meta.mimeType || meta.fileName)
                    ? { uri, ...meta }
                    : uri;
                }),
              )
            : [];
        uploadedImages = [...existingRemote, ...newlyUploaded];
      }

      await commentMutation.mutateAsync({
        body: trimmed,
        isOfficial: isDistrictManagerForIssue,
        images: uploadedImages,
      });
      setNewCommentText('');
      setPendingPhotos([]);
      commentPhotoMetaRef.current = {};
    } catch (err) {
      Alert.alert('Error', getApiErrorMessage(err, 'Unable to post comment. Please try again.'));
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        title: issue.title,
        message: `${issue.title} - ${issue.address}\nMTL-311 Ref: ${issue.external_311_ref || 'N/A'}`,
      });
    } catch {
      // ignore
    }
  };

  const handleOpenMap = () => {
    const url = `https://www.google.com/maps/search/?api=1&query=${issue.latitude},${issue.longitude}`;
    Linking.openURL(url).catch(() => {});
  };

  // Cross-street or landmark description
  const crossStreet = issue.address.includes('Rachel')
    ? 'Rachel Est × Parc La Fontaine'
    : issue.address.split(',')[0];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      {/* A modal draws above the app's own profile panel, so it hosts its own. */}
      <ProfilePanelProvider>
        <SafeAreaView
          testID={testID}
          style={[styles.safeArea, { backgroundColor: theme.neutral100 }]}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.keyboardContainer}
          >
            {/* ─── Top Header Navigation Bar ─── */}
            <View
              style={[
                styles.navBar,
                {
                  backgroundColor: theme.neutral100,
                  borderBottomColor: theme.neutral200,
                },
              ]}
            >
              <Pressable
                testID="issue-detail-back-button"
                accessibilityRole="button"
                accessibilityLabel="Back"
                onPress={onClose}
                hitSlop={12}
                style={({ pressed }) => [styles.navIconButton, pressed && styles.pressedOpacity]}
              >
                <Text style={[styles.backArrowText, { color: theme.text }]}>←</Text>
              </Pressable>

              <Text
                numberOfLines={1}
                ellipsizeMode="tail"
                style={[styles.navTitle, { color: theme.text }]}
              >
                {issue.title}
              </Text>

              <View style={styles.navActions}>
                <Pressable
                  testID="issue-detail-share-button"
                  accessibilityRole="button"
                  accessibilityLabel="Share issue"
                  onPress={handleShare}
                  hitSlop={12}
                  style={({ pressed }) => [styles.navIconButton, pressed && styles.pressedOpacity]}
                >
                  <Text style={[styles.shareIconText, { color: theme.text }]}>↗</Text>
                </Pressable>
                <ProfileButton testID="issue-detail-profile-button" />
              </View>
            </View>

            {/* ─── Scrollable Issue Details ─── */}
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {/* 1. Header Metadata Card */}
              <View
                style={[
                  styles.card,
                  {
                    backgroundColor: theme.neutral100,
                    borderColor: theme.backgroundElement,
                  },
                ]}
              >
                {/* Badges Row */}
                <View style={styles.badgeRow}>
                  {/* Category Pill */}
                  <View
                    style={[
                      styles.pillBadge,
                      {
                        backgroundColor: theme.background,
                        borderColor: theme.neutral200,
                      },
                    ]}
                  >
                    <Text style={styles.pillIcon}>🚧</Text>
                    <Text style={[styles.pillText, { color: theme.neutral800 }]}>
                      Traffic & Safety
                    </Text>
                  </View>

                  {/* District Verified Pill */}
                  <View
                    style={[
                      styles.pillBadge,
                      {
                        backgroundColor: theme.background,
                        borderColor: theme.neutral200,
                      },
                    ]}
                  >
                    <Text style={[styles.pillIcon, { color: theme.neutral700 }]}>✓</Text>
                    <Text
                      style={[
                        styles.pillText,
                        {
                          color: theme.neutral700,
                          fontWeight: '600',
                        },
                      ]}
                    >
                      {districtName} • Verified
                    </Text>
                  </View>

                  {/* 311 Reference Pill */}
                  {issue.external_311_ref ? (
                    <View
                      style={[
                        styles.pillBadge,
                        {
                          backgroundColor: theme.background,
                          borderColor: theme.backgroundElement,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.refText,
                          {
                            color: theme.neutral700,
                          },
                        ]}
                      >
                        # {issue.external_311_ref}
                      </Text>
                    </View>
                  ) : null}

                  {/* Weather Element Pills */}
                  {(issue.elements ?? []).map((el) => {
                    const meta = WEATHER_ELEMENT_META[el];
                    return (
                      <View
                        key={el}
                        testID={`detail-element-pill-${el}`}
                        style={[
                          styles.pillBadge,
                          {
                            backgroundColor: theme.background,
                            borderColor: theme.neutral300,
                          },
                        ]}
                      >
                        <Text style={styles.pillIcon}>{meta.icon}</Text>
                        <Text
                          style={[
                            styles.pillText,
                            {
                              color: theme.accent800,
                            },
                          ]}
                        >
                          {t(`issue.elements.${el}`, { defaultValue: meta.fallbackLabel })}
                        </Text>
                      </View>
                    );
                  })}
                  {(() => {
                    const severity = getIssueSeverity(issue);
                    const palette = getSeverityBadgePalette(severity.urgency, theme);
                    const urgencyLabel = t(`issue.urgency.${severity.urgency}`, {
                      defaultValue: severity.urgency,
                    });
                    const label = t('issue.severityBadge', {
                      urgency: urgencyLabel,
                      score: severity.score,
                      defaultValue: `${urgencyLabel} • ${severity.score}/10`,
                    });
                    return (
                      <View
                        testID="detail-severity-badge"
                        style={[
                          styles.pillBadge,
                          {
                            backgroundColor: palette.backgroundColor,
                            borderColor: palette.borderColor,
                          },
                        ]}
                      >
                        <Text style={styles.pillIcon}>{palette.icon}</Text>
                        <Text style={[styles.pillText, { color: palette.textColor }]}>{label}</Text>
                      </View>
                    );
                  })()}
                </View>

                {/* Large Issue Title */}
                <Text style={[styles.issueTitle, { color: theme.text }]}>{issue.title}</Text>

                {/* Location & Reported Info Box */}
                <View
                  style={[
                    styles.locationBox,
                    {
                      backgroundColor: theme.neutral100,
                      borderColor: theme.backgroundElement,
                    },
                  ]}
                >
                  <View style={styles.locationHeaderRow}>
                    <Text style={styles.pinIcon}>📍</Text>
                    <Text
                      numberOfLines={1}
                      style={[styles.addressText, { color: theme.neutral900 }]}
                    >
                      {issue.address}
                    </Text>
                  </View>
                  <Text
                    numberOfLines={1}
                    style={[styles.coordinatesText, { color: theme.neutral600 }]}
                  >
                    Reported by @{authorHandle} • {issue.latitude.toFixed(4)},{' '}
                    {issue.longitude.toFixed(4)}
                  </Text>
                </View>
              </View>

              {/* 2. Photo & Map Verification Card */}
              <View
                style={[
                  styles.card,
                  {
                    backgroundColor: theme.neutral100,
                    borderColor: theme.backgroundElement,
                  },
                ]}
              >
                <View style={styles.photoContainer}>
                  {issue.images && issue.images.length > 0 ? (
                    <Image
                      source={{ uri: issue.images[0] }}
                      style={styles.detailPhoto}
                      contentFit="cover"
                      accessibilityLabel={issue.title}
                    />
                  ) : (
                    <View
                      style={[
                        styles.detailPhoto,
                        styles.photoPlaceholder,
                        {
                          backgroundColor: theme.backgroundElement,
                        },
                      ]}
                    >
                      <Text style={styles.placeholderIcon}>📷</Text>
                      <Text
                        style={[
                          styles.placeholderText,
                          {
                            color: theme.neutral700,
                          },
                        ]}
                      >
                        Citizen Photo
                      </Text>
                    </View>
                  )}

                  {/* Overlay Top-Left: Status Pill */}
                  <View style={styles.overlayStatusPill}>
                    <View style={styles.statusDotAmber} />
                    <Text style={styles.overlayStatusText}>In Progress</Text>
                  </View>

                  {/* Overlay Top-Right: Citizen Photo Badge */}
                  <View style={styles.overlayCitizenPill}>
                    <Text style={styles.overlayCameraIcon}>📷</Text>
                    <Text style={styles.overlayCitizenText}>Citizen Photo</Text>
                  </View>

                  {/* Overlay Bottom-Left: Cross Street Pill */}
                  <View style={styles.overlayLocationPill}>
                    <Text style={styles.overlayPinIcon}>📍</Text>
                    <Text style={styles.overlayLocationText}>{crossStreet}</Text>
                  </View>
                </View>

                {/* Photo Bottom Verification Link */}
                <View style={styles.mapFooterRow}>
                  <View style={styles.gpsVerifiedRow}>
                    <View style={styles.gpsDot} />
                    <Text style={[styles.gpsText, { color: theme.neutral700 }]}>
                      GPS Coordinates Verified • Ville de Montréal
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="link"
                    accessibilityLabel="View full map"
                    onPress={handleOpenMap}
                    hitSlop={8}
                    style={styles.fullMapLink}
                  >
                    <Text style={[styles.fullMapText, { color: theme.neutral800 }]}>
                      Full map ↗
                    </Text>
                  </Pressable>
                </View>
              </View>

              {/* 3. Community Action & Validation Card */}
              <View
                style={[
                  styles.card,
                  {
                    backgroundColor: theme.neutral100,
                    borderColor: theme.backgroundElement,
                  },
                ]}
              >
                <View style={styles.cardHeaderRow}>
                  <ThemedText type="smallBold" style={styles.sectionHeaderTitle}>
                    Community Action & Validation
                  </ThemedText>
                  <Text style={[styles.sectionHeaderSub, { color: theme.neutral600 }]}>
                    Ground verification
                  </Text>
                </View>

                <View style={styles.actionButtonsRow}>
                  {/* Upvote Button */}
                  <Pressable
                    testID="detail-upvote-button"
                    accessibilityRole="button"
                    accessibilityLabel={`Upvote Issue, ${upvoteCount} votes`}
                    onPress={handleToggleUpvote}
                    style={({ pressed }) => [
                      styles.primaryActionButton,
                      {
                        backgroundColor: isUpvoted ? theme.neutral800 : theme.neutral900,
                      },
                      pressed && styles.pressedOpacity,
                    ]}
                  >
                    <Text style={styles.upvoteArrowSymbol}>↑</Text>
                    <Text style={styles.primaryActionButtonText}>Upvote Issue ({upvoteCount})</Text>
                  </Pressable>

                  {/* Confirm Resolved Button */}
                  <Pressable
                    testID="detail-confirm-button"
                    accessibilityRole="button"
                    accessibilityLabel={`Confirm Resolved, ${confirmCount} confirmed`}
                    onPress={handleToggleConfirm}
                    style={({ pressed }) => [
                      styles.secondaryActionButton,
                      {
                        backgroundColor: isConfirmed ? theme.neutral200 : theme.background,
                        borderColor: theme.neutral300,
                      },
                      pressed && styles.pressedOpacity,
                    ]}
                  >
                    <Text style={[styles.confirmCheckSymbol, { color: theme.neutral800 }]}>✓</Text>
                    <Text style={[styles.secondaryActionButtonText, { color: theme.neutral800 }]}>
                      Confirm Resolved ({confirmCount})
                    </Text>
                  </Pressable>
                </View>
              </View>

              {/* 4. Suivi de l'intervention municipale (Timeline Card) */}
              <View
                style={[
                  styles.card,
                  {
                    backgroundColor: theme.neutral100,
                    borderColor: theme.backgroundElement,
                  },
                ]}
              >
                <View style={styles.cardHeaderRow}>
                  <View style={styles.rowAlign}>
                    <Text style={styles.pulseIcon}>📈</Text>
                    <ThemedText type="smallBold" style={styles.sectionHeaderTitle}>
                      {"Suivi de l'intervention municipale"}
                    </ThemedText>
                  </View>
                  <Text style={[styles.arrCodeText, { color: theme.neutral600 }]}>ARR-08-311</Text>
                </View>

                {/* Vertical Timeline List */}
                <View style={styles.timelineList}>
                  {timelineSteps.map((step, idx) => {
                    const isLast = idx === timelineSteps.length - 1;
                    const isActive = step.status === 'active';
                    const isCompleted = step.status === 'completed';

                    return (
                      <View key={step.id} style={styles.timelineRow}>
                        {/* Left: Icon node & vertical connector */}
                        <View style={styles.timelineLeftCol}>
                          {isCompleted ? (
                            <View style={styles.completedNode}>
                              <Text style={styles.completedNodeCheck}>✓</Text>
                            </View>
                          ) : isActive ? (
                            <View style={styles.activeNodeOuter}>
                              <View style={styles.activeNodeInner} />
                            </View>
                          ) : (
                            <View style={styles.pendingNode} />
                          )}

                          {!isLast && (
                            <View
                              style={[
                                styles.timelineConnector,
                                {
                                  backgroundColor: isCompleted
                                    ? theme.neutral700
                                    : theme.neutral300,
                                },
                              ]}
                            />
                          )}
                        </View>

                        {/* Right: Step content */}
                        <View style={styles.timelineContentCol}>
                          {isActive ? (
                            <View
                              style={[
                                styles.activeStepBox,
                                {
                                  backgroundColor: theme.background,
                                  borderColor: theme.neutral200,
                                },
                              ]}
                            >
                              <View style={styles.stepTitleRow}>
                                <Text
                                  style={[
                                    styles.activeStepTitle,
                                    {
                                      color: theme.text,
                                    },
                                  ]}
                                >
                                  {step.title}
                                </Text>
                                <Text
                                  style={[
                                    styles.activeStepTime,
                                    {
                                      color: theme.neutral700,
                                    },
                                  ]}
                                >
                                  {step.time}
                                </Text>
                              </View>
                              <Text
                                style={[
                                  styles.activeStepSubtitle,
                                  {
                                    color: theme.neutral700,
                                  },
                                ]}
                              >
                                {step.subtitle}
                              </Text>
                            </View>
                          ) : (
                            <View style={styles.normalStepBox}>
                              <View style={styles.stepTitleRow}>
                                <Text
                                  style={[
                                    styles.stepTitle,
                                    {
                                      color: isCompleted ? theme.text : theme.neutral500,
                                    },
                                  ]}
                                >
                                  {step.title}
                                </Text>
                                <Text
                                  style={[
                                    styles.stepTime,
                                    {
                                      color: isCompleted ? theme.neutral700 : theme.neutral400,
                                    },
                                  ]}
                                >
                                  {step.time}
                                </Text>
                              </View>
                              <Text
                                style={[
                                  styles.stepSubtitle,
                                  {
                                    color: isCompleted ? theme.neutral700 : theme.neutral500,
                                  },
                                ]}
                              >
                                {step.subtitle}
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>

              {/* 5. Comments & Updates Section */}
              <View
                style={[
                  styles.card,
                  {
                    backgroundColor: theme.neutral100,
                    borderColor: theme.backgroundElement,
                  },
                ]}
              >
                <View style={styles.cardHeaderRow}>
                  <View style={styles.rowAlign}>
                    <Text style={styles.chatIcon}>💬</Text>
                    <ThemedText type="smallBold" style={styles.sectionHeaderTitle}>
                      Comments & Updates
                    </ThemedText>
                  </View>
                  <Text style={[styles.updatesCountText, { color: theme.neutral600 }]}>
                    {comments.length} updates
                  </Text>
                </View>

                {/* Comments Feed */}
                <View style={styles.commentsList}>
                  {comments.map((comment) => {
                    if (comment.is_official_response) {
                      return (
                        <View
                          key={comment.id}
                          style={[
                            styles.officialResponseCard,
                            {
                              backgroundColor: theme.neutral100,
                              borderColor: theme.neutral200,
                            },
                          ]}
                        >
                          <View style={styles.officialHeaderRow}>
                            <View style={styles.officialBadgeCircle}>
                              <Text style={styles.officialCheckIcon}>✓</Text>
                            </View>
                            <View style={styles.officialHeaderTextGroup}>
                              <Text style={[styles.officialTitleText, { color: theme.text }]}>
                                Official Borough Response
                              </Text>
                              <Text
                                style={[
                                  styles.officialHandleText,
                                  {
                                    color: theme.neutral700,
                                  },
                                ]}
                              >
                                @{comment.username} ({districtName})
                              </Text>
                            </View>
                            <View style={styles.officialTimeRow}>
                              <Text style={styles.clockIcon}>🕒</Text>
                              <Text
                                style={[
                                  styles.commentTimeText,
                                  {
                                    color: theme.neutral600,
                                  },
                                ]}
                              >
                                {formatCommentDate(comment.created_at)}
                              </Text>
                            </View>
                          </View>

                          {/* Nested quote card */}
                          {comment.body.length > 0 ? (
                            <View
                              style={[
                                styles.quoteBox,
                                {
                                  backgroundColor: theme.neutral100,
                                  borderColor: theme.backgroundElement,
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.quoteText,
                                  {
                                    color: theme.neutral900,
                                  },
                                ]}
                              >
                                &ldquo;{comment.body}&rdquo;
                              </Text>
                            </View>
                          ) : null}

                          {/* Attached comment images */}
                          {comment.images.length > 0 ? (
                            <ScrollView
                              horizontal
                              showsHorizontalScrollIndicator={false}
                              contentContainerStyle={styles.commentImagesRow}
                            >
                              {comment.images.map((uri, idx) => (
                                <Pressable
                                  key={`${comment.id}-img-${idx}`}
                                  accessibilityRole="imagebutton"
                                  accessibilityLabel="View comment photo"
                                  onPress={() => setPreviewImageUrl(uri)}
                                  style={({ pressed }) => [pressed && styles.pressedOpacity]}
                                >
                                  <Image
                                    testID={`comment-image-${comment.id}-${idx}`}
                                    source={{ uri }}
                                    style={[
                                      styles.commentImageThumb,
                                      {
                                        borderColor: theme.neutral200,
                                      },
                                    ]}
                                    contentFit="cover"
                                  />
                                </Pressable>
                              ))}
                            </ScrollView>
                          ) : null}

                          {/* Official Ticket Footer */}
                          <View style={styles.officialFooterRow}>
                            <Text style={styles.shieldCheckIcon}>🛡️</Text>
                            <Text
                              style={[
                                styles.officialFooterText,
                                {
                                  color: theme.neutral700,
                                },
                              ]}
                            >
                              Official ticket dispatched to Public Works Inspection
                            </Text>
                          </View>
                        </View>
                      );
                    }

                    const initials = computeInitials(comment.username);

                    return (
                      <View
                        key={comment.id}
                        style={[
                          styles.commentItemCard,
                          {
                            backgroundColor: theme.neutral100,
                            borderColor: theme.backgroundElement,
                          },
                        ]}
                      >
                        <View style={styles.commentHeaderRow}>
                          {/* Avatar */}
                          <View
                            style={[
                              styles.avatarCircle,
                              {
                                backgroundColor: theme.neutral900,
                              },
                            ]}
                          >
                            <Text style={styles.avatarInitialsText}>{initials}</Text>
                          </View>

                          {/* User info & badges */}
                          <View style={styles.commentUserGroup}>
                            <View style={styles.commentUserMetaRow}>
                              <Text style={[styles.commentAuthorHandle, { color: theme.text }]}>
                                {comment.displayName}
                              </Text>

                              {comment.badge ? (
                                <View
                                  style={[
                                    styles.commentBadgePill,
                                    comment.isFieldVerification
                                      ? {
                                          backgroundColor: theme.neutral200,
                                          borderColor: theme.neutral300,
                                        }
                                      : {
                                          backgroundColor: theme.backgroundElement,
                                          borderColor: theme.neutral200,
                                        },
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.commentBadgeText,
                                      comment.isFieldVerification
                                        ? {
                                            color: theme.neutral800,
                                            fontWeight: '600',
                                          }
                                        : {
                                            color: theme.neutral700,
                                          },
                                    ]}
                                  >
                                    {comment.badge}
                                  </Text>
                                </View>
                              ) : null}
                            </View>
                          </View>

                          {/* Timestamp */}
                          <Text
                            style={[
                              styles.commentTimeText,
                              {
                                color: theme.neutral600,
                              },
                            ]}
                          >
                            {formatCommentDate(comment.created_at)}
                          </Text>
                        </View>

                        {/* Comment body */}
                        {comment.body.length > 0 ? (
                          <Text
                            style={[
                              styles.commentBodyText,
                              {
                                color: theme.neutral900,
                              },
                            ]}
                          >
                            {comment.body}
                          </Text>
                        ) : null}

                        {/* Attached comment images */}
                        {comment.images.length > 0 ? (
                          <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.commentImagesRow}
                          >
                            {comment.images.map((uri, idx) => (
                              <Pressable
                                key={`${comment.id}-img-${idx}`}
                                accessibilityRole="imagebutton"
                                accessibilityLabel="View comment photo"
                                onPress={() => setPreviewImageUrl(uri)}
                                style={({ pressed }) => [pressed && styles.pressedOpacity]}
                              >
                                <Image
                                  testID={`comment-image-${comment.id}-${idx}`}
                                  source={{ uri }}
                                  style={[
                                    styles.commentImageThumb,
                                    {
                                      borderColor: theme.neutral200,
                                    },
                                  ]}
                                  contentFit="cover"
                                />
                              </Pressable>
                            ))}
                          </ScrollView>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              </View>

              <View style={{ height: 24 }} />
            </ScrollView>

            {/* ─── Pending Comment Photos Preview Strip ─── */}
            {pendingPhotos.length > 0 ? (
              <View
                testID="pending-comment-photos-strip"
                style={[
                  styles.pendingPhotosBar,
                  {
                    backgroundColor: theme.neutral100,
                    borderTopColor: theme.backgroundElement,
                  },
                ]}
              >
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.pendingPhotosList}
                >
                  {pendingPhotos.map((uri, index) => (
                    <View key={`${uri}-${index}`} style={styles.pendingPhotoWrap}>
                      <Image
                        testID={`pending-comment-photo-${index}`}
                        source={{ uri }}
                        style={styles.pendingPhotoThumb}
                        contentFit="cover"
                      />
                      <Pressable
                        testID={`remove-comment-photo-${index}`}
                        accessibilityRole="button"
                        accessibilityLabel="Remove attached photo"
                        onPress={() => handleRemovePendingPhoto(index)}
                        disabled={isSubmittingComment}
                        hitSlop={6}
                        style={styles.pendingPhotoRemoveBtn}
                      >
                        <Text style={styles.pendingPhotoRemoveText}>✕</Text>
                      </Pressable>
                    </View>
                  ))}
                </ScrollView>
                <Text style={[styles.pendingPhotosCount, { color: theme.neutral700 }]}>
                  {pendingPhotos.length}/{MAX_COMMENT_PHOTOS}
                </Text>
              </View>
            ) : null}

            {/* ─── Fixed Bottom Comment Input Bar ─── */}
            <View
              style={[
                styles.bottomInputBar,
                {
                  backgroundColor: theme.neutral100,
                  borderTopColor: theme.backgroundElement,
                },
              ]}
            >
              {/* Camera Button */}
              <Pressable
                testID="comment-attach-photo-button"
                accessibilityRole="button"
                accessibilityLabel="Attach photo"
                onPress={handlePickCommentPhoto}
                disabled={isSubmittingComment}
                hitSlop={8}
                style={({ pressed }) => [
                  styles.cameraButton,
                  {
                    backgroundColor: theme.background,
                    borderColor: pendingPhotos.length > 0 ? theme.neutral900 : theme.neutral200,
                  },
                  (pressed || pendingPhotos.length >= MAX_COMMENT_PHOTOS) && styles.pressedOpacity,
                ]}
              >
                <Text style={styles.cameraButtonIcon}>📷</Text>
              </Pressable>

              {/* Input field */}
              <TextInput
                testID="comment-input"
                value={newCommentText}
                onChangeText={setNewCommentText}
                editable={!isSubmittingComment}
                placeholder="Add a comment..."
                placeholderTextColor={theme.neutral500}
                style={[
                  styles.commentTextInput,
                  {
                    backgroundColor: theme.neutral100,
                    color: theme.text,
                    borderColor: theme.neutral200,
                  },
                ]}
              />

              {/* Send Button */}
              <Pressable
                testID="comment-send-button"
                accessibilityRole="button"
                accessibilityLabel="Send comment"
                onPress={handleAddComment}
                disabled={!canSendComment}
                hitSlop={8}
                style={({ pressed }) => [
                  styles.sendButton,
                  {
                    backgroundColor: canSendComment ? theme.neutral900 : theme.neutral400,
                  },
                  pressed && styles.pressedOpacity,
                ]}
              >
                {isSubmittingComment ? (
                  <ActivityIndicator size="small" color={theme.neutral100} />
                ) : (
                  <Text style={styles.sendButtonIcon}>➤</Text>
                )}
              </Pressable>
            </View>
          </KeyboardAvoidingView>

          {previewImageUrl ? (
            <Pressable
              testID="comment-image-lightbox"
              accessibilityRole="button"
              accessibilityLabel="Close photo preview"
              onPress={() => setPreviewImageUrl(null)}
              style={styles.lightboxOverlay}
            >
              <View style={styles.lightboxCloseBadge}>
                <Text style={styles.lightboxCloseText}>✕</Text>
              </View>
              <Image
                source={{ uri: previewImageUrl }}
                style={styles.lightboxImage}
                contentFit="contain"
              />
            </Pressable>
          ) : null}
        </SafeAreaView>
      </ProfilePanelProvider>
    </Modal>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
    },
    keyboardContainer: {
      flex: 1,
    },
    pressedOpacity: {
      opacity: 0.75,
    },
    /* Navigation Bar */
    navBar: {
      height: 56,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.three,
      borderBottomWidth: 1,
    },
    navActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.one,
    },
    navIconButton: {
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 18,
    },
    backArrowText: {
      fontSize: 22,
      fontWeight: '600',
    },
    navTitle: {
      flex: 1,
      marginHorizontal: Spacing.two,
      fontSize: 16,
      fontWeight: '700',
      textAlign: 'center',
      fontFamily: Fonts.sans,
    },
    shareIconText: {
      fontSize: 20,
      fontWeight: '600',
    },
    /* Scroll Content */
    scrollContent: {
      paddingHorizontal: Spacing.three,
      paddingTop: Spacing.three,
      paddingBottom: Spacing.four,
      gap: Spacing.three,
    },
    card: {
      borderRadius: 18,
      borderWidth: 1,
      padding: Spacing.three,
    },
    /* 1. Header Badges & Info */
    badgeRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.one,
      marginBottom: Spacing.two,
    },
    pillBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 20,
      borderWidth: 1,
      gap: 4,
    },
    pillIcon: {
      fontSize: 12,
    },
    pillText: {
      fontSize: 12,
      fontFamily: Fonts.sans,
      fontWeight: '500',
    },
    refText: {
      fontSize: 12,
      fontFamily: Fonts.mono,
      fontWeight: '500',
    },
    issueTitle: {
      fontSize: 22,
      lineHeight: 28,
      fontWeight: '800',
      marginBottom: Spacing.three,
      fontFamily: Fonts.sans,
    },
    locationBox: {
      borderRadius: 12,
      borderWidth: 1,
      padding: Spacing.two,
      gap: 4,
    },
    locationHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    pinIcon: {
      fontSize: 14,
    },
    addressText: {
      fontSize: 14,
      fontWeight: '600',
      fontFamily: Fonts.sans,
      flex: 1,
    },
    coordinatesText: {
      fontSize: 12,
      paddingLeft: 20,
      fontFamily: Fonts.mono,
    },
    /* 2. Photo & Overlays */
    photoContainer: {
      position: 'relative',
      width: '100%',
      height: 220,
      borderRadius: 14,
      overflow: 'hidden',
    },
    detailPhoto: {
      width: '100%',
      height: '100%',
    },
    photoPlaceholder: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    placeholderIcon: {
      fontSize: 32,
    },
    placeholderText: {
      fontSize: 14,
      fontWeight: '500',
    },
    overlayStatusPill: {
      position: 'absolute',
      top: 12,
      left: 12,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: `${theme.background}F2`,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 16,
      gap: 6,
      borderWidth: 1,
      borderColor: theme.accent200,
    },
    statusDotAmber: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.accent500,
    },
    overlayStatusText: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.accent700,
    },
    overlayCitizenPill: {
      position: 'absolute',
      top: 12,
      right: 12,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: `${theme.neutral100}EB`,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 16,
      gap: 6,
    },
    overlayCameraIcon: {
      fontSize: 12,
    },
    overlayCitizenText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.neutral900,
    },
    overlayLocationPill: {
      position: 'absolute',
      bottom: 12,
      left: 12,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: `${theme.text}D1`,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 16,
      gap: 4,
    },
    overlayPinIcon: {
      fontSize: 12,
    },
    overlayLocationText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.neutral100,
    },
    mapFooterRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: Spacing.two,
    },
    gpsVerifiedRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flex: 1,
    },
    gpsDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.neutral700,
    },
    gpsText: {
      fontSize: 12,
      fontFamily: Fonts.sans,
    },
    fullMapLink: {
      paddingLeft: Spacing.one,
    },
    fullMapText: {
      fontSize: 12,
      fontWeight: '700',
    },
    /* 3. Community Action */
    cardHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: Spacing.two,
    },
    sectionHeaderTitle: {
      fontSize: 15,
      fontWeight: '700',
    },
    sectionHeaderSub: {
      fontSize: 12,
    },
    actionButtonsRow: {
      flexDirection: 'row',
      gap: Spacing.two,
    },
    primaryActionButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      borderRadius: 12,
      gap: 6,
    },
    upvoteArrowSymbol: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.neutral100,
    },
    primaryActionButtonText: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.neutral100,
    },
    secondaryActionButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1,
      gap: 6,
    },
    confirmCheckSymbol: {
      fontSize: 15,
      fontWeight: '700',
    },
    secondaryActionButtonText: {
      fontSize: 13,
      fontWeight: '700',
    },
    /* 4. Timeline */
    rowAlign: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    pulseIcon: {
      fontSize: 16,
    },
    arrCodeText: {
      fontSize: 12,
      fontFamily: Fonts.mono,
    },
    timelineList: {
      paddingTop: Spacing.one,
    },
    timelineRow: {
      flexDirection: 'row',
      minHeight: 56,
    },
    timelineLeftCol: {
      width: 32,
      alignItems: 'center',
      position: 'relative',
    },
    completedNode: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: theme.neutral700,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2,
    },
    completedNodeCheck: {
      color: theme.neutral100,
      fontSize: 12,
      fontWeight: '800',
    },
    activeNodeOuter: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      borderColor: theme.neutral900,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.neutral100,
      zIndex: 2,
    },
    activeNodeInner: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: theme.neutral900,
    },
    pendingNode: {
      width: 16,
      height: 16,
      borderRadius: 8,
      borderWidth: 2,
      borderColor: theme.neutral500,
      backgroundColor: theme.neutral100,
      zIndex: 2,
    },
    timelineConnector: {
      position: 'absolute',
      top: 20,
      bottom: -4,
      width: 2,
      zIndex: 1,
    },
    timelineContentCol: {
      flex: 1,
      paddingLeft: 8,
      paddingBottom: Spacing.two,
    },
    activeStepBox: {
      borderRadius: 12,
      borderWidth: 1,
      padding: Spacing.two,
    },
    normalStepBox: {
      paddingVertical: 2,
    },
    stepTitleRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 2,
    },
    activeStepTitle: {
      fontSize: 13,
      fontWeight: '700',
    },
    activeStepTime: {
      fontSize: 12,
      fontWeight: '600',
    },
    activeStepSubtitle: {
      fontSize: 12,
      lineHeight: 16,
    },
    stepTitle: {
      fontSize: 13,
      fontWeight: '600',
    },
    stepTime: {
      fontSize: 12,
    },
    stepSubtitle: {
      fontSize: 12,
      lineHeight: 16,
    },
    /* 5. Comments Section */
    chatIcon: {
      fontSize: 16,
    },
    updatesCountText: {
      fontSize: 12,
    },
    commentsList: {
      gap: Spacing.two,
      paddingTop: Spacing.one,
    },
    officialResponseCard: {
      borderRadius: 14,
      borderWidth: 1,
      padding: Spacing.two,
      gap: Spacing.two,
    },
    officialHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    officialBadgeCircle: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: theme.neutral700,
      alignItems: 'center',
      justifyContent: 'center',
    },
    officialCheckIcon: {
      color: theme.neutral100,
      fontSize: 13,
      fontWeight: '800',
    },
    officialHeaderTextGroup: {
      flex: 1,
    },
    officialTitleText: {
      fontSize: 14,
      fontWeight: '700',
    },
    officialHandleText: {
      fontSize: 12,
    },
    officialTimeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    clockIcon: {
      fontSize: 11,
    },
    quoteBox: {
      borderRadius: 10,
      borderWidth: 1,
      padding: Spacing.two,
    },
    quoteText: {
      fontSize: 13,
      lineHeight: 18,
      fontStyle: 'italic',
    },
    officialFooterRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    shieldCheckIcon: {
      fontSize: 12,
    },
    officialFooterText: {
      fontSize: 12,
      fontWeight: '500',
    },
    commentItemCard: {
      borderRadius: 14,
      borderWidth: 1,
      padding: Spacing.two,
      gap: 6,
    },
    commentHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    avatarCircle: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 8,
    },
    avatarInitialsText: {
      color: theme.neutral100,
      fontSize: 11,
      fontWeight: '700',
    },
    commentUserGroup: {
      flex: 1,
    },
    commentUserMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    commentAuthorHandle: {
      fontSize: 13,
      fontWeight: '700',
    },
    commentBadgePill: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 12,
      borderWidth: 1,
    },
    commentBadgeText: {
      fontSize: 11,
    },
    commentTimeText: {
      fontSize: 11,
    },
    commentBodyText: {
      fontSize: 13,
      lineHeight: 18,
    },
    commentImagesRow: {
      flexDirection: 'row',
      gap: 8,
      paddingTop: 4,
    },
    commentImageThumb: {
      width: 112,
      height: 84,
      borderRadius: 10,
      borderWidth: 1,
    },
    pendingPhotosBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.three,
      paddingVertical: 8,
      borderTopWidth: 1,
      gap: Spacing.two,
    },
    pendingPhotosList: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    pendingPhotoWrap: {
      position: 'relative',
      width: 56,
      height: 56,
    },
    pendingPhotoThumb: {
      width: 56,
      height: 56,
      borderRadius: 10,
    },
    pendingPhotoRemoveBtn: {
      position: 'absolute',
      top: -6,
      right: -6,
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: `${theme.text}E0`,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pendingPhotoRemoveText: {
      color: theme.neutral100,
      fontSize: 11,
      fontWeight: '700',
    },
    pendingPhotosCount: {
      fontSize: 12,
      fontWeight: '600',
    },
    lightboxOverlay: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      backgroundColor: `${theme.text}E6`,
      alignItems: 'center',
      justifyContent: 'center',
      padding: Spacing.three,
      zIndex: 50,
    },
    lightboxCloseBadge: {
      position: 'absolute',
      top: 20,
      right: 20,
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: `${theme.neutral100}33`,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 51,
    },
    lightboxCloseText: {
      color: theme.neutral100,
      fontSize: 16,
      fontWeight: '700',
    },
    lightboxImage: {
      width: '100%',
      height: '80%',
    },
    /* Bottom Comment Input Bar */
    bottomInputBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.two,
      borderTopWidth: 1,
      gap: Spacing.two,
    },
    cameraButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cameraButtonIcon: {
      fontSize: 18,
    },
    commentTextInput: {
      flex: 1,
      height: 40,
      borderRadius: 20,
      borderWidth: 1,
      paddingHorizontal: 16,
      fontSize: 14,
    },
    sendButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendButtonIcon: {
      color: theme.neutral100,
      fontSize: 16,
      marginLeft: 2,
    },
  });

export default IssueDetailScreen;

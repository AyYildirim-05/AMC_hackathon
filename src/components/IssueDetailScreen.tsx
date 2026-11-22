import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useMemo, useState } from 'react';
import {
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

import dummyDistricts from '../../dummy_data/districts.json';
import dummyComments from '../../dummy_data/issue_comments.json';
import dummyPersons from '../../dummy_data/person.json';

import { type District } from '@/components/map/map-utils';
import { ProfileButton } from '@/components/profile-button';
import { ThemedText } from '@/components/themed-text';
import { computeInitials } from '@/components/utils/formatter';
import { Fonts, Spacing } from '@/constants/theme';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useTheme } from '@/hooks/use-theme';
import { fetchDistricts } from '@/lib/api/districts';
import {
  type ApiIssueComment,
  createIssueComment,
  fetchIssueComments,
  fetchMyVotes,
  isLiveApiEnabled,
  isServerObjectId,
  toggleIssueVote,
} from '@/lib/api/issues';
import { type Issue } from '@/models/Issue';
import { useAuth } from '@/providers/auth-provider';

export interface IssueCommentItem {
  id: string;
  issue_id: string;
  user_id: string;
  body: string;
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

/** Looks up borough or district name. */
export function getDistrictName(districtId?: string, districts?: readonly District[]): string {
  if (!districtId) return 'Montréal';
  const source = districts ?? (dummyDistricts.districts as District[]);
  const match = source.find((d) => d.id === districtId);
  return match?.name_fr || match?.name_en || 'Le Plateau-Mont-Royal';
}

function mapApiCommentToItem(c: ApiIssueComment): IssueCommentItem {
  const username = c.author?.username || (c.isOfficialResponse ? 'city_official' : 'citoyen');
  const isVerification = !c.isOfficialResponse && c.body.toLowerCase().includes('confirmed');
  return {
    id: c.id,
    issue_id: c.issueId,
    user_id: c.userId,
    body: c.body,
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

/** Resolves initial comments for an issue from dummy data. */
function getInitialComments(issue: Issue): IssueCommentItem[] {
  const rawComments = dummyComments.issue_comments.filter((c) => c.issue_id === issue.id);

  if (rawComments.length === 0 && issue.official_response) {
    return [
      {
        id: `official-${issue.id}`,
        issue_id: issue.id,
        user_id: 'official-user',
        body: issue.official_response.comment,
        is_official_response: true,
        created_at: issue.updated_at || issue.created_at,
        username: issue.official_response.author,
        displayName: issue.official_response.author,
      },
    ];
  }

  return rawComments.map((c, index) => {
    const person = dummyPersons.persons.find((p) => p.id === c.user_id);
    const username = person?.username || (c.is_official_response ? 'camille_mtl' : 'marc_velo');
    const isVerification = index === 2 || c.body.toLowerCase().includes('confirmed');

    return {
      id: c.id,
      issue_id: c.issue_id,
      user_id: c.user_id,
      body: c.body,
      is_official_response: c.is_official_response,
      created_at: c.created_at,
      username,
      displayName: person?.username ? `@${person.username}` : `@${username}`,
      badge: c.is_official_response
        ? undefined
        : isVerification
          ? 'Field Verification'
          : 'Resident',
      isFieldVerification: isVerification,
    };
  });
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
        subtitle: 'Ticket créé et géolocalisé via CityPulse MTL',
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
      subtitle: 'Ticket créé et géolocalisé via CityPulse MTL',
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
  const isDark = theme.text !== '#1C211F';
  const user = useCurrentUser();
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const liveApi = isLiveApiEnabled();
  const isServerIssue = liveApi && isServerObjectId(issue.id);

  const { data: apiDistricts } = useQuery<District[]>({
    queryKey: ['districts'],
    queryFn: fetchDistricts,
    enabled: liveApi,
  });

  const { data: apiComments } = useQuery<ApiIssueComment[]>({
    queryKey: ['issues', issue.id, 'comments'],
    queryFn: () => fetchIssueComments(issue.id),
    enabled: visible && isServerIssue,
  });

  const { data: myVotes } = useQuery({
    queryKey: ['votes', 'me'],
    queryFn: fetchMyVotes,
    enabled: visible && liveApi && isAuthenticated,
  });

  // Interactive state (derived from server data when backed by API; local overrides otherwise)
  const [localVotes, setLocalVotes] = useState<{
    issueId: string;
    isUpvoted: boolean;
    upvoteCount: number;
    isConfirmed: boolean;
    confirmCount: number;
  } | null>(null);
  const [addedLocalComments, setAddedLocalComments] = useState<Record<string, IssueCommentItem[]>>(
    {},
  );
  const [newCommentText, setNewCommentText] = useState<string>('');

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
      void queryClient.invalidateQueries({ queryKey: ['issues'] });
      void queryClient.invalidateQueries({ queryKey: ['votes', 'me'] });
      void queryClient.invalidateQueries({ queryKey: ['profile', 'me'] });
    },
  });

  const commentMutation = useMutation({
    mutationFn: ({ body, isOfficial }: { body: string; isOfficial: boolean }) =>
      createIssueComment(issue.id, body, isOfficial),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['issues', issue.id, 'comments'] });
      void queryClient.invalidateQueries({ queryKey: ['issues'] });
      void queryClient.invalidateQueries({ queryKey: ['profile', 'me'] });
    },
  });

  const comments = useMemo<IssueCommentItem[]>(() => {
    if (isServerIssue) {
      return (apiComments ?? []).map(mapApiCommentToItem);
    }
    return [...getInitialComments(issue), ...(addedLocalComments[issue.id] ?? [])];
  }, [isServerIssue, apiComments, issue, addedLocalComments]);

  const authorHandle = issue.author?.username || 'marc_velo';
  const matchedDistrict = apiDistricts?.find((d) => d.id === issue.district_id);
  const districtName = liveApi
    ? matchedDistrict?.name_fr || matchedDistrict?.name_en || 'Montréal'
    : getDistrictName(issue.district_id);
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
    if (isServerIssue) {
      voteMutation.mutate('upvote');
      return;
    }
    onUpvote?.(issue.id, nextCount);
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
    if (isServerIssue) {
      voteMutation.mutate('confirm_resolved');
      return;
    }
    onConfirmResolution?.(issue.id, nextCount);
  };

  const handleAddComment = () => {
    const trimmed = newCommentText.trim();
    if (!trimmed) return;

    if (isServerIssue) {
      const isDistrictManagerForIssue =
        Boolean(user?.id) &&
        ((matchedDistrict?.manager_id != null && matchedDistrict.manager_id === user?.id) ||
          user?.role === 'admin');
      setNewCommentText('');
      commentMutation.mutate({ body: trimmed, isOfficial: isDistrictManagerForIssue });
      return;
    }

    const newComment: IssueCommentItem = {
      id: `comment-${Date.now()}`,
      issue_id: issue.id,
      user_id: user?.id ?? 'current-user',
      body: trimmed,
      is_official_response: false,
      created_at: new Date().toISOString(),
      username: authorHandle,
      displayName: `@${authorHandle}`,
      badge: 'Resident',
      isFieldVerification: false,
    };

    setAddedLocalComments((prev) => ({
      ...prev,
      [issue.id]: [...(prev[issue.id] ?? []), newComment],
    }));
    setNewCommentText('');
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
      <SafeAreaView
        testID={testID}
        style={[styles.safeArea, { backgroundColor: isDark ? '#1A211D' : '#F7FAF8' }]}
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
                backgroundColor: isDark ? '#1A211D' : '#FFFFFF',
                borderBottomColor: isDark ? '#2C3A33' : '#E5E9E7',
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
              <Text style={[styles.backArrowText, { color: isDark ? '#E5F2EA' : '#1C211F' }]}>
                ←
              </Text>
            </Pressable>

            <Text
              numberOfLines={1}
              ellipsizeMode="tail"
              style={[styles.navTitle, { color: isDark ? '#E5F2EA' : '#1C211F' }]}
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
                <Text style={[styles.shareIconText, { color: isDark ? '#E5F2EA' : '#1C211F' }]}>
                  ↗
                </Text>
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
                  backgroundColor: isDark ? '#232D28' : '#FFFFFF',
                  borderColor: isDark ? '#35433C' : '#E8EEEA',
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
                      backgroundColor: isDark ? '#2C3932' : '#F1F4F2',
                      borderColor: isDark ? '#3B4D44' : '#E2E8E4',
                    },
                  ]}
                >
                  <Text style={styles.pillIcon}>🚧</Text>
                  <Text style={[styles.pillText, { color: isDark ? '#CFE2D7' : '#334139' }]}>
                    Traffic & Safety
                  </Text>
                </View>

                {/* District Verified Pill */}
                <View
                  style={[
                    styles.pillBadge,
                    {
                      backgroundColor: isDark ? '#1C3D2B' : '#ECF7F0',
                      borderColor: isDark ? '#2B5E43' : '#C7EAD4',
                    },
                  ]}
                >
                  <Text style={[styles.pillIcon, { color: isDark ? '#7EE0A7' : '#15803D' }]}>
                    ✓
                  </Text>
                  <Text
                    style={[
                      styles.pillText,
                      { color: isDark ? '#A7F3D0' : '#166534', fontWeight: '600' },
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
                        backgroundColor: isDark ? '#2A3630' : '#F1F4F2',
                        borderColor: isDark ? '#384B42' : '#E5EAE7',
                      },
                    ]}
                  >
                    <Text style={[styles.refText, { color: isDark ? '#A6C4B4' : '#5A6C63' }]}>
                      # {issue.external_311_ref}
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* Large Issue Title */}
              <Text style={[styles.issueTitle, { color: isDark ? '#F0FAF4' : '#141E18' }]}>
                {issue.title}
              </Text>

              {/* Location & Reported Info Box */}
              <View
                style={[
                  styles.locationBox,
                  {
                    backgroundColor: isDark ? '#1D2521' : '#F4F7F5',
                    borderColor: isDark ? '#2C3A33' : '#E8EDE9',
                  },
                ]}
              >
                <View style={styles.locationHeaderRow}>
                  <Text style={styles.pinIcon}>📍</Text>
                  <Text
                    numberOfLines={1}
                    style={[styles.addressText, { color: isDark ? '#E5F2EA' : '#1E2B24' }]}
                  >
                    {issue.address}
                  </Text>
                </View>
                <Text
                  numberOfLines={1}
                  style={[styles.coordinatesText, { color: isDark ? '#8CB39D' : '#6A7D73' }]}
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
                  backgroundColor: isDark ? '#232D28' : '#FFFFFF',
                  borderColor: isDark ? '#35433C' : '#E8EEEA',
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
                      { backgroundColor: isDark ? '#1F2A24' : '#E8F0EB' },
                    ]}
                  >
                    <Text style={styles.placeholderIcon}>📷</Text>
                    <Text
                      style={[styles.placeholderText, { color: isDark ? '#8CB39D' : '#5A6C63' }]}
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
                  <Text style={[styles.gpsText, { color: isDark ? '#9ECEB0' : '#495C51' }]}>
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
                  <Text style={[styles.fullMapText, { color: isDark ? '#A7F3D0' : '#14532D' }]}>
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
                  backgroundColor: isDark ? '#232D28' : '#FFFFFF',
                  borderColor: isDark ? '#35433C' : '#E8EEEA',
                },
              ]}
            >
              <View style={styles.cardHeaderRow}>
                <ThemedText type="smallBold" style={styles.sectionHeaderTitle}>
                  Community Action & Validation
                </ThemedText>
                <Text style={[styles.sectionHeaderSub, { color: isDark ? '#8CB39D' : '#6A7D73' }]}>
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
                      backgroundColor: isUpvoted
                        ? isDark
                          ? '#15613B'
                          : '#0F4E2E'
                        : isDark
                          ? '#2A4D3B'
                          : '#1D3B2C',
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
                      backgroundColor: isConfirmed
                        ? isDark
                          ? '#1C4A32'
                          : '#C7EAD4'
                        : isDark
                          ? '#1E362A'
                          : '#EDF7F1',
                      borderColor: isDark ? '#326649' : '#C4E5D1',
                    },
                    pressed && styles.pressedOpacity,
                  ]}
                >
                  <Text
                    style={[styles.confirmCheckSymbol, { color: isDark ? '#7EE0A7' : '#14532D' }]}
                  >
                    ✓
                  </Text>
                  <Text
                    style={[
                      styles.secondaryActionButtonText,
                      { color: isDark ? '#A7F3D0' : '#14532D' },
                    ]}
                  >
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
                  backgroundColor: isDark ? '#232D28' : '#FFFFFF',
                  borderColor: isDark ? '#35433C' : '#E8EEEA',
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
                <Text style={[styles.arrCodeText, { color: isDark ? '#8CB39D' : '#6A7D73' }]}>
                  ARR-08-311
                </Text>
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
                                  ? '#15803D'
                                  : isDark
                                    ? '#35453C'
                                    : '#D8DFDB',
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
                                backgroundColor: isDark ? '#1C2922' : '#F0F5F2',
                                borderColor: isDark ? '#2B4A39' : '#DDE8E1',
                              },
                            ]}
                          >
                            <View style={styles.stepTitleRow}>
                              <Text
                                style={[
                                  styles.activeStepTitle,
                                  { color: isDark ? '#F0FAF4' : '#141E18' },
                                ]}
                              >
                                {step.title}
                              </Text>
                              <Text
                                style={[
                                  styles.activeStepTime,
                                  { color: isDark ? '#9ECEB0' : '#495C51' },
                                ]}
                              >
                                {step.time}
                              </Text>
                            </View>
                            <Text
                              style={[
                                styles.activeStepSubtitle,
                                { color: isDark ? '#8CB39D' : '#5A6C63' },
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
                                    color: isCompleted
                                      ? isDark
                                        ? '#E5F2EA'
                                        : '#1C211F'
                                      : isDark
                                        ? '#698875'
                                        : '#8C9E94',
                                  },
                                ]}
                              >
                                {step.title}
                              </Text>
                              <Text
                                style={[
                                  styles.stepTime,
                                  {
                                    color: isCompleted
                                      ? isDark
                                        ? '#8CB39D'
                                        : '#5A6C63'
                                      : isDark
                                        ? '#597163'
                                        : '#A0B0A7',
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
                                  color: isCompleted
                                    ? isDark
                                      ? '#8CB39D'
                                      : '#5A6C63'
                                    : isDark
                                      ? '#6A7D73'
                                      : '#8C9E94',
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
                  backgroundColor: isDark ? '#232D28' : '#FFFFFF',
                  borderColor: isDark ? '#35433C' : '#E8EEEA',
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
                <Text style={[styles.updatesCountText, { color: isDark ? '#8CB39D' : '#6A7D73' }]}>
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
                            backgroundColor: isDark ? '#1C2D24' : '#F2F7F4',
                            borderColor: isDark ? '#294B37' : '#D4E6DC',
                          },
                        ]}
                      >
                        <View style={styles.officialHeaderRow}>
                          <View style={styles.officialBadgeCircle}>
                            <Text style={styles.officialCheckIcon}>✓</Text>
                          </View>
                          <View style={styles.officialHeaderTextGroup}>
                            <Text
                              style={[
                                styles.officialTitleText,
                                { color: isDark ? '#F0FAF4' : '#141E18' },
                              ]}
                            >
                              Official Borough Response
                            </Text>
                            <Text
                              style={[
                                styles.officialHandleText,
                                { color: isDark ? '#8CB39D' : '#5A6C63' },
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
                                { color: isDark ? '#8CB39D' : '#6A7D73' },
                              ]}
                            >
                              {formatCommentDate(comment.created_at)}
                            </Text>
                          </View>
                        </View>

                        {/* Nested quote card */}
                        <View
                          style={[
                            styles.quoteBox,
                            {
                              backgroundColor: isDark ? '#22382D' : '#FFFFFF',
                              borderColor: isDark ? '#2E503D' : '#E0ECE4',
                            },
                          ]}
                        >
                          <Text
                            style={[styles.quoteText, { color: isDark ? '#DDEFE5' : '#233229' }]}
                          >
                            &ldquo;{comment.body}&rdquo;
                          </Text>
                        </View>

                        {/* Official Ticket Footer */}
                        <View style={styles.officialFooterRow}>
                          <Text style={styles.shieldCheckIcon}>🛡️</Text>
                          <Text
                            style={[
                              styles.officialFooterText,
                              { color: isDark ? '#8CB39D' : '#495C51' },
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
                          backgroundColor: isDark ? '#202924' : '#F9FBFA',
                          borderColor: isDark ? '#2E3D35' : '#E8EDE9',
                        },
                      ]}
                    >
                      <View style={styles.commentHeaderRow}>
                        {/* Avatar */}
                        <View
                          style={[
                            styles.avatarCircle,
                            { backgroundColor: isDark ? '#2A4436' : '#203A2B' },
                          ]}
                        >
                          <Text style={styles.avatarInitialsText}>{initials}</Text>
                        </View>

                        {/* User info & badges */}
                        <View style={styles.commentUserGroup}>
                          <View style={styles.commentUserMetaRow}>
                            <Text
                              style={[
                                styles.commentAuthorHandle,
                                { color: isDark ? '#F0FAF4' : '#141E18' },
                              ]}
                            >
                              {comment.displayName}
                            </Text>

                            {comment.badge ? (
                              <View
                                style={[
                                  styles.commentBadgePill,
                                  comment.isFieldVerification
                                    ? {
                                        backgroundColor: isDark ? '#1C4A32' : '#C6EED4',
                                        borderColor: isDark ? '#2E6E4B' : '#A7E1BB',
                                      }
                                    : {
                                        backgroundColor: isDark ? '#2C3932' : '#E8EDE9',
                                        borderColor: isDark ? '#3B4D44' : '#DDE4DF',
                                      },
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.commentBadgeText,
                                    comment.isFieldVerification
                                      ? { color: isDark ? '#A7F3D0' : '#12542B', fontWeight: '600' }
                                      : { color: isDark ? '#CFE2D7' : '#495C51' },
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
                            { color: isDark ? '#8CB39D' : '#6A7D73' },
                          ]}
                        >
                          {formatCommentDate(comment.created_at)}
                        </Text>
                      </View>

                      {/* Comment body */}
                      <Text
                        style={[styles.commentBodyText, { color: isDark ? '#D8E8DF' : '#2A3630' }]}
                      >
                        {comment.body}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>

            <View style={{ height: 24 }} />
          </ScrollView>

          {/* ─── Fixed Bottom Comment Input Bar ─── */}
          <View
            style={[
              styles.bottomInputBar,
              {
                backgroundColor: isDark ? '#1A211D' : '#FFFFFF',
                borderTopColor: isDark ? '#2C3A33' : '#E5EAE7',
              },
            ]}
          >
            {/* Camera Button */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Attach photo"
              hitSlop={8}
              style={[
                styles.cameraButton,
                {
                  backgroundColor: isDark ? '#24302A' : '#EFF3F0',
                  borderColor: isDark ? '#33443C' : '#DFE5E1',
                },
              ]}
            >
              <Text style={styles.cameraButtonIcon}>📷</Text>
            </Pressable>

            {/* Input field */}
            <TextInput
              testID="comment-input"
              value={newCommentText}
              onChangeText={setNewCommentText}
              placeholder="Add a comment..."
              placeholderTextColor={isDark ? '#698875' : '#8C9E94'}
              style={[
                styles.commentTextInput,
                {
                  backgroundColor: isDark ? '#24302A' : '#F3F6F4',
                  color: isDark ? '#F0FAF4' : '#141E18',
                  borderColor: isDark ? '#33443C' : '#E0E6E2',
                },
              ]}
            />

            {/* Send Button */}
            <Pressable
              testID="comment-send-button"
              accessibilityRole="button"
              accessibilityLabel="Send comment"
              onPress={handleAddComment}
              hitSlop={8}
              style={({ pressed }) => [
                styles.sendButton,
                {
                  backgroundColor: newCommentText.trim()
                    ? '#1E3B2C'
                    : isDark
                      ? '#24352C'
                      : '#9EBAA9',
                },
                pressed && styles.pressedOpacity,
              ]}
            >
              <Text style={styles.sendButtonIcon}>➤</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
    backgroundColor: 'rgba(254, 243, 199, 0.95)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
    gap: 6,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  statusDotAmber: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D97706',
  },
  overlayStatusText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#92400E',
  },
  overlayCitizenPill: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
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
    color: '#1F2937',
  },
  overlayLocationPill: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(17, 24, 39, 0.82)',
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
    color: '#F9FAFB',
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
    backgroundColor: '#15803D',
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
    color: '#FFFFFF',
  },
  primaryActionButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
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
    backgroundColor: '#15803D',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  completedNodeCheck: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  activeNodeOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#1E3B2C',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    zIndex: 2,
  },
  activeNodeInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#1E3B2C',
  },
  pendingNode: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#9CA3AF',
    backgroundColor: '#FFFFFF',
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
    backgroundColor: '#15803D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  officialCheckIcon: {
    color: '#FFFFFF',
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
    color: '#FFFFFF',
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
    color: '#FFFFFF',
    fontSize: 16,
    marginLeft: 2,
  },
});

export default IssueDetailScreen;

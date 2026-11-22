import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
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
import { SafeAreaInsetsContext, SafeAreaView } from 'react-native-safe-area-context';

import { type Theme, useThemedStyles } from '@/hooks/use-themed-styles';
import { IssueCard } from '@/components/layout/IssueCard';
import { useProfilePanel } from '@/components/layout/profile-panel';
import { IncidentPreviewSheet } from '@/components/map/IncidentPreviewSheet';
import { IssueListSheet } from '@/components/map/IssueListSheet';
import { MapIcon, type MapIconName } from '@/components/map/MapIcon';
import { MontrealMapCanvas, type MontrealMapHandle } from '@/components/map/MontrealMapCanvas';
import { RoadworkPreviewCard } from '@/components/map/RoadworkPreviewCard';
import { BoroughPickerSheet } from '@/components/utils/borough-picker-sheet';
import { RoadworksFilterBar } from '@/components/map/RoadworksFilterBar';
import {
  BOROUGH_REGIONS,
  type CategoryFilter,
  type District,
  filterMapIssues,
  getCategoryCounts,
  getDistrictName,
  type MapLayerMode,
  MONTREAL_DEFAULT_REGION,
  nextLayerMode,
  type StatusFilter,
} from '@/components/utils/map-utils';
import { ThemedText } from '@/components/utils/themed-text';
import { computeInitials } from '@/components/utils/formatter';
import { BottomTabInset, Fonts, MaxContentWidth, Spacing } from '@/constants/theme';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useTheme } from '@/hooks/use-theme';
import { isSupportedLanguage } from '@/i18n';
import { fetchDistricts } from '@/lib/api/districts';
import { fetchIssues, fetchMyVotes, toggleIssueVote } from '@/lib/api/issues';
import { fetchRoadworks, type RoadworkType, type RoadworkWhen } from '@/lib/api/roadworks';
import { ISSUE_CATEGORIES, ISSUE_STATUSES, type Issue, type IssueCategory } from '@/models/Issue';
import { useAuth } from '@/providers/auth-provider';

function getCategoryChipIcon(category: IssueCategory): MapIconName {
  switch (category) {
    case 'traffic_safety':
      return 'bike';
    case 'roads_potholes':
      return 'pothole';
    case 'streetlights_utilities':
      return 'lightbulb';
  }
}

/**
 * Interactive Montreal civic issues map page ("Carte" tab).
 * Uses `react-native-maps` on iOS/Android and Leaflet on Web for a live interactive map.
 */
export default function CardScreen() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const user = useCurrentUser();
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const currentLang = isSupportedLanguage(i18n.language) ? i18n.language : 'fr';

  const mapRef = useRef<MontrealMapHandle>(null);
  // The native tab bar floats over the bottom of the map. iOS reports it inside the bottom safe-area
  // inset (as in TabScreen); Android uses the fixed inset. The context is null outside a provider.
  const safeAreaInsets = useContext(SafeAreaInsetsContext);
  const tabBarInset = Platform.OS === 'ios' ? (safeAreaInsets?.bottom ?? 0) : BottomTabInset;

  const { data: issues = [] } = useQuery<Issue[]>({
    queryKey: ['issues'],
    queryFn: fetchIssues,
  });

  const { data: districts = [] } = useQuery<District[]>({
    queryKey: ['districts'],
    queryFn: fetchDistricts,
  });

  const { data: myVotes } = useQuery({
    queryKey: ['votes', 'me'],
    queryFn: fetchMyVotes,
    enabled: isAuthenticated,
  });

  const voteMutation = useMutation({
    mutationFn: ({
      issueId,
      voteType,
    }: {
      issueId: string;
      voteType: 'upvote' | 'confirm_resolved';
    }) => toggleIssueVote(issueId, voteType),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['issues'] });
      void queryClient.invalidateQueries({ queryKey: ['votes', 'me'] });
      void queryClient.invalidateQueries({ queryKey: ['profile', 'me'] });
    },
  });

  // Search & filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('all');
  const [selectedStatus, setSelectedStatus] = useState<StatusFilter>('all');
  const [selectedDistrictId, setSelectedDistrictId] = useState<string | 'all'>('all');
  const [showStatusFilters, setShowStatusFilters] = useState(false);

  // Map layer state
  const [layerMode, setLayerMode] = useState<MapLayerMode>('standard');

  // City of Montréal roadworks layer (open data) and its own filters, shown when the map opens.
  // Building sites and "other" permits are most of the data, so it starts with the street-network
  // types only.
  const [showRoadworks, setShowRoadworks] = useState(true);
  const [roadworkTypes, setRoadworkTypes] = useState<RoadworkType[]>([
    'roads',
    'water',
    'utilities',
  ]);
  const [roadworkWhen, setRoadworkWhen] = useState<RoadworkWhen>('active');
  const [roadworkCityOnly, setRoadworkCityOnly] = useState(false);
  const [selectedRoadworkId, setSelectedRoadworkId] = useState<string | null>(null);

  // Works in the selected borough, or in every borough the app knows when "All boroughs" is on.
  const roadworkBoroughs = useMemo(() => {
    if (selectedDistrictId !== 'all') {
      const district = districts.find((d) => d.id === selectedDistrictId);
      return district ? [district.name_fr] : [];
    }
    return districts.map((d) => d.name_fr).filter(Boolean);
  }, [districts, selectedDistrictId]);

  const roadworksQuery = useQuery({
    queryKey: ['roadworks', roadworkBoroughs, roadworkTypes, roadworkCityOnly, roadworkWhen],
    queryFn: () =>
      fetchRoadworks({
        boroughs: roadworkBoroughs,
        types: roadworkTypes,
        cityOnly: roadworkCityOnly,
        when: roadworkWhen,
      }),
    // Without known boroughs the server would return the whole city (~1,000 works).
    enabled: showRoadworks && roadworkBoroughs.length > 0,
    // The city refreshes the data daily and the server caches it for an hour.
    staleTime: 10 * 60 * 1000,
    placeholderData: (previous) => previous,
  });
  const roadworks = useMemo(
    () => (showRoadworks ? (roadworksQuery.data?.works ?? []) : []),
    [showRoadworks, roadworksQuery.data],
  );
  const selectedRoadwork = useMemo(
    () => roadworks.find((work) => work.id === selectedRoadworkId) ?? null,
    [roadworks, selectedRoadworkId],
  );

  const toggleRoadworkType = (type: RoadworkType) =>
    setRoadworkTypes((current) => {
      if (!current.includes(type)) return [...current, type];
      // Keep at least one type: an empty list would mean "every type" to the server.
      return current.length > 1 ? current.filter((item) => item !== type) : current;
    });

  // Selection, modal, and local interaction state
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [boroughModalVisible, setBoroughModalVisible] = useState(false);
  const profilePanel = useProfilePanel();
  const [justShared, setJustShared] = useState(false);
  const shareTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevFocusedIssueIdRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (shareTimerRef.current) clearTimeout(shareTimerRef.current);
    };
  }, []);

  // Counts scoped to current district/query/status (before category filter) so chips stay informative
  const issuesBeforeCategory = useMemo(
    () =>
      filterMapIssues(
        issues,
        {
          query: searchQuery,
          category: 'all',
          status: selectedStatus,
          districtId: selectedDistrictId,
        },
        districts,
      ),
    [issues, districts, searchQuery, selectedStatus, selectedDistrictId],
  );
  const categoryCounts = useMemo(
    () => getCategoryCounts(issuesBeforeCategory),
    [issuesBeforeCategory],
  );

  const filteredIssues = useMemo(
    () =>
      filterMapIssues(
        issues,
        {
          query: searchQuery,
          category: selectedCategory,
          status: selectedStatus,
          districtId: selectedDistrictId,
        },
        districts,
      ),
    [issues, districts, searchQuery, selectedCategory, selectedStatus, selectedDistrictId],
  );

  // Nothing is selected until a marker or a list row is tapped; while nothing is selected the bottom
  // sheet lists every report on the map. A selection hidden by the filters goes back to the list.
  const selectedIssue = useMemo(
    () => filteredIssues.find((item) => item.id === selectedIssueId) ?? null,
    [filteredIssues, selectedIssueId],
  );

  // Smoothly focus the map on each newly selected issue (marker taps also animate on their own)
  useEffect(() => {
    if (!selectedIssue) {
      prevFocusedIssueIdRef.current = null;
      return;
    }
    if (prevFocusedIssueIdRef.current === selectedIssue.id) return;
    prevFocusedIssueIdRef.current = selectedIssue.id;
    mapRef.current?.focusRegion({
      latitude: selectedIssue.latitude,
      longitude: selectedIssue.longitude,
      latitudeDelta: 0.025,
      longitudeDelta: 0.025,
    });
  }, [selectedIssue]);

  const activeBoroughLabel = useMemo(() => {
    if (selectedDistrictId === 'all') {
      return t('map.allBoroughs');
    }
    return getDistrictName(selectedDistrictId, districts, currentLang) ?? t('map.allBoroughs');
  }, [selectedDistrictId, districts, currentLang, t]);

  const selectedIssueDistrictName = selectedIssue
    ? getDistrictName(selectedIssue.district_id, districts, currentLang)
    : null;

  const serverUpvotedSet = useMemo(
    () => new Set(myVotes?.upvotedIssueIds ?? []),
    [myVotes?.upvotedIssueIds],
  );
  const serverConfirmedSet = useMemo(
    () => new Set(myVotes?.confirmedIssueIds ?? []),
    [myVotes?.confirmedIssueIds],
  );

  const isSelectedUpvoted = selectedIssue ? serverUpvotedSet.has(selectedIssue.id) : false;
  const selectedUpvoteCount = selectedIssue ? selectedIssue.upvote_count : 0;
  const isSelectedConfirmed = selectedIssue ? serverConfirmedSet.has(selectedIssue.id) : false;
  const selectedConfirmCount = selectedIssue ? selectedIssue.resolution_confirmations : 0;

  const userInitials = computeInitials(user?.username ?? user?.email ?? 'Citoyen');

  const handleToggleUpvote = (issueId: string) => {
    voteMutation.mutate({ issueId, voteType: 'upvote' });
  };

  const handleToggleConfirm = (issueId: string) => {
    voteMutation.mutate({ issueId, voteType: 'confirm_resolved' });
  };

  const handleShareIssue = async () => {
    if (!selectedIssue) return;
    const refPart = selectedIssue.external_311_ref ? ` (#${selectedIssue.external_311_ref})` : '';
    const message = `${selectedIssue.title}${refPart} — ${selectedIssue.address}`;
    const markShared = () => {
      setJustShared(true);
      if (shareTimerRef.current) clearTimeout(shareTimerRef.current);
      shareTimerRef.current = setTimeout(() => setJustShared(false), 1800);
    };

    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
        if (typeof navigator.share === 'function') {
          await navigator.share({ title: selectedIssue.title, text: message });
          markShared();
          return;
        }
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(message);
          markShared();
          return;
        }
      }
      await Share.share({
        title: selectedIssue.title,
        message,
      });
      markShared();
    } catch {
      // User dismissed share sheet or platform does not support sharing.
    }
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedCategory('all');
    setSelectedStatus('all');
    setSelectedDistrictId('all');
    mapRef.current?.focusRegion(MONTREAL_DEFAULT_REGION);
  };

  const handleSelectDistrict = (districtId: string | 'all') => {
    setSelectedDistrictId(districtId);
    setBoroughModalVisible(false);
    if (districtId === 'all') {
      mapRef.current?.focusRegion(MONTREAL_DEFAULT_REGION);
      return;
    }
    const district = districts.find((d) => d.id === districtId);
    const region = district ? BOROUGH_REGIONS[district.open_north_slug] : undefined;
    if (region) {
      mapRef.current?.focusRegion(region);
    }
  };

  const handleRecenter = () => mapRef.current?.recenter();
  const handleZoomIn = () => mapRef.current?.zoomIn();
  const handleZoomOut = () => mapRef.current?.zoomOut();
  const handleCycleLayer = () => {
    const next = nextLayerMode(layerMode);
    setLayerMode(next);
    // The "Works & REV" layer is where the city's roadworks belong.
    if (next === 'works') setShowRoadworks(true);
  };

  const handleToggleRoadworks = () => {
    setShowRoadworks((prev) => !prev);
    setSelectedRoadworkId(null);
  };

  // Same page background as every other tab (TabScreen / ThemedView).
  const headerBg = theme.background;
  const headerBorder = theme.backgroundElement;
  const pillSurface = `${theme.neutral100}F0`;
  const chipText = theme.neutral800;

  return (
    <View style={[styles.screenRoot, { backgroundColor: headerBg }]}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        {/* ─── Top Header Bar ─── */}
        <View
          style={[styles.headerBar, { backgroundColor: headerBg, borderBottomColor: headerBorder }]}
        >
          <View style={styles.headerLeft}>
            <View style={styles.brandIconBox}>
              <MapIcon name="city" size={18} color={theme.neutral100} />
            </View>
            <View style={styles.brandTextCol}>
              <Text style={[styles.brandTitle, { color: theme.neutral800 }]}>
                {t('map.brandTitle')}
              </Text>
              <Pressable
                testID="map-borough-selector"
                accessibilityRole="button"
                accessibilityLabel={t('map.boroughFilterTitle')}
                onPress={() => setBoroughModalVisible(true)}
                style={styles.boroughTrigger}
              >
                <View style={styles.boroughDot} />
                <Text numberOfLines={1} style={[styles.boroughLabel, { color: theme.neutral800 }]}>
                  {activeBoroughLabel} ▾
                </Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.headerRight}>
            {/* Citizen Profile Avatar */}
            <Pressable
              testID="map-profile-button"
              accessibilityRole="button"
              accessibilityLabel={t('map.profileLabel')}
              onPress={profilePanel.open}
              style={[
                styles.profileAvatar,
                {
                  backgroundColor: theme.neutral200,
                  borderColor: theme.neutral300,
                },
              ]}
            >
              <Text style={[styles.profileInitials, { color: theme.neutral800 }]}>
                {userInitials}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* ─── Live Map Viewport & Floating Overlays ─── */}
        <View style={styles.mapStage}>
          <MontrealMapCanvas
            ref={mapRef}
            issues={filteredIssues}
            selectedIssueId={selectedIssue?.id ?? null}
            onSelectIssue={(issue) => {
              setSelectedIssueId(issue.id);
              setSelectedRoadworkId(null);
            }}
            layerMode={layerMode}
            roadworks={roadworks}
            selectedRoadworkId={selectedRoadwork?.id ?? null}
            onSelectRoadwork={(work) => {
              setSelectedRoadworkId(work.id);
              setSelectedIssueId(null);
            }}
          />

          {/* Floating Top Controls: Search + Category Filter Pills */}
          <View pointerEvents="box-none" style={styles.topControlsOverlay}>
            <View style={styles.searchRow}>
              <View style={[styles.searchBar, { backgroundColor: pillSurface }]}>
                <MapIcon name="search" size={16} color={theme.neutral800} />
                <TextInput
                  testID="map-search-input"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder={t('map.searchPlaceholder')}
                  placeholderTextColor={theme.neutral600}
                  style={[styles.searchInput, { color: theme.text }]}
                  returnKeyType="search"
                />
                {searchQuery.length > 0 ? (
                  <Pressable
                    testID="map-search-clear"
                    accessibilityRole="button"
                    accessibilityLabel={t('map.clearSearch')}
                    onPress={() => setSearchQuery('')}
                    style={[
                      styles.clearBtn,
                      {
                        backgroundColor: theme.backgroundElement,
                      },
                    ]}
                  >
                    <MapIcon name="close" size={13} color={theme.neutral800} />
                  </Pressable>
                ) : null}
              </View>

              <Pressable
                testID="map-advanced-filter-button"
                accessibilityRole="button"
                accessibilityLabel={t('map.filtersLabel')}
                accessibilityState={{ expanded: showStatusFilters }}
                onPress={() => setShowStatusFilters((prev) => !prev)}
                style={({ pressed }) => [
                  styles.tuneButton,
                  showStatusFilters && styles.tuneButtonActive,
                  pressed && styles.pressed,
                ]}
              >
                <MapIcon name="tune" size={16} color={theme.neutral100} />
              </Pressable>

              <Pressable
                testID="map-roadworks-button"
                accessibilityRole="button"
                accessibilityLabel={t('map.roadworks.toggle')}
                accessibilityState={{ selected: showRoadworks }}
                onPress={handleToggleRoadworks}
                style={({ pressed }) => [
                  styles.tuneButton,
                  showRoadworks ? styles.roadworksButtonActive : { backgroundColor: pillSurface },
                  pressed && styles.pressed,
                ]}
              >
                <MapIcon
                  name="roadwork"
                  size={16}
                  color={showRoadworks ? theme.neutral100 : theme.accent600}
                />
              </Pressable>
            </View>

            {/* Horizontal Scrollable Category Filter Pills */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsScrollContent}
            >
              {/* All Chip */}
              <Pressable
                testID="map-filter-all"
                accessibilityRole="button"
                accessibilityState={{ selected: selectedCategory === 'all' }}
                onPress={() => setSelectedCategory('all')}
                style={[
                  styles.filterChip,
                  selectedCategory === 'all'
                    ? styles.filterChipActive
                    : { backgroundColor: pillSurface },
                ]}
              >
                <Text
                  style={[
                    styles.filterChipLabel,
                    { color: selectedCategory === 'all' ? theme.neutral100 : chipText },
                  ]}
                >
                  {t('map.filterAll')}
                </Text>
                <View
                  style={[
                    styles.chipCountPill,
                    {
                      backgroundColor:
                        selectedCategory === 'all'
                          ? `${theme.neutral100}38`
                          : theme.backgroundElement,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipCountText,
                      {
                        color: selectedCategory === 'all' ? theme.neutral100 : theme.neutral800,
                      },
                    ]}
                  >
                    {categoryCounts.all}
                  </Text>
                </View>
              </Pressable>

              {/* Category Chips */}
              {ISSUE_CATEGORIES.map((category) => {
                const isActive = selectedCategory === category;
                const count = categoryCounts[category];
                return (
                  <Pressable
                    key={category}
                    testID={`map-filter-${category}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isActive }}
                    onPress={() => setSelectedCategory(category)}
                    style={[
                      styles.filterChip,
                      isActive ? styles.filterChipActive : { backgroundColor: pillSurface },
                    ]}
                  >
                    <MapIcon
                      name={getCategoryChipIcon(category)}
                      size={14}
                      color={isActive ? theme.neutral200 : theme.neutral700}
                    />
                    <Text
                      style={[
                        styles.filterChipLabel,
                        { color: isActive ? theme.neutral100 : chipText },
                      ]}
                    >
                      {t(`map.categoryShort.${category}`)}
                    </Text>
                    <View
                      style={[
                        styles.chipCountPill,
                        {
                          backgroundColor: isActive
                            ? `${theme.neutral100}38`
                            : theme.backgroundElement,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipCountText,
                          {
                            color: isActive ? theme.neutral100 : theme.neutral800,
                          },
                        ]}
                      >
                        {count}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Optional Advanced Status Filters Row */}
            {showStatusFilters ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipsScrollContent}
              >
                <Pressable
                  testID="map-status-all"
                  accessibilityRole="button"
                  accessibilityState={{ selected: selectedStatus === 'all' }}
                  onPress={() => setSelectedStatus('all')}
                  style={[
                    styles.statusFilterChip,
                    selectedStatus === 'all'
                      ? styles.statusFilterChipActive
                      : { backgroundColor: pillSurface },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusFilterLabel,
                      { color: selectedStatus === 'all' ? theme.neutral100 : chipText },
                    ]}
                  >
                    {t('map.filterAllStatuses')}
                  </Text>
                </Pressable>
                {ISSUE_STATUSES.map((status) => {
                  const isActive = selectedStatus === status;
                  return (
                    <Pressable
                      key={status}
                      testID={`map-status-${status}`}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isActive }}
                      onPress={() => setSelectedStatus(status)}
                      style={[
                        styles.statusFilterChip,
                        isActive ? styles.statusFilterChipActive : { backgroundColor: pillSurface },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusFilterLabel,
                          { color: isActive ? theme.neutral100 : chipText },
                        ]}
                      >
                        {t(`issue.status.${status}`)}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : null}

            {/* City of Montréal roadworks filters (second filter section) */}
            {showRoadworks ? (
              <RoadworksFilterBar
                types={roadworkTypes}
                typeCounts={roadworksQuery.data?.typeCounts}
                onToggleType={toggleRoadworkType}
                when={roadworkWhen}
                onChangeWhen={setRoadworkWhen}
                cityOnly={roadworkCityOnly}
                onToggleCityOnly={() => setRoadworkCityOnly((prev) => !prev)}
                shownCount={roadworks.length}
                status={
                  roadworksQuery.isError && !roadworksQuery.data
                    ? 'error'
                    : roadworksQuery.isPending && roadworkBoroughs.length > 0
                      ? 'loading'
                      : 'ready'
                }
              />
            ) : null}

            {/* Active Layer Indicator Pill (when not standard) */}
            {layerMode !== 'standard' ? (
              <View style={styles.layerBadgeRow}>
                <View style={styles.layerBadgePill}>
                  <MapIcon name="layers" size={12} color={theme.neutral200} />
                  <Text style={styles.layerBadgeText}>{t(`map.layers.${layerMode}`)}</Text>
                </View>
              </View>
            ) : null}
          </View>

          {/* Floating Right-Side Map Utilities */}
          <View style={[styles.mapUtilitiesCol, { bottom: 248 + tabBarInset }]}>
            <Pressable
              testID="map-recenter-button"
              accessibilityRole="button"
              accessibilityLabel={t('map.recenter')}
              onPress={handleRecenter}
              style={({ pressed }) => [
                styles.utilityCircleBtn,
                { backgroundColor: pillSurface },
                pressed && styles.pressed,
              ]}
            >
              <MapIcon name="myLocation" size={19} color={theme.neutral800} />
            </Pressable>

            <Pressable
              testID="map-layers-button"
              accessibilityRole="button"
              accessibilityLabel={t('map.switchLayer')}
              onPress={handleCycleLayer}
              style={({ pressed }) => [
                styles.utilityCircleBtn,
                {
                  backgroundColor: layerMode === 'standard' ? pillSurface : theme.neutral800,
                },
                pressed && styles.pressed,
              ]}
            >
              <MapIcon
                name="layers"
                size={19}
                color={layerMode === 'standard' ? theme.neutral800 : theme.neutral200}
              />
            </Pressable>

            <View style={[styles.zoomPillGroup, { backgroundColor: pillSurface }]}>
              <Pressable
                testID="map-zoom-in-button"
                accessibilityRole="button"
                accessibilityLabel={t('map.zoomIn')}
                onPress={handleZoomIn}
                style={({ pressed }) => [styles.zoomBtn, pressed && styles.pressed]}
              >
                <MapIcon name="plus" size={18} color={theme.neutral800} />
              </Pressable>
              <View
                style={[
                  styles.zoomDivider,
                  {
                    backgroundColor: `${theme.neutral300}80`,
                  },
                ]}
              />
              <Pressable
                testID="map-zoom-out-button"
                accessibilityRole="button"
                accessibilityLabel={t('map.zoomOut')}
                onPress={handleZoomOut}
                style={({ pressed }) => [styles.zoomBtn, pressed && styles.pressed]}
              >
                <MapIcon name="minus" size={18} color={theme.neutral800} />
              </Pressable>
            </View>
          </View>

          {/* Bottom sheet: a roadwork's card, the selected report's details, or the list of reports */}
          <View style={styles.bottomSheetDock}>
            {selectedRoadwork ? (
              <RoadworkPreviewCard
                work={selectedRoadwork}
                upcoming={roadworkWhen === 'upcoming'}
                onClose={() => setSelectedRoadworkId(null)}
                bottomInset={tabBarInset}
              />
            ) : selectedIssue ? (
              <IncidentPreviewSheet
                issue={selectedIssue}
                districtName={selectedIssueDistrictName}
                isUpvoted={isSelectedUpvoted}
                upvoteCount={selectedUpvoteCount}
                justShared={justShared}
                onToggleUpvote={() => handleToggleUpvote(selectedIssue.id)}
                onShare={() => void handleShareIssue()}
                onOpenDetails={() => setDetailModalVisible(true)}
                onResetFilters={handleResetFilters}
                onBackToList={() => setSelectedIssueId(null)}
                bottomInset={tabBarInset}
              />
            ) : (
              <IssueListSheet
                issues={filteredIssues}
                onSelectIssue={(issue) => setSelectedIssueId(issue.id)}
                districtNameFor={(issue) =>
                  getDistrictName(issue.district_id, districts, currentLang) ?? null
                }
                onResetFilters={handleResetFilters}
                bottomInset={tabBarInset}
              />
            )}
          </View>
        </View>
      </SafeAreaView>

      {/* ─── Full Incident Record Modal ─── */}
      <Modal
        visible={detailModalVisible && selectedIssue !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setDetailModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View
            testID="map-detail-modal"
            style={[styles.detailModalSheet, { backgroundColor: theme.background }]}
          >
            <View style={styles.modalHeader}>
              <ThemedText type="h3">{t('map.viewRecord')}</ThemedText>
              <Pressable
                testID="map-detail-modal-close"
                accessibilityRole="button"
                accessibilityLabel={t('map.closeModal')}
                onPress={() => setDetailModalVisible(false)}
                style={[
                  styles.modalCloseBtn,
                  {
                    backgroundColor: theme.neutral200,
                  },
                ]}
              >
                <MapIcon name="close" size={16} color={theme.neutral800} />
              </Pressable>
            </View>

            {selectedIssue ? (
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.detailScrollContent}
              >
                <IssueCard
                  issue={{
                    ...selectedIssue,
                    upvote_count: selectedUpvoteCount,
                    resolution_confirmations: selectedConfirmCount,
                  }}
                  isUpvoted={isSelectedUpvoted}
                  isConfirmed={isSelectedConfirmed}
                  descriptionNumberOfLines={10}
                  onUpvote={() => handleToggleUpvote(selectedIssue.id)}
                  onConfirmResolution={() => handleToggleConfirm(selectedIssue.id)}
                />
                <View
                  style={[
                    styles.coordsBox,
                    {
                      backgroundColor: theme.neutral100,
                    },
                  ]}
                >
                  <ThemedText type="caption" tone="secondary">
                    {t('map.coordinates')}
                  </ThemedText>
                  <Text style={[styles.coordsText, { color: theme.neutral800 }]}>
                    {selectedIssue.latitude.toFixed(5)}, {selectedIssue.longitude.toFixed(5)}
                    {selectedIssueDistrictName ? ` • ${selectedIssueDistrictName}` : ''}
                  </Text>
                </View>
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>

      {/* ─── Borough Picker (scrolls; closes with ✕ or a tap above it) ─── */}
      <BoroughPickerSheet
        visible={boroughModalVisible}
        title={t('map.boroughFilterTitle')}
        testID="map-borough-picker"
        options={[
          {
            key: 'all',
            label: t('map.allBoroughs'),
            detail: t('map.clusterLabel', { count: issues.length }),
            selected: selectedDistrictId === 'all',
            testID: 'map-borough-option-all',
            hideWhileSearching: true,
          },
          ...districts.map((district) => ({
            key: district.id,
            label: currentLang === 'en' ? district.name_en : district.name_fr,
            detail: t('map.clusterLabel', {
              count: issues.filter((item) => item.district_id === district.id).length,
            }),
            selected: selectedDistrictId === district.id,
            testID: `map-borough-option-${district.open_north_slug}`,
          })),
        ]}
        onSelect={(key) => handleSelectDistrict(key)}
        onClose={() => setBoroughModalVisible(false)}
      />

      {/* ─── Profile (same sheet as the avatar in every other tab's header) ─── */}
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    screenRoot: {
      flex: 1,
      alignItems: 'center',
    },
    safeArea: {
      flex: 1,
      width: '100%',
      maxWidth: MaxContentWidth,
      paddingBottom: BottomTabInset,
    },

    // ── Header Bar ──
    headerBar: {
      height: 60,
      paddingHorizontal: Spacing.three,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      borderBottomWidth: 1,
      zIndex: 1020,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flex: 1,
      minWidth: 0,
    },
    brandIconBox: {
      width: 36,
      height: 36,
      borderRadius: 11,
      backgroundColor: theme.neutral800,
      alignItems: 'center',
      justifyContent: 'center',
    },
    brandTextCol: {
      flex: 1,
      minWidth: 0,
    },
    brandTitle: {
      fontSize: 16.5,
      fontWeight: '700',
      letterSpacing: -0.3,
    },
    boroughTrigger: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      marginTop: 1,
    },
    boroughDot: {
      width: 7,
      height: 7,
      borderRadius: 3.5,
      backgroundColor: theme.neutral400,
    },
    boroughLabel: {
      fontSize: 12,
      fontWeight: '500',
      flexShrink: 1,
    },
    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    profileAvatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    profileInitials: {
      fontSize: 12,
      fontWeight: '700',
    },

    // ── Map Stage ──
    mapStage: {
      flex: 1,
      position: 'relative',
      overflow: 'hidden',
    },

    // ── Floating Top Controls ──
    topControlsOverlay: {
      position: 'absolute',
      top: 12,
      left: 0,
      right: 0,
      gap: 8,
      zIndex: 1005,
    },
    // Search, filters and roadworks must share one row even on narrow phones (iPhone SE / mini):
    // the buttons keep their size and the search field takes whatever width is left.
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: Spacing.three,
    },
    searchBar: {
      flex: 1,
      minWidth: 0,
      height: 40,
      borderRadius: 999,
      paddingHorizontal: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      shadowColor: theme.text,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 4,
    },
    searchInput: {
      flex: 1,
      minWidth: 0,
      fontSize: 13.5,
      paddingVertical: 0,
    },
    clearBtn: {
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tuneButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      flexShrink: 0,
      backgroundColor: theme.neutral800,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: theme.text,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.16,
      shadowRadius: 8,
      elevation: 5,
    },
    tuneButtonActive: {
      backgroundColor: theme.neutral800,
    },
    roadworksButtonActive: {
      backgroundColor: theme.accent600,
    },
    chipsScrollContent: {
      paddingHorizontal: Spacing.three,
      gap: 8,
    },
    filterChip: {
      height: 32,
      paddingHorizontal: 12,
      borderRadius: 999,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      shadowColor: theme.text,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
      elevation: 3,
    },
    filterChipActive: {
      backgroundColor: theme.neutral800,
    },
    filterChipLabel: {
      fontSize: 12,
      fontWeight: '600',
    },
    chipCountPill: {
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: 999,
    },
    chipCountText: {
      fontSize: 10.5,
      fontWeight: '600',
      fontFamily: Fonts.mono,
    },
    statusFilterChip: {
      height: 28,
      paddingHorizontal: 11,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
    },
    statusFilterChipActive: {
      backgroundColor: theme.neutral700,
    },
    statusFilterLabel: {
      fontSize: 11.5,
      fontWeight: '600',
    },
    layerBadgeRow: {
      paddingHorizontal: Spacing.three,
      alignItems: 'flex-start',
    },
    layerBadgePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: `${theme.neutral800}E6`,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
    },
    layerBadgeText: {
      color: theme.neutral200,
      fontSize: 11,
      fontWeight: '600',
    },

    // ── Right-Side Map Utilities ──
    mapUtilitiesCol: {
      position: 'absolute',
      right: Spacing.three,
      bottom: 248,
      gap: 8,
      zIndex: 1005,
    },
    utilityCircleBtn: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: theme.text,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.14,
      shadowRadius: 6,
      elevation: 4,
    },
    zoomPillGroup: {
      borderRadius: 999,
      overflow: 'hidden',
      shadowColor: theme.text,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.14,
      shadowRadius: 6,
      elevation: 4,
    },
    zoomBtn: {
      width: 42,
      height: 38,
      alignItems: 'center',
      justifyContent: 'center',
    },
    zoomDivider: {
      width: 24,
      height: 1,
      alignSelf: 'center',
    },

    // ── Bottom Sheet Dock ──
    bottomSheetDock: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 1010,
    },

    // ── Modals ──
    modalBackdrop: {
      flex: 1,
      backgroundColor: `${theme.text}7A`,
      justifyContent: 'flex-end',
    },
    detailModalSheet: {
      maxHeight: '86%',
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: Spacing.three,
      gap: Spacing.three,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    modalCloseBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
    },
    detailScrollContent: {
      gap: Spacing.three,
      paddingBottom: Spacing.four,
    },
    coordsBox: {
      padding: Spacing.three,
      borderRadius: 14,
      gap: 4,
    },
    coordsText: {
      fontSize: 12.5,
      fontFamily: Fonts.mono,
      fontWeight: '600',
    },
    pressed: {
      opacity: 0.85,
      transform: [{ scale: 0.96 }],
    },
  });

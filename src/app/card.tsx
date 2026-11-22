import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';

import dummyDistricts from '../../dummy_data/districts.json';
import dummyIssues from '../../dummy_data/issues.json';

import { IssueCard } from '@/components/layout/IssueCard';
import { IncidentPreviewSheet } from '@/components/map/IncidentPreviewSheet';
import { MapIcon, type MapIconName } from '@/components/map/MapIcon';
import { MontrealMapCanvas, type MontrealMapHandle } from '@/components/map/MontrealMapCanvas';
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
  normalizeDistrict,
  normalizeIssue,
  type StatusFilter,
} from '@/components/utils/map-utils';
import { ProfileSheet } from '@/components/utils/profile-sheet';
import { ThemedText } from '@/components/utils/themed-text';
import { computeInitials } from '@/components/utils/formatter';
import { BottomTabInset, Fonts, MaxContentWidth, Spacing } from '@/constants/theme';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useTheme } from '@/hooks/use-theme';
import { isSupportedLanguage } from '@/i18n';
import { apiClient } from '@/lib/api/client';
import { ISSUE_CATEGORIES, ISSUE_STATUSES, type Issue, type IssueCategory } from '@/models/Issue';

const FALLBACK_ISSUES = dummyIssues.issues as Issue[];
const FALLBACK_DISTRICTS = dummyDistricts.districts as District[];

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
  const user = useCurrentUser();
  const isDark = theme.text !== '#1C211F';
  const currentLang = isSupportedLanguage(i18n.language) ? i18n.language : 'fr';

  const mapRef = useRef<MontrealMapHandle>(null);

  // Fetch issues from API when configured; normalize camelCase/snake_case and fall back to dummy_data.
  const { data: issues = FALLBACK_ISSUES } = useQuery<Issue[]>({
    queryKey: ['map-issues'],
    queryFn: async () => {
      if (!process.env.EXPO_PUBLIC_API_URL) return FALLBACK_ISSUES;
      try {
        const res = await apiClient.get<Record<string, unknown>[]>('/api/issues');
        return Array.isArray(res.data) && res.data.length > 0
          ? res.data.map(normalizeIssue)
          : FALLBACK_ISSUES;
      } catch {
        return FALLBACK_ISSUES;
      }
    },
    initialData: FALLBACK_ISSUES,
  });

  const { data: districts = FALLBACK_DISTRICTS } = useQuery<District[]>({
    queryKey: ['map-districts'],
    queryFn: async () => {
      if (!process.env.EXPO_PUBLIC_API_URL) return FALLBACK_DISTRICTS;
      try {
        const res = await apiClient.get<Record<string, unknown>[]>('/api/districts');
        return Array.isArray(res.data) && res.data.length > 0
          ? res.data.map(normalizeDistrict)
          : FALLBACK_DISTRICTS;
      } catch {
        return FALLBACK_DISTRICTS;
      }
    },
    initialData: FALLBACK_DISTRICTS,
  });

  // Search & filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('all');
  const [selectedStatus, setSelectedStatus] = useState<StatusFilter>('all');
  const [selectedDistrictId, setSelectedDistrictId] = useState<string | 'all'>('all');
  const [showStatusFilters, setShowStatusFilters] = useState(false);

  // Map layer state
  const [layerMode, setLayerMode] = useState<MapLayerMode>('standard');

  // Selection, modal, and local interaction state
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(
    FALLBACK_ISSUES[0]?.id ?? null,
  );
  const [upvotedIds, setUpvotedIds] = useState<Record<string, boolean>>({});
  const [confirmedIds, setConfirmedIds] = useState<Record<string, boolean>>({});
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [boroughModalVisible, setBoroughModalVisible] = useState(false);
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [justShared, setJustShared] = useState(false);
  const shareTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevFocusedIssueIdRef = useRef<string | null>(FALLBACK_ISSUES[0]?.id ?? null);

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

  // Keep selected issue in sync with filtered results
  const selectedIssue = useMemo(() => {
    if (filteredIssues.length === 0) return null;
    return filteredIssues.find((item) => item.id === selectedIssueId) ?? filteredIssues[0];
  }, [filteredIssues, selectedIssueId]);

  // Smoothly focus the map whenever filtering/searching switches the active issue
  useEffect(() => {
    if (!selectedIssue) return;
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

  const isSelectedUpvoted = selectedIssue ? Boolean(upvotedIds[selectedIssue.id]) : false;
  const selectedUpvoteCount = selectedIssue
    ? selectedIssue.upvote_count + (isSelectedUpvoted ? 1 : 0)
    : 0;
  const isSelectedConfirmed = selectedIssue ? Boolean(confirmedIds[selectedIssue.id]) : false;
  const selectedConfirmCount = selectedIssue
    ? selectedIssue.resolution_confirmations + (isSelectedConfirmed ? 1 : 0)
    : 0;

  const userInitials = computeInitials(user?.username ?? user?.email ?? 'Citoyen');

  const handleToggleUpvote = (issueId: string) => {
    setUpvotedIds((prev) => ({ ...prev, [issueId]: !prev[issueId] }));
  };

  const handleToggleConfirm = (issueId: string) => {
    setConfirmedIds((prev) => ({ ...prev, [issueId]: !prev[issueId] }));
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
  const handleCycleLayer = () => setLayerMode((mode) => nextLayerMode(mode));

  const headerBg = isDark ? '#1A231F' : '#EEF7F1';
  const headerBorder = isDark ? 'rgba(158, 206, 176, 0.14)' : 'rgba(42, 52, 47, 0.1)';
  const pillSurface = isDark ? 'rgba(33, 42, 37, 0.94)' : 'rgba(255, 255, 255, 0.94)';
  const chipText = isDark ? '#D7E6DB' : '#39473F';

  return (
    <View style={[styles.screenRoot, { backgroundColor: headerBg }]}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        {/* ─── Top Header Bar ─── */}
        <View
          style={[styles.headerBar, { backgroundColor: headerBg, borderBottomColor: headerBorder }]}
        >
          <View style={styles.headerLeft}>
            <View style={styles.brandIconBox}>
              <MapIcon name="city" size={18} color="#FFFFFF" />
            </View>
            <View style={styles.brandTextCol}>
              <Text style={[styles.brandTitle, { color: isDark ? '#ECF4EF' : '#39473F' }]}>
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
                <Text
                  numberOfLines={1}
                  style={[styles.boroughLabel, { color: isDark ? '#9ECEB0' : '#434844' }]}
                >
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
              onPress={() => setProfileModalVisible(true)}
              style={[
                styles.profileAvatar,
                {
                  backgroundColor: isDark ? '#2D3E35' : '#D7E6DB',
                  borderColor: isDark ? '#495C51' : '#C3C8C3',
                },
              ]}
            >
              <Text style={[styles.profileInitials, { color: isDark ? '#C6EBD3' : '#39473F' }]}>
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
            onSelectIssue={(issue) => setSelectedIssueId(issue.id)}
            layerMode={layerMode}
          />

          {/* Floating Top Controls: Search + Category Filter Pills */}
          <View pointerEvents="box-none" style={styles.topControlsOverlay}>
            <View style={styles.searchRow}>
              <View style={[styles.searchBar, { backgroundColor: pillSurface }]}>
                <MapIcon name="search" size={18} color={isDark ? '#C6EBD3' : '#39473F'} />
                <TextInput
                  testID="map-search-input"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder={t('map.searchPlaceholder')}
                  placeholderTextColor={isDark ? '#8CA497' : '#6A736E'}
                  style={[styles.searchInput, { color: isDark ? '#ECF4EF' : '#181D1B' }]}
                  returnKeyType="search"
                />
                {searchQuery.length > 0 ? (
                  <Pressable
                    testID="map-search-clear"
                    accessibilityRole="button"
                    accessibilityLabel={t('map.clearSearch')}
                    onPress={() => setSearchQuery('')}
                    style={[styles.clearBtn, { backgroundColor: isDark ? '#2F3D35' : '#EAEFEB' }]}
                  >
                    <MapIcon name="close" size={13} color={isDark ? '#C6EBD3' : '#434844'} />
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
                <MapIcon name="tune" size={18} color="#FFFFFF" />
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
                    { color: selectedCategory === 'all' ? '#FFFFFF' : chipText },
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
                          ? 'rgba(255,255,255,0.22)'
                          : isDark
                            ? '#2D3A33'
                            : '#EAEFEB',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipCountText,
                      {
                        color:
                          selectedCategory === 'all' ? '#FFFFFF' : isDark ? '#A6E3B9' : '#434844',
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
                      color={isActive ? '#C6EBD3' : isDark ? '#9ECEB0' : '#446552'}
                    />
                    <Text
                      style={[styles.filterChipLabel, { color: isActive ? '#FFFFFF' : chipText }]}
                    >
                      {t(`map.categoryShort.${category}`)}
                    </Text>
                    <View
                      style={[
                        styles.chipCountPill,
                        {
                          backgroundColor: isActive
                            ? 'rgba(255,255,255,0.22)'
                            : isDark
                              ? '#2D3A33'
                              : '#EAEFEB',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipCountText,
                          { color: isActive ? '#FFFFFF' : isDark ? '#A6E3B9' : '#434844' },
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
                      { color: selectedStatus === 'all' ? '#FFFFFF' : chipText },
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
                          { color: isActive ? '#FFFFFF' : chipText },
                        ]}
                      >
                        {t(`issue.status.${status}`)}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : null}

            {/* Active Layer Indicator Pill (when not standard) */}
            {layerMode !== 'standard' ? (
              <View style={styles.layerBadgeRow}>
                <View style={styles.layerBadgePill}>
                  <MapIcon name="layers" size={12} color="#C6EBD3" />
                  <Text style={styles.layerBadgeText}>{t(`map.layers.${layerMode}`)}</Text>
                </View>
              </View>
            ) : null}
          </View>

          {/* Floating Right-Side Map Utilities */}
          <View style={styles.mapUtilitiesCol}>
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
              <MapIcon name="myLocation" size={19} color={isDark ? '#C6EBD3' : '#39473F'} />
            </Pressable>

            <Pressable
              testID="map-layers-button"
              accessibilityRole="button"
              accessibilityLabel={t('map.switchLayer')}
              onPress={handleCycleLayer}
              style={({ pressed }) => [
                styles.utilityCircleBtn,
                {
                  backgroundColor: layerMode === 'standard' ? pillSurface : '#39473F',
                },
                pressed && styles.pressed,
              ]}
            >
              <MapIcon
                name="layers"
                size={19}
                color={layerMode === 'standard' ? (isDark ? '#A6E3B9' : '#434844') : '#C6EBD3'}
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
                <MapIcon name="plus" size={18} color={isDark ? '#C6EBD3' : '#434844'} />
              </Pressable>
              <View
                style={[
                  styles.zoomDivider,
                  { backgroundColor: isDark ? 'rgba(158,206,176,0.2)' : 'rgba(195,200,195,0.5)' },
                ]}
              />
              <Pressable
                testID="map-zoom-out-button"
                accessibilityRole="button"
                accessibilityLabel={t('map.zoomOut')}
                onPress={handleZoomOut}
                style={({ pressed }) => [styles.zoomBtn, pressed && styles.pressed]}
              >
                <MapIcon name="minus" size={18} color={isDark ? '#C6EBD3' : '#434844'} />
              </Pressable>
            </View>
          </View>

          {/* Bottom Sheet Incident Preview Card */}
          <View style={styles.bottomSheetDock}>
            <IncidentPreviewSheet
              issue={selectedIssue}
              districtName={selectedIssueDistrictName}
              isUpvoted={isSelectedUpvoted}
              upvoteCount={selectedUpvoteCount}
              justShared={justShared}
              onToggleUpvote={() => selectedIssue && handleToggleUpvote(selectedIssue.id)}
              onShare={() => void handleShareIssue()}
              onOpenDetails={() => setDetailModalVisible(true)}
              onResetFilters={handleResetFilters}
            />
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
            style={[styles.detailModalSheet, { backgroundColor: isDark ? '#1A231F' : '#EEF7F1' }]}
          >
            <View style={styles.modalHeader}>
              <ThemedText type="h3">{t('map.viewRecord')}</ThemedText>
              <Pressable
                testID="map-detail-modal-close"
                accessibilityRole="button"
                accessibilityLabel={t('map.closeModal')}
                onPress={() => setDetailModalVisible(false)}
                style={[styles.modalCloseBtn, { backgroundColor: isDark ? '#2A362F' : '#DFE8E2' }]}
              >
                <MapIcon name="close" size={16} color={isDark ? '#ECF4EF' : '#39473F'} />
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
                  style={[styles.coordsBox, { backgroundColor: isDark ? '#232D28' : '#FFFFFF' }]}
                >
                  <ThemedText type="caption" tone="secondary">
                    {t('map.coordinates')}
                  </ThemedText>
                  <Text style={[styles.coordsText, { color: isDark ? '#C6EBD3' : '#39473F' }]}>
                    {selectedIssue.latitude.toFixed(5)}, {selectedIssue.longitude.toFixed(5)}
                    {selectedIssueDistrictName ? ` • ${selectedIssueDistrictName}` : ''}
                  </Text>
                </View>
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>

      {/* ─── Borough Picker Modal ─── */}
      <Modal
        visible={boroughModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setBoroughModalVisible(false)}
      >
        <Pressable
          style={styles.modalBackdropCentered}
          onPress={() => setBoroughModalVisible(false)}
        >
          <Pressable
            onPress={(event) => event.stopPropagation()}
            style={[styles.pickerCard, { backgroundColor: isDark ? '#212A25' : '#FFFFFF' }]}
          >
            <ThemedText type="h3" style={styles.pickerTitle}>
              {t('map.boroughFilterTitle')}
            </ThemedText>

            <Pressable
              testID="map-borough-option-all"
              accessibilityRole="button"
              onPress={() => handleSelectDistrict('all')}
              style={[
                styles.boroughOption,
                selectedDistrictId === 'all' && {
                  backgroundColor: isDark ? '#2D4337' : '#E3EFE7',
                },
              ]}
            >
              <Text style={[styles.boroughOptionText, { color: isDark ? '#ECF4EF' : '#181D1B' }]}>
                {t('map.allBoroughs')}
              </Text>
              <Text style={[styles.boroughOptionCount, { color: isDark ? '#A6E3B9' : '#446552' }]}>
                {issues.length}
              </Text>
            </Pressable>

            {districts.map((district) => {
              const count = issues.filter((item) => item.district_id === district.id).length;
              const isSelected = selectedDistrictId === district.id;
              return (
                <Pressable
                  key={district.id}
                  testID={`map-borough-option-${district.open_north_slug}`}
                  accessibilityRole="button"
                  onPress={() => handleSelectDistrict(district.id)}
                  style={[
                    styles.boroughOption,
                    isSelected && {
                      backgroundColor: isDark ? '#2D4337' : '#E3EFE7',
                    },
                  ]}
                >
                  <Text
                    style={[styles.boroughOptionText, { color: isDark ? '#ECF4EF' : '#181D1B' }]}
                  >
                    {currentLang === 'en' ? district.name_en : district.name_fr}
                  </Text>
                  <Text
                    style={[styles.boroughOptionCount, { color: isDark ? '#A6E3B9' : '#446552' }]}
                  >
                    {count}
                  </Text>
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ─── Profile (same sheet as the avatar in every other tab's header) ─── */}
      <ProfileSheet visible={profileModalVisible} onClose={() => setProfileModalVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
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
    backgroundColor: '#39473F',
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
    backgroundColor: '#ABCFB7',
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
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: Spacing.three,
  },
  searchBar: {
    flex: 1,
    height: 46,
    borderRadius: 999,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#1C211F',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
  clearBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tuneButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#39473F',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1C211F',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 5,
  },
  tuneButtonActive: {
    backgroundColor: '#14532D',
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
    shadowColor: '#1C211F',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  filterChipActive: {
    backgroundColor: '#39473F',
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
    backgroundColor: '#446552',
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
    backgroundColor: 'rgba(57, 71, 63, 0.9)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  layerBadgeText: {
    color: '#C6EBD3',
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
    shadowColor: '#1C211F',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.14,
    shadowRadius: 6,
    elevation: 4,
  },
  zoomPillGroup: {
    borderRadius: 999,
    overflow: 'hidden',
    shadowColor: '#1C211F',
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
    backgroundColor: 'rgba(24, 29, 27, 0.48)',
    justifyContent: 'flex-end',
  },
  modalBackdropCentered: {
    flex: 1,
    backgroundColor: 'rgba(24, 29, 27, 0.48)',
    justifyContent: 'center',
    padding: Spacing.four,
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
  pickerCard: {
    borderRadius: 20,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  pickerTitle: {
    marginBottom: 4,
  },
  boroughOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
  },
  boroughOptionText: {
    fontSize: 14.5,
    fontWeight: '600',
  },
  boroughOptionCount: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: Fonts.mono,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.96 }],
  },
});

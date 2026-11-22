import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';

import { CATEGORY_ICONS, MapIcon } from '@/components/map/MapIcon';
import { MapUnavailable, nativeMapsAvailable } from '@/components/map/map-availability';
import { useIssueStatusColors } from '@/components/utils/issue-status';
import { type LatLng, regionForPoints, reserveBottom } from '@/components/utils/map-utils';
import { useTheme } from '@/hooks/use-theme';
import type { Issue } from '@/models/Issue';

/**
 * Share of the map's height covered by the report screen's overlays (coordinates badge and
 * "Adjust pin" button): about 65 of 195 points. Markers are framed above it.
 */
export const OVERLAY_FRACTION = 0.35;

export type ReportLocationMapProps = {
  /** Where the new issue will be reported (the device's location). */
  point: LatLng;
  /** Other issues in the same district: a category icon on a dot colored by status. */
  issues: readonly Issue[];
  /**
   * Pin mode: a fixed pin sits in the middle of the map, and the user pans and zooms the map under
   * it to any spot (it doesn't have to be near them); a tap moves the map to the tapped spot. The
   * point under the pin is reported through `onPickPoint` each time the map settles.
   */
  pinMode?: boolean;
  onPickPoint?: (point: LatLng) => void;
};

/** Map centers closer than this (in degrees, about 2 m) are the same point. */
const SAME_POINT = 0.00002;

/** Real map for the report form: the report point plus the district's existing issues. */
export function ReportLocationMap({
  point,
  issues,
  pinMode = false,
  onPickPoint,
}: ReportLocationMapProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const statusColors = useIssueStatusColors();
  const mapRef = useRef<MapView>(null);
  const region = useMemo(
    () => reserveBottom(regionForPoints([point, ...issues]), OVERLAY_FRACTION),
    [point, issues],
  );

  // The map's current zoom, kept so pin mode can center on the point without zooming.
  const shownRegionRef = useRef<Region>(region);
  // The latest point, read when pin mode starts (without re-running that effect on every pick).
  const pointRef = useRef(point);
  useEffect(() => {
    pointRef.current = point;
  }, [point]);

  // Outside pin mode, re-frame when the location or the district's issues change.
  useEffect(() => {
    if (!pinMode) mapRef.current?.animateToRegion(region, 300);
  }, [region, pinMode]);

  // Entering pin mode, center the map on the report point, where the fixed pin is (same zoom).
  // From then on the map moves only when the user moves it.
  useEffect(() => {
    if (!pinMode) return;
    const { latitudeDelta, longitudeDelta } = shownRegionRef.current;
    mapRef.current?.animateToRegion({ ...pointRef.current, latitudeDelta, longitudeDelta }, 300);
  }, [pinMode]);

  const pickCenter = (center: Region) => {
    shownRegionRef.current = center;
    if (!pinMode) return;
    const current = pointRef.current;
    if (
      Math.abs(center.latitude - current.latitude) < SAME_POINT &&
      Math.abs(center.longitude - current.longitude) < SAME_POINT
    )
      return;
    onPickPoint?.({ latitude: center.latitude, longitude: center.longitude });
  };

  // Android without a Google Maps key: a note instead of a map that would crash the app.
  if (!nativeMapsAvailable) return <MapUnavailable testID="report-location-map" />;

  return (
    <View style={StyleSheet.absoluteFill}>
      <MapView
        ref={mapRef}
        testID="report-location-map"
        style={StyleSheet.absoluteFill}
        initialRegion={region}
        showsPointsOfInterests={false}
        toolbarEnabled={false}
        onRegionChangeComplete={pickCenter}
        onPress={
          pinMode
            ? (event) => {
                // A tap on an issue marker is not a new pin position.
                if (event.nativeEvent.action === 'marker-press') return;
                // The tapped spot becomes the point, and the map slides it under the fixed pin.
                const { coordinate } = event.nativeEvent;
                const { latitudeDelta, longitudeDelta } = shownRegionRef.current;
                pointRef.current = coordinate;
                mapRef.current?.animateToRegion(
                  { ...coordinate, latitudeDelta, longitudeDelta },
                  250,
                );
                onPickPoint?.(coordinate);
              }
            : undefined
        }
      >
        {issues.map((issue) => {
          const status = t(`issue.status.${issue.status}`);
          const category = t(`issue.category.${issue.category}`);
          return (
            <Marker
              key={issue.id}
              testID={`report-map-issue-${issue.id}`}
              coordinate={{ latitude: issue.latitude, longitude: issue.longitude }}
              title={issue.title}
              description={`${category} • ${status}`}
              tracksViewChanges={false}
            >
              <View
                accessibilityLabel={t('reportMap.issueMarker', {
                  title: issue.title,
                  category,
                  status,
                })}
                style={[
                  styles.issueDot,
                  { backgroundColor: statusColors[issue.status], borderColor: theme.background },
                ]}
              >
                <MapIcon name={CATEGORY_ICONS[issue.category]} size={13} color={theme.background} />
              </View>
            </Marker>
          );
        })}

        {/* In pin mode the fixed pin over the map's center replaces this marker. */}
        {pinMode ? null : (
          <Marker
            testID="report-map-point"
            coordinate={{ latitude: point.latitude, longitude: point.longitude }}
            title={t('reportMap.reportPoint')}
            zIndex={50}
            tracksViewChanges={false}
          >
            <View
              accessibilityLabel={t('reportMap.reportPoint')}
              style={[styles.pointRing, { backgroundColor: theme.backgroundSelected }]}
            >
              <View
                style={[
                  styles.pointCore,
                  { backgroundColor: theme.accent, borderColor: theme.background },
                ]}
              />
            </View>
          </Marker>
        )}
      </MapView>

      {pinMode ? (
        <View testID="report-map-center-pin" pointerEvents="none" style={styles.centerPin}>
          <View
            accessibilityLabel={t('reportMap.reportPoint')}
            style={[
              styles.pointRing,
              styles.centerPinRing,
              { backgroundColor: theme.backgroundSelected, shadowColor: theme.shadow },
            ]}
          >
            <View
              style={[
                styles.pointCore,
                { backgroundColor: theme.accent, borderColor: theme.background },
              ]}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // Centers the fixed pin over the map; touches pass through to the map.
  centerPin: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  centerPinRing: {
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  issueDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The report point: larger, accent-colored and ringed, so it stands apart from the issue dots.
  // Colors come from the theme at render time.
  pointRing: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pointCore: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 3,
  },
});

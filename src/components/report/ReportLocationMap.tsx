import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

import { CATEGORY_ICONS, MapIcon } from '@/components/map/MapIcon';
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
   * Pin mode: tapping the map, or dragging the report marker, picks a new report point. The map
   * also stops re-framing itself, so it stays put while the user places the pin.
   */
  pinMode?: boolean;
  onPickPoint?: (point: LatLng) => void;
};

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

  // Re-frame when the detected location or the district's issues change, except while the user is
  // placing the pin (the map would jump under their finger).
  useEffect(() => {
    if (pinMode) return;
    mapRef.current?.animateToRegion(region, 300);
  }, [region, pinMode]);

  return (
    <MapView
      ref={mapRef}
      testID="report-location-map"
      style={StyleSheet.absoluteFill}
      initialRegion={region}
      showsPointsOfInterests={false}
      toolbarEnabled={false}
      onPress={
        pinMode
          ? (event) => {
              // A tap on an issue marker is not a new pin position.
              if (event.nativeEvent.action === 'marker-press') return;
              onPickPoint?.(event.nativeEvent.coordinate);
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

      <Marker
        testID="report-map-point"
        coordinate={{ latitude: point.latitude, longitude: point.longitude }}
        title={t('reportMap.reportPoint')}
        zIndex={50}
        tracksViewChanges={false}
        draggable={pinMode}
        onDragEnd={(event) => onPickPoint?.(event.nativeEvent.coordinate)}
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
    </MapView>
  );
}

const styles = StyleSheet.create({
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

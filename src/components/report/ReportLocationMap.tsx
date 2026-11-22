import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

import { ISSUE_STATUS_COLORS } from '@/components/utils/issue-status';
import { type LatLng, regionForPoints, reserveBottom } from '@/components/utils/map-utils';
import type { Issue } from '@/models/Issue';

/**
 * Share of the map's height covered by the report screen's overlays (coordinates badge and
 * "Adjust pin" button): about 65 of 195 points. Markers are framed above it.
 */
export const OVERLAY_FRACTION = 0.35;

export type ReportLocationMapProps = {
  /** Where the new issue will be reported (the device's location). */
  point: LatLng;
  /** Other issues in the same district, drawn as dots colored by status. */
  issues: readonly Issue[];
};

/** Real map for the report form: the report point plus the district's existing issues. */
export function ReportLocationMap({ point, issues }: ReportLocationMapProps) {
  const { t } = useTranslation();
  const mapRef = useRef<MapView>(null);
  const region = useMemo(
    () => reserveBottom(regionForPoints([point, ...issues]), OVERLAY_FRACTION),
    [point, issues],
  );

  // Re-frame when the detected location or the district's issues change.
  useEffect(() => {
    mapRef.current?.animateToRegion(region, 300);
  }, [region]);

  return (
    <MapView
      ref={mapRef}
      testID="report-location-map"
      style={StyleSheet.absoluteFill}
      initialRegion={region}
      showsPointsOfInterests={false}
      toolbarEnabled={false}
    >
      {issues.map((issue) => {
        const status = t(`issue.status.${issue.status}`);
        return (
          <Marker
            key={issue.id}
            testID={`report-map-issue-${issue.id}`}
            coordinate={{ latitude: issue.latitude, longitude: issue.longitude }}
            title={issue.title}
            description={status}
            tracksViewChanges={false}
          >
            <View
              accessibilityLabel={t('reportMap.issueMarker', { title: issue.title, status })}
              style={[styles.issueDot, { backgroundColor: ISSUE_STATUS_COLORS[issue.status] }]}
            />
          </Marker>
        );
      })}

      <Marker
        testID="report-map-point"
        coordinate={{ latitude: point.latitude, longitude: point.longitude }}
        title={t('reportMap.reportPoint')}
        zIndex={50}
        tracksViewChanges={false}
      >
        <View accessibilityLabel={t('reportMap.reportPoint')} style={styles.pointRing}>
          <View style={styles.pointCore} />
        </View>
      </Marker>
    </MapView>
  );
}

const styles = StyleSheet.create({
  issueDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  // The report point: larger, dark and ringed, so it stands apart from the status dots.
  pointRing: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(57, 71, 63, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pointCore: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#39473F',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
});

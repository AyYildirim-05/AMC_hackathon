import { forwardRef, useImperativeHandle, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline, type Region } from 'react-native-maps';

import { useTheme } from '@/hooks/use-theme';
import type { Roadwork } from '@/lib/api/roadworks';
import type { Issue, IssueCategory } from '@/models/Issue';

import { MapIcon, type MapIconName } from './MapIcon';
import { ROADWORK_STYLE } from './roadwork-style';
import {
  type MapLayerMode,
  type MapRegion,
  METRO_MONT_ROYAL_COORDS,
  MONTREAL_DEFAULT_REGION,
  REV_CORRIDORS,
  shortStreetLabel,
  zoomRegion,
} from '../utils/map-utils';

export interface MontrealMapHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  recenter: () => void;
  focusRegion: (region: MapRegion) => void;
}

export interface MontrealMapCanvasProps {
  issues: readonly Issue[];
  selectedIssueId: string | null;
  onSelectIssue: (issue: Issue) => void;
  layerMode: MapLayerMode;
  /** City of Montréal roadworks to show next to the citizen reports. */
  roadworks?: readonly Roadwork[];
  selectedRoadworkId?: string | null;
  onSelectRoadwork?: (work: Roadwork) => void;
}

function getCategoryIcon(category: IssueCategory): MapIconName {
  switch (category) {
    case 'traffic_safety':
      return 'bike';
    case 'streetlights_utilities':
      return 'lightbulb';
    case 'roads_potholes':
    default:
      return 'pothole';
  }
}

function getCategoryPinAccent(category: IssueCategory, isDark: boolean) {
  switch (category) {
    case 'roads_potholes':
      return {
        iconColor: isDark ? '#FFB4A9' : '#BA1A1A',
        ringColor: isDark ? 'rgba(255, 180, 169, 0.5)' : 'rgba(186, 26, 26, 0.35)',
      };
    case 'streetlights_utilities':
      return {
        iconColor: isDark ? '#A6E3B9' : '#446552',
        ringColor: isDark ? 'rgba(166, 227, 185, 0.5)' : 'rgba(68, 101, 82, 0.35)',
      };
    case 'traffic_safety':
    default:
      return {
        iconColor: isDark ? '#C6EBD3' : '#39473F',
        ringColor: isDark ? 'rgba(198, 235, 211, 0.5)' : 'rgba(57, 71, 63, 0.32)',
      };
  }
}

/**
 * Native interactive Montreal map powered by `react-native-maps` (Apple Maps on iOS,
 * Google Maps on Android), with real street tiles, REV bike corridor polylines,
 * user geolocation, and custom interactive issue markers.
 */
export const MontrealMapCanvas = forwardRef<MontrealMapHandle, MontrealMapCanvasProps>(
  function MontrealMapCanvas(
    {
      issues,
      selectedIssueId,
      onSelectIssue,
      layerMode,
      roadworks = [],
      selectedRoadworkId = null,
      onSelectRoadwork,
    },
    ref,
  ) {
    const { t } = useTranslation();
    const theme = useTheme();
    const isDark = theme.text !== '#1C211F';

    const mapRef = useRef<MapView>(null);
    const regionRef = useRef<MapRegion>(MONTREAL_DEFAULT_REGION);

    const animateTo = (nextRegion: MapRegion) => {
      regionRef.current = nextRegion;
      mapRef.current?.animateToRegion(nextRegion, 320);
    };

    useImperativeHandle(ref, () => ({
      zoomIn: () => animateTo(zoomRegion(regionRef.current, 0.55)),
      zoomOut: () => animateTo(zoomRegion(regionRef.current, 1.8)),
      recenter: () =>
        animateTo({
          latitude: METRO_MONT_ROYAL_COORDS.latitude,
          longitude: METRO_MONT_ROYAL_COORDS.longitude,
          latitudeDelta: 0.028,
          longitudeDelta: 0.028,
        }),
      focusRegion: (region: MapRegion) => animateTo(region),
    }));

    const mapType =
      layerMode === 'contrast'
        ? Platform.OS === 'ios'
          ? 'hybridFlyover'
          : 'hybrid'
        : layerMode === 'works' && Platform.OS === 'ios'
          ? 'mutedStandard'
          : 'standard';

    const revStrokeColor =
      layerMode === 'works'
        ? '#15803D'
        : layerMode === 'contrast' || isDark
          ? '#6EE7B7'
          : '#446552';

    const handleRegionChangeComplete = (next: Region) => {
      regionRef.current = next;
    };

    return (
      <View testID="montreal-map-canvas" style={styles.container}>
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          initialRegion={MONTREAL_DEFAULT_REGION}
          mapType={mapType}
          userInterfaceStyle={layerMode === 'contrast' || isDark ? 'dark' : 'light'}
          showsUserLocation
          showsMyLocationButton={false}
          showsCompass={false}
          showsScale={false}
          showsPointsOfInterests
          onRegionChangeComplete={handleRegionChangeComplete}
        >
          {/* Real GPS REV (Réseau Express Vélo) Bike Corridors */}
          {REV_CORRIDORS.map((corridor) => (
            <Polyline
              key={corridor.id}
              coordinates={[...corridor.coordinates]}
              strokeColor={revStrokeColor}
              strokeWidth={layerMode === 'works' ? 5 : 3.5}
              lineDashPattern={[10, 6]}
            />
          ))}

          {/* City of Montréal roadworks (open data): small squares, so they read apart from reports */}
          {roadworks.map((work) => {
            const isSelected = work.id === selectedRoadworkId;
            const style = ROADWORK_STYLE[work.type];
            return (
              <Marker
                key={`${work.id}-${isSelected ? 'selected' : 'idle'}`}
                testID={`map-roadwork-${work.id}`}
                identifier={`roadwork-${work.id}`}
                coordinate={{ latitude: work.latitude, longitude: work.longitude }}
                anchor={{ x: 0.5, y: 0.5 }}
                zIndex={isSelected ? 15 : 5}
                tracksViewChanges={false}
                onPress={() => onSelectRoadwork?.(work)}
              >
                <View
                  style={[
                    styles.roadworkPin,
                    { backgroundColor: style.color },
                    isSelected && styles.roadworkPinSelected,
                  ]}
                >
                  <MapIcon name={style.icon} size={isSelected ? 16 : 12} color="#FFFFFF" />
                </View>
              </Marker>
            );
          })}

          {/* Issue Pins at Real GPS Coordinates */}
          {issues.map((issue) => {
            const isSelected = issue.id === selectedIssueId;
            const iconName = getCategoryIcon(issue.category);
            const accent = getCategoryPinAccent(issue.category, isDark);
            const statusLabel = t(`issue.status.${issue.status}`);

            return (
              <Marker
                key={`${issue.id}-${isSelected ? 'selected' : 'idle'}-${statusLabel}-${isDark ? 'dark' : 'light'}`}
                testID={`map-pin-${issue.id}`}
                identifier={issue.id}
                coordinate={{ latitude: issue.latitude, longitude: issue.longitude }}
                anchor={isSelected ? { x: 0.5, y: 1 } : { x: 0.5, y: 0.5 }}
                zIndex={isSelected ? 20 : 10}
                tracksViewChanges={false}
                onPress={() => {
                  onSelectIssue(issue);
                  animateTo({
                    latitude: issue.latitude,
                    longitude: issue.longitude,
                    latitudeDelta: Math.min(regionRef.current.latitudeDelta, 0.025),
                    longitudeDelta: Math.min(regionRef.current.longitudeDelta, 0.025),
                  });
                }}
              >
                {isSelected ? (
                  <View style={styles.selectedPinContainer}>
                    <View style={styles.calloutPill}>
                      <View style={styles.calloutLiveDot} />
                      <Text numberOfLines={1} style={styles.calloutAddress}>
                        {shortStreetLabel(issue.address)}
                      </Text>
                      <View style={styles.calloutStatusChip}>
                        <Text style={styles.calloutStatusText}>{statusLabel}</Text>
                      </View>
                    </View>
                    <View style={styles.selectedPinCircle}>
                      <MapIcon name={iconName} size={20} color="#C6EBD3" />
                    </View>
                    <View style={styles.pinTriangle} />
                  </View>
                ) : (
                  <View
                    style={[
                      styles.secondaryPinCircle,
                      {
                        backgroundColor: isDark ? '#26312C' : '#FFFFFF',
                        borderColor: accent.ringColor,
                      },
                    ]}
                  >
                    <MapIcon name={iconName} size={16} color={accent.iconColor} />
                  </View>
                )}
              </Marker>
            );
          })}
        </MapView>
      </View>
    );
  },
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  selectedPinContainer: {
    alignItems: 'center',
  },
  calloutPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: '#39473F',
    marginBottom: 5,
    maxWidth: 220,
    shadowColor: '#1C211F',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  calloutLiveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#C6EBD3',
  },
  calloutAddress: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '700',
    flexShrink: 1,
  },
  calloutStatusChip: {
    backgroundColor: '#446552',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  calloutStatusText: {
    color: '#C6EBD3',
    fontSize: 9.5,
    fontWeight: '600',
  },
  selectedPinCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#39473F',
    borderWidth: 3.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1C211F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 7,
  },
  pinTriangle: {
    width: 0,
    height: 0,
    marginTop: -2,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#39473F',
  },
  roadworkPin: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1C211F',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 2,
    elevation: 3,
  },
  roadworkPinSelected: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 3,
  },
  secondaryPinCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1C211F',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
});

import 'leaflet/dist/leaflet.css';

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useIssueStatusColors } from '@/components/utils/issue-status';
import { useTheme } from '@/hooks/use-theme';
import type { IssueCategory } from '@/models/Issue';

import {
  deltaToLeafletZoom,
  type MapLayerMode,
  type MapRegion,
  METRO_MONT_ROYAL_COORDS,
  MONTREAL_DEFAULT_REGION,
  REV_CORRIDORS,
  shortStreetLabel,
} from '../utils/map-utils';
import type { MontrealMapCanvasProps, MontrealMapHandle } from './MontrealMapCanvas';
import { ROADWORK_STYLE } from './roadwork-style';

const TILE_LAYERS: Record<MapLayerMode, { url: string; attribution: string }> = {
  standard: {
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenStreetMap &copy; CARTO',
  },
  works: {
    url: 'https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap &copy; CyclOSM',
  },
  contrast: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenStreetMap &copy; CARTO',
  },
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getCategoryGlyph(category: IssueCategory): string {
  switch (category) {
    case 'traffic_safety':
      return '🚲';
    case 'streetlights_utilities':
      return '💡';
    case 'roads_potholes':
    default:
      return '▲';
  }
}

/**
 * Interactive Web Montreal street map powered by Leaflet with real OpenStreetMap / CARTO / CyclOSM tiles,
 * REV bike corridor polylines, user beacon, and custom interactive issue markers.
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
    // Markers use theme colors only: status colors for reports, the text color for roadworks.
    const statusColors = useIssueStatusColors();
    /** Theme shadow color at ~30% opacity (8-digit hex), for marker shadows. */
    const markerShadow = `${theme.shadow}4D`;

    const containerRef = useRef<HTMLDivElement | null>(null);
    const mapInstanceRef = useRef<import('leaflet').Map | null>(null);
    const tileLayerRef = useRef<import('leaflet').TileLayer | null>(null);
    const markersLayerRef = useRef<import('leaflet').LayerGroup | null>(null);
    const revLayerRef = useRef<import('leaflet').LayerGroup | null>(null);
    const roadworksLayerRef = useRef<import('leaflet').LayerGroup | null>(null);
    const leafletRef = useRef<typeof import('leaflet') | null>(null);
    const onSelectRef = useRef(onSelectIssue);
    const onSelectRoadworkRef = useRef(onSelectRoadwork);
    const [mapReady, setMapReady] = useState(false);

    useEffect(() => {
      onSelectRef.current = onSelectIssue;
    }, [onSelectIssue]);

    useEffect(() => {
      onSelectRoadworkRef.current = onSelectRoadwork;
    }, [onSelectRoadwork]);

    useImperativeHandle(ref, () => ({
      zoomIn: () => mapInstanceRef.current?.zoomIn(),
      zoomOut: () => mapInstanceRef.current?.zoomOut(),
      recenter: () =>
        mapInstanceRef.current?.flyTo(
          [METRO_MONT_ROYAL_COORDS.latitude, METRO_MONT_ROYAL_COORDS.longitude],
          14,
          { duration: 0.45 },
        ),
      focusRegion: (region: MapRegion) =>
        mapInstanceRef.current?.flyTo(
          [region.latitude, region.longitude],
          deltaToLeafletZoom(region.latitudeDelta),
          { duration: 0.45 },
        ),
    }));

    // Initialize Leaflet map once on mount (browser only)
    useEffect(() => {
      if (typeof window === 'undefined' || !containerRef.current) return;
      let cancelled = false;

      void import('leaflet').then((L) => {
        if (cancelled || !containerRef.current || mapInstanceRef.current) return;
        leafletRef.current = L;

        const map = L.map(containerRef.current, {
          center: [MONTREAL_DEFAULT_REGION.latitude, MONTREAL_DEFAULT_REGION.longitude],
          zoom: deltaToLeafletZoom(MONTREAL_DEFAULT_REGION.latitudeDelta),
          zoomControl: false,
          attributionControl: true,
        });

        const initialLayerKey: MapLayerMode =
          layerMode === 'standard' && isDark ? 'contrast' : layerMode;
        const spec = TILE_LAYERS[initialLayerKey];
        tileLayerRef.current = L.tileLayer(spec.url, {
          attribution: spec.attribution,
          maxZoom: 19,
        }).addTo(map);

        revLayerRef.current = L.layerGroup().addTo(map);
        // Below the report pins, so reports stay on top where they overlap.
        roadworksLayerRef.current = L.layerGroup().addTo(map);
        markersLayerRef.current = L.layerGroup().addTo(map);
        mapInstanceRef.current = map;

        // Add user geolocation beacon at Métro Mont-Royal
        const userIcon = L.divIcon({
          className: 'citypulse-user-beacon',
          html: `<div style="width:18px;height:18px;border-radius:9999px;background:${theme.accent};border:3px solid ${theme.background};box-shadow:0 0 0 8px ${theme.backgroundSelected}73,0 2px 6px ${markerShadow};"></div>`,
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        });
        L.marker([METRO_MONT_ROYAL_COORDS.latitude, METRO_MONT_ROYAL_COORDS.longitude], {
          icon: userIcon,
          interactive: false,
        }).addTo(map);
        setMapReady(true);
      });

      return () => {
        cancelled = true;
        mapInstanceRef.current?.remove();
        mapInstanceRef.current = null;
        tileLayerRef.current = null;
        markersLayerRef.current = null;
        revLayerRef.current = null;
        roadworksLayerRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Update tile layer & REV polylines when layerMode, color scheme, or mapReady changes
    useEffect(() => {
      if (!mapReady) return;
      const L = leafletRef.current;
      const map = mapInstanceRef.current;
      if (!L || !map) return;

      const resolvedKey: MapLayerMode = layerMode === 'standard' && isDark ? 'contrast' : layerMode;
      const spec = TILE_LAYERS[resolvedKey];

      if (tileLayerRef.current) {
        map.removeLayer(tileLayerRef.current);
      }
      tileLayerRef.current = L.tileLayer(spec.url, {
        attribution: spec.attribution,
        maxZoom: 19,
      }).addTo(map);

      if (revLayerRef.current) {
        revLayerRef.current.clearLayers();
        const revColor =
          layerMode === 'works' ? '#15803D' : resolvedKey === 'contrast' ? '#6EE7B7' : '#446552';
        for (const corridor of REV_CORRIDORS) {
          L.polyline(
            corridor.coordinates.map((c) => [c.latitude, c.longitude]),
            {
              color: revColor,
              weight: layerMode === 'works' ? 5 : 3.5,
              opacity: 0.85,
              dashArray: '10, 6',
            },
          ).addTo(revLayerRef.current);
        }
      }
    }, [mapReady, layerMode, isDark]);

    // Sync City of Montréal roadwork markers (small squares, below the report pins)
    useEffect(() => {
      if (!mapReady) return;
      const L = leafletRef.current;
      const layer = roadworksLayerRef.current;
      if (!L || !layer) return;

      layer.clearLayers();
      for (const work of roadworks) {
        const isSelected = work.id === selectedRoadworkId;
        const style = ROADWORK_STYLE[work.type];
        const size = isSelected ? 32 : 22;
        const icon = L.divIcon({
          className: 'citypulse-roadwork',
          html: `<div style="width:${size}px;height:${size}px;border-radius:${isSelected ? 8 : 6}px;background:${theme.text};border:${isSelected ? 3 : 1.5}px solid ${theme.background};display:flex;align-items:center;justify-content:center;font-size:${isSelected ? 15 : 11}px;box-shadow:0 1px 4px ${markerShadow};cursor:pointer;">${style.glyph}</div>`,
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        });
        const marker = L.marker([work.latitude, work.longitude], {
          icon,
          zIndexOffset: isSelected ? 400 : 0,
          title: work.location,
        });
        marker.on('click', () => onSelectRoadworkRef.current?.(work));
        marker.addTo(layer);
      }
    }, [mapReady, roadworks, selectedRoadworkId, theme, markerShadow]);

    // Sync issue markers whenever issues, selection, language, or mapReady changes
    useEffect(() => {
      if (!mapReady) return;
      const L = leafletRef.current;
      const layer = markersLayerRef.current;
      if (!L || !layer) return;

      layer.clearLayers();

      for (const issue of issues) {
        const isSelected = issue.id === selectedIssueId;
        const glyph = getCategoryGlyph(issue.category);
        const statusLabel = escapeHtml(t(`issue.status.${issue.status}`));
        const street = escapeHtml(shortStreetLabel(issue.address));
        // Colored by status, with the category glyph inside (like the report screen's map).
        const statusColor = statusColors[issue.status];

        const icon = isSelected
          ? L.divIcon({
              className: 'montone-active-pin',
              html: `
                <div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-100%);cursor:pointer;">
                  <div style="display:flex;align-items:center;gap:6px;background:${theme.text};color:${theme.background};padding:5px 10px;border-radius:12px;box-shadow:0 4px 12px ${markerShadow};margin-bottom:5px;white-space:nowrap;font-family:Inter,system-ui,sans-serif;">
                    <span style="width:7px;height:7px;border-radius:50%;background:${statusColor};display:inline-block;"></span>
                    <span style="font-size:11.5px;font-weight:700;">${street}</span>
                    <span style="font-size:9.5px;font-weight:600;background:${statusColor};color:${theme.background};padding:2px 6px;border-radius:6px;">${statusLabel}</span>
                  </div>
                  <div style="width:42px;height:42px;border-radius:9999px;background:${statusColor};border:3px solid ${theme.background};display:flex;align-items:center;justify-content:center;font-size:18px;box-shadow:0 4px 12px ${markerShadow};">
                    ${glyph}
                  </div>
                  <div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:8px solid ${statusColor};margin-top:-1px;"></div>
                </div>
              `,
              iconSize: [0, 0],
              iconAnchor: [0, 0],
            })
          : L.divIcon({
              className: 'montone-pin',
              html: `
                <div style="width:34px;height:34px;border-radius:9999px;background:${statusColor};border:2.5px solid ${theme.background};display:flex;align-items:center;justify-content:center;font-size:15px;box-shadow:0 2px 8px ${markerShadow};cursor:pointer;">
                  ${glyph}
                </div>
              `,
              iconSize: [34, 34],
              iconAnchor: [17, 17],
            });

        const marker = L.marker([issue.latitude, issue.longitude], {
          icon,
          zIndexOffset: isSelected ? 500 : 100,
        });
        marker.on('click', () => {
          onSelectRef.current(issue);
          mapInstanceRef.current?.flyTo([issue.latitude, issue.longitude], 15, {
            duration: 0.35,
          });
        });
        marker.addTo(layer);
      }
    }, [mapReady, issues, selectedIssueId, t, theme, statusColors, markerShadow]);

    return (
      <View testID="montreal-map-canvas" style={styles.container}>
        <div
          ref={containerRef}
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            zIndex: 0,
            isolation: 'isolate',
          }}
        />
      </View>
    );
  },
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
    zIndex: 0,
  },
});

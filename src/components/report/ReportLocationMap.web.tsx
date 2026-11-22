import 'leaflet/dist/leaflet.css';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ISSUE_STATUS_COLORS } from '@/components/utils/issue-status';
import { deltaToLeafletZoom, regionForPoints } from '@/components/utils/map-utils';

import type { ReportLocationMapProps } from './ReportLocationMap';

const TILES = {
  url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
  attribution: '&copy; OpenStreetMap &copy; CARTO',
};

/** Web version of the report map, drawn with Leaflet like the Map tab. */
export function ReportLocationMap({ point, issues }: ReportLocationMapProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import('leaflet').Map | null>(null);
  const layerRef = useRef<import('leaflet').LayerGroup | null>(null);
  const leafletRef = useRef<typeof import('leaflet') | null>(null);
  const [ready, setReady] = useState(false);
  const region = useMemo(() => regionForPoints([point, ...issues]), [point, issues]);

  // Create the Leaflet map once (browser only).
  useEffect(() => {
    if (typeof window === 'undefined' || !containerRef.current) return;
    let cancelled = false;
    void import('leaflet').then((L) => {
      if (cancelled || !containerRef.current || mapRef.current) return;
      leafletRef.current = L;
      const map = L.map(containerRef.current, { zoomControl: false, attributionControl: true });
      L.tileLayer(TILES.url, { attribution: TILES.attribution, maxZoom: 19 }).addTo(map);
      layerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
      setReady(true);
    });
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  // Redraw markers and re-frame whenever the point or the issues change.
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!ready || !L || !map || !layer) return;

    layer.clearLayers();
    for (const issue of issues) {
      const status = t(`issue.status.${issue.status}`);
      L.circleMarker([issue.latitude, issue.longitude], {
        radius: 8,
        color: '#FFFFFF',
        weight: 2,
        fillColor: ISSUE_STATUS_COLORS[issue.status],
        fillOpacity: 1,
      })
        .bindTooltip(`${issue.title} — ${status}`)
        .addTo(layer);
    }
    L.circleMarker([point.latitude, point.longitude], {
      radius: 10,
      color: '#FFFFFF',
      weight: 3,
      fillColor: '#39473F',
      fillOpacity: 1,
    })
      .bindTooltip(t('reportMap.reportPoint'))
      .addTo(layer);

    map.setView([region.latitude, region.longitude], deltaToLeafletZoom(region.latitudeDelta));
  }, [ready, issues, point, region, t]);

  return (
    <View testID="report-location-map" style={StyleSheet.absoluteFill}>
      <div ref={containerRef} style={{ width: '100%', height: '100%', zIndex: 0 }} />
    </View>
  );
}

import 'leaflet/dist/leaflet.css';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { CATEGORY_ICONS, mapIconGlyph } from '@/components/map/MapIcon';
import { useIssueStatusColors } from '@/components/utils/issue-status';
import { deltaToLeafletZoom, regionForPoints, reserveBottom } from '@/components/utils/map-utils';
import { useTheme } from '@/hooks/use-theme';

import { OVERLAY_FRACTION, type ReportLocationMapProps } from './ReportLocationMap';

const TILES = {
  url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
  attribution: '&copy; OpenStreetMap &copy; CARTO',
};

/** Web version of the report map, drawn with Leaflet like the Map tab. */
export function ReportLocationMap({
  point,
  issues,
  pinMode = false,
  onPickPoint,
}: ReportLocationMapProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const statusColors = useIssueStatusColors();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import('leaflet').Map | null>(null);
  const layerRef = useRef<import('leaflet').LayerGroup | null>(null);
  const leafletRef = useRef<typeof import('leaflet') | null>(null);
  const [ready, setReady] = useState(false);
  // Read by the map's click handler, which is registered once.
  const pinModeRef = useRef(pinMode);
  const onPickPointRef = useRef(onPickPoint);
  useEffect(() => {
    pinModeRef.current = pinMode;
    onPickPointRef.current = onPickPoint;
  }, [pinMode, onPickPoint]);
  const region = useMemo(
    () => reserveBottom(regionForPoints([point, ...issues]), OVERLAY_FRACTION),
    [point, issues],
  );

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
      // Pin mode: a click on the map picks the new report point.
      map.on('click', (event) => {
        if (!pinModeRef.current) return;
        onPickPointRef.current?.({ latitude: event.latlng.lat, longitude: event.latlng.lng });
      });
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
      const category = t(`issue.category.${issue.category}`);
      // Same look as the native marker: the category glyph on a dot colored by status.
      const icon = L.divIcon({
        className: '',
        html: `<div style="width:24px;height:24px;box-sizing:border-box;border-radius:50%;border:2px solid ${theme.background};background:${statusColors[issue.status]};color:${theme.background};display:flex;align-items:center;justify-content:center;font-size:12px;line-height:1;">${mapIconGlyph(CATEGORY_ICONS[issue.category])}</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });
      // bindTooltip renders text as HTML; escape the user-written title.
      const tooltip = document.createElement('span');
      tooltip.textContent = `${issue.title} — ${category} • ${status}`;
      L.marker([issue.latitude, issue.longitude], { icon }).bindTooltip(tooltip).addTo(layer);
    }
    // A marker too (not a circleMarker, which sits in a lower pane), so it can stay on top.
    const pointIcon = L.divIcon({
      className: '',
      html: `<div style="width:22px;height:22px;box-sizing:border-box;border-radius:50%;border:3px solid ${theme.background};background:${theme.accent};box-shadow:0 0 0 4px ${theme.backgroundSelected};"></div>`,
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    });
    const pointMarker = L.marker([point.latitude, point.longitude], {
      icon: pointIcon,
      zIndexOffset: 1000,
      draggable: pinMode,
    })
      .bindTooltip(t('reportMap.reportPoint'))
      .addTo(layer);
    pointMarker.on('dragend', () => {
      const { lat, lng } = pointMarker.getLatLng();
      onPickPointRef.current?.({ latitude: lat, longitude: lng });
    });

    // Re-frame, except while the user is placing the pin (the map would jump under the cursor).
    if (!pinMode) {
      map.setView([region.latitude, region.longitude], deltaToLeafletZoom(region.latitudeDelta));
    }
  }, [ready, issues, point, region, t, theme, statusColors, pinMode]);

  return (
    <View testID="report-location-map" style={StyleSheet.absoluteFill}>
      <div ref={containerRef} style={{ width: '100%', height: '100%', zIndex: 0 }} />
    </View>
  );
}

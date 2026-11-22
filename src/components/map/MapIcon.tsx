import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { Text } from 'react-native';

export type MapIconName =
  | 'city'
  | 'search'
  | 'close'
  | 'tune'
  | 'bike'
  | 'pothole'
  | 'lightbulb'
  | 'location'
  | 'myLocation'
  | 'layers'
  | 'plus'
  | 'minus'
  | 'thumbUp'
  | 'share'
  | 'arrowForward'
  | 'verified'
  | 'camera'
  | 'park'
  | 'cluster'
  | 'roadwork'
  | 'road'
  | 'water'
  | 'bolt'
  | 'hammer'
  | 'warning';

type SymbolSpec = {
  name: SymbolViewProps['name'];
  fallback: string;
};

const ICON_MAP: Record<MapIconName, SymbolSpec> = {
  city: {
    name: { ios: 'building.2.fill', android: 'location_city', web: 'location_city' },
    fallback: '🏙',
  },
  search: {
    name: { ios: 'magnifyingglass', android: 'search', web: 'search' },
    fallback: '⌕',
  },
  close: {
    name: { ios: 'xmark', android: 'close', web: 'close' },
    fallback: '✕',
  },
  tune: {
    name: { ios: 'slider.horizontal.3', android: 'tune', web: 'tune' },
    fallback: '☰',
  },
  bike: {
    name: { ios: 'bicycle', android: 'pedal_bike', web: 'pedal_bike' },
    fallback: '🚲',
  },
  pothole: {
    name: { ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' },
    fallback: '▲',
  },
  lightbulb: {
    name: { ios: 'lightbulb.fill', android: 'lightbulb', web: 'lightbulb' },
    fallback: '💡',
  },
  location: {
    name: { ios: 'mappin.and.ellipse', android: 'location_on', web: 'location_on' },
    fallback: '📍',
  },
  myLocation: {
    name: { ios: 'location.fill', android: 'my_location', web: 'my_location' },
    fallback: '◎',
  },
  layers: {
    name: { ios: 'square.3.layers.3d', android: 'layers', web: 'layers' },
    fallback: '◫',
  },
  plus: {
    name: { ios: 'plus', android: 'add', web: 'add' },
    fallback: '+',
  },
  minus: {
    name: { ios: 'minus', android: 'remove', web: 'remove' },
    fallback: '−',
  },
  thumbUp: {
    name: { ios: 'hand.thumbsup.fill', android: 'thumb_up', web: 'thumb_up' },
    fallback: '▲',
  },
  share: {
    name: { ios: 'square.and.arrow.up', android: 'share', web: 'share' },
    fallback: '↗',
  },
  arrowForward: {
    name: { ios: 'arrow.right', android: 'arrow_forward', web: 'arrow_forward' },
    fallback: '→',
  },
  verified: {
    name: { ios: 'checkmark.seal.fill', android: 'verified', web: 'verified' },
    fallback: '✓',
  },
  camera: {
    name: { ios: 'camera.fill', android: 'photo_camera', web: 'photo_camera' },
    fallback: '📷',
  },
  park: {
    name: { ios: 'tree.fill', android: 'park', web: 'park' },
    fallback: '🌳',
  },
  cluster: {
    name: { ios: 'circle.grid.2x2.fill', android: 'density_medium', web: 'density_medium' },
    fallback: '◈',
  },
  roadwork: {
    name: { ios: 'wrench.and.screwdriver.fill', android: 'construction', web: 'construction' },
    fallback: '🚧',
  },
  road: {
    name: { ios: 'road.lanes', android: 'road', web: 'road' },
    fallback: '🛣',
  },
  water: {
    name: { ios: 'drop.fill', android: 'water_drop', web: 'water_drop' },
    fallback: '💧',
  },
  bolt: {
    name: { ios: 'bolt.fill', android: 'bolt', web: 'bolt' },
    fallback: '⚡',
  },
  hammer: {
    name: { ios: 'hammer.fill', android: 'handyman', web: 'handyman' },
    fallback: '🏗',
  },
  warning: {
    name: { ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' },
    fallback: '⚠',
  },
};

export interface MapIconProps {
  name: MapIconName;
  size?: number;
  color: string;
}

/** Cross-platform symbol icon for map UI (SF Symbols on iOS, Material Symbols on Android/Web). */
export function MapIcon({ name, size = 18, color }: MapIconProps) {
  const spec = ICON_MAP[name];
  return (
    <SymbolView
      name={spec.name}
      size={size}
      tintColor={color}
      fallback={
        <Text
          style={{
            color,
            fontSize: Math.max(11, Math.round(size * 0.85)),
            lineHeight: Math.round(size * 1.05),
            fontWeight: '700',
            textAlign: 'center',
          }}
        >
          {spec.fallback}
        </Text>
      }
    />
  );
}

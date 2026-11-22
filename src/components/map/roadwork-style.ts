import type { RoadworkType } from '@/lib/api/roadworks';

import type { MapIconName } from './MapIcon';

/** Color, icon and web glyph for each roadwork type, shared by the map pins and the filter chips. */
export const ROADWORK_STYLE: Record<
  RoadworkType,
  { color: string; icon: MapIconName; glyph: string }
> = {
  roads: { color: '#C2410C', icon: 'road', glyph: '🛣' },
  water: { color: '#1D4ED8', icon: 'water', glyph: '💧' },
  utilities: { color: '#7E22CE', icon: 'bolt', glyph: '⚡' },
  building: { color: '#A16207', icon: 'hammer', glyph: '🏗' },
  other: { color: '#475569', icon: 'warning', glyph: '🚧' },
};

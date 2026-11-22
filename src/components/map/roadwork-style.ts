import type { RoadworkType } from '@/lib/api/roadworks';

import type { MapIconName } from './MapIcon';

/**
 * Icon and web glyph per roadwork type. Roadwork markers all use the theme's text color (theme
 * colors only on markers), so the type is told apart by its icon.
 */
export const ROADWORK_STYLE: Record<RoadworkType, { icon: MapIconName; glyph: string }> = {
  roads: { icon: 'road', glyph: '🛣' },
  water: { icon: 'water', glyph: '💧' },
  utilities: { icon: 'bolt', glyph: '⚡' },
  building: { icon: 'hammer', glyph: '🏗' },
  other: { icon: 'warning', glyph: '🚧' },
};

/**
 * Semantic colors used across the app, for light and dark mode.
 * They are mapped from the brand scale in `@/constants/palette`; change shades there,
 * change roles here.
 */

import '@/global.css';

import { Platform } from 'react-native';

import { Palette, StatusColors } from '@/constants/palette';

function semanticColors(mode: 'light' | 'dark') {
  const p = Palette[mode];
  const light = mode === 'light';
  return {
    // Text
    text: p.ink,
    textSecondary: p.neutral[700],
    // Surfaces: the page, raised elements, selected elements, and cards (lighter than the page)
    background: p.bg,
    backgroundElement: p.surface,
    backgroundSelected: p.neutral[300],
    cardBackground: light ? p.neutral[100] : p.neutral[200],
    // Lines and effects
    border: light ? p.neutral[300] : p.neutral[400],
    // Secondary accent, e.g. the "in progress" status
    tint: light ? p.accent[400] : p.accent[700],
    // A dark shadow in both modes
    shadow: Palette.light.neutral[900],
    // Navigation
    tabIconDefault: p.neutral[500],
    tabIconSelected: p.accent[500],
    // Actions
    accent: p.accent[500],
    primaryBtnBackground: p.accent[500],
    secondaryBtnBackground: p.neutral[300],
    /** Text and icons on accent-colored backgrounds. */
    buttonText: light ? p.accent[100] : p.accent[900],
    // Status
    success: StatusColors[mode].success,
    danger: StatusColors[mode].danger,
    // Every palette shade, for the details the roles above don't name. A shade number keeps its
    // role in both modes (low = surface, high = content), so e.g. `neutral300` fits either mode.
    ...shades(p.neutral, 'neutral'),
    ...shades(p.accent, 'accent'),
  };
}

type Shade = 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;

/** `{ 100: '#…', … }` → `{ neutral100: '#…', … }`. */
function shades<P extends string>(scale: Record<Shade, string>, prefix: P) {
  return Object.fromEntries(
    Object.entries(scale).map(([shade, color]) => [`${prefix}${shade}`, color]),
  ) as Record<`${P}${Shade}`, string>;
}

export const Colors = {
  light: semanticColors('light'),
  dark: semanticColors('dark'),
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 7, android: 80 }) ?? 0;
export const MaxContentWidth = 800;

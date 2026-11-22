/**
 * Brand palette, per color scheme: a `neutral` grey scale and an `accent` red scale (100 to 900),
 * plus the page background (`bg`), raised surfaces (`surface`) and text (`ink`).
 *
 * In `light` a low shade number is light; in `dark` it is dark, so the same number keeps its role:
 * a low number is a surface and a high number is the content drawn on it.
 * Components use these through the semantic roles in `@/constants/theme`.
 */

export const Palette = {
  light: {
    neutral: {
      100: '#f8f4f4',
      200: '#eae7e7',
      300: '#d7d3d3',
      400: '#bab6b6',
      500: '#9b9797',
      600: '#7d7979',
      700: '#605d5d',
      800: '#444141',
      900: '#2d2b2b',
    },
    accent: {
      100: '#fff2ef',
      200: '#ffe0d9',
      300: '#ffc4b8',
      400: '#ff9783',
      500: '#ec3013',
      600: '#dd2b0f',
      700: '#ae1800',
      800: '#7c1405',
      900: '#4d170e',
    },
    bg: '#f3f2f2',
    surface: '#eae9e9',
    ink: '#201e1d',
  },
  dark: {
    neutral: {
      100: '#2d2b2b',
      200: '#2a2827',
      300: '#383534',
      400: '#605d5d',
      500: '#7d7979',
      600: '#9b9797',
      700: '#bab6b6',
      800: '#d7d3d3',
      900: '#f3f2f2',
    },
    accent: {
      100: '#3b1610',
      200: '#4d170e',
      300: '#7c1405',
      400: '#ae1800',
      500: '#ec3013',
      600: '#ff563c',
      700: '#ff9783',
      800: '#ffc4b8',
      900: '#fff2ef',
    },
    bg: '#181716',
    surface: '#242221',
    ink: '#f3f2f2',
  },
} as const;
// export const Palette = {
//   light: {
//     100: '#9ECEB0',
//     200: '#8CB69C',
//     300: '#7B9E88',
//     400: '#698875',
//     500: '#597163',
//     600: '#495C51',
//     700: '#39473F',
//     800: '#2A342F',
//     900: '#1C211F',
//   },
//   dark: {
//     100: '#2A342F',
//     200: '#39473F',
//     300: '#495C51',
//     400: '#597163',
//     500: '#698875',
//     600: '#7B9E88',
//     700: '#8CB69C',
//     800: '#9ECEB0',
//     900: '#1C211F',
//   },
// } as const;

export type PaletteShade = keyof typeof Palette.light.neutral;

export const PaletteShades = Object.keys(Palette.light.neutral).map(Number) as PaletteShade[];

export const StatusColors = {
  light: { success: '#201e1d', danger: '#ae1800' },
  dark: { success: '#f3f2f2', danger: '#ff9783' },
} as const;

import { brand, type Shade } from '@/brand';

/**
 * Brand palette (from the active brand's `brands/<id>/brand.json`), per color scheme: a `neutral` grey scale and an `accent` red scale (100 to 900),
 * plus the page background (`bg`), raised surfaces (`surface`) and text (`ink`).
 *
 * In `light` a low shade number is light; in `dark` it is dark, so the same number keeps its role:
 * a low number is a surface and a high number is the content drawn on it.
 * Components use these through the semantic roles in `@/constants/theme`.
 */

export const Palette = brand.palette;

export type PaletteShade = Shade;

export const PaletteShades = Object.keys(Palette.light.neutral).map(Number) as PaletteShade[];

/** Status colors (resolved / problem), per color scheme. */
export const StatusColors = brand.statusColors;

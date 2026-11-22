import Constants from 'expo-constants';

import citypulse from '../../brands/citypulse/brand.json';
import montone from '../../brands/montone/brand.json';

/**
 * White labelling: each brand (app name, store IDs, icon, splash and palette) lives in
 * `brands/<id>/brand.json`. `app.config.ts` builds the native app for the brand named by the
 * `APP_BRAND` environment variable and records its id in `extra.brand`; the app reads the same id
 * here, so the native side (icon, splash, bundle ID) and the JS side (name, colors) always match.
 *
 * Adding a brand: create `brands/<id>/brand.json` (+ icon), then register it below.
 */

export type Shade = 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
export type ColorScale = Record<Shade, string>;

export type BrandPalette = {
  neutral: ColorScale;
  accent: ColorScale;
  /** Page background, raised surfaces, and text. */
  bg: string;
  surface: string;
  ink: string;
};

export type Brand = {
  id: string;
  name: string;
  slug: string;
  scheme: string;
  ios: { bundleIdentifier: string };
  android: { package: string; adaptiveIconBackground: string };
  icon: string;
  splash: { image: string; light: string; dark: string };
  palette: { light: BrandPalette; dark: BrandPalette };
  statusColors: {
    light: { success: string; danger: string };
    dark: { success: string; danger: string };
  };
};

export const DEFAULT_BRAND_ID = 'montone';

/** A bundled image (`require(...)` of a local file). */
type BundledImage = number;

/** Every brand the app can be built as. The logos are bundled; Metro needs static requires. */
export const BRANDS: Record<string, { config: Brand; logo: BundledImage }> = {
  montone: { config: montone, logo: require('@/assets/images/montone-icon.png') },
  citypulse: { config: citypulse, logo: require('../../brands/citypulse/icon.png') },
};

/** The brand this build was made for (`extra.brand` from app.config.ts), else the default. */
export function resolveBrandId(id: unknown): string {
  return typeof id === 'string' && id in BRANDS ? id : DEFAULT_BRAND_ID;
}

const active = BRANDS[resolveBrandId(Constants.expoConfig?.extra?.brand)];

export const brand: Brand = active.config;
export const brandLogo: BundledImage = active.logo;

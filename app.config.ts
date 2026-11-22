import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Extends app.json with the build-time settings that vary:
 *
 * - **White labelling.** `APP_BRAND=<id>` builds the app as the brand in `brands/<id>/brand.json`:
 *   its name, store IDs (bundle identifier / package), link scheme, icon, splash and permission
 *   texts. The brand id goes into `extra.brand`, where the app reads its name and palette
 *   (`src/brand`). Without `APP_BRAND` it is MonTone. After switching brands, regenerate the
 *   native projects: `APP_BRAND=<id> npx expo prebuild --clean`.
 * - **Google Maps on Android.** react-native-maps draws with Google Maps on Android, which needs
 *   an API key (iOS uses Apple Maps). The key comes from `GOOGLE_MAPS_ANDROID_API_KEY` in `.env`
 *   (git-ignored). Without one, Android shows a "map unavailable" note instead of crashing.
 */

type BrandFile = {
  id: string;
  name: string;
  slug: string;
  scheme: string;
  ios: { bundleIdentifier: string };
  android: { package: string; adaptiveIconBackground: string };
  icon: string;
  splash: { image: string; light: string; dark: string };
};

type PluginEntry = string | [string, Record<string, unknown>];

const DEFAULT_BRAND = 'montone';

/** Reads `brands/<id>/brand.json`; an unknown id is an error, so a typo never ships as MonTone. */
export function loadBrand(id: string, root: string = __dirname): BrandFile {
  if (!/^[a-z0-9-]+$/.test(id)) throw new Error(`APP_BRAND "${id}" is not a valid brand id.`);
  const file = join(root, 'brands', id, 'brand.json');
  if (!existsSync(file)) throw new Error(`APP_BRAND "${id}": ${file} does not exist.`);
  return JSON.parse(readFileSync(file, 'utf8')) as BrandFile;
}

/** Replaces a plugin's options in the plugin list (adds the plugin if it is missing). */
function withPluginOptions(
  plugins: PluginEntry[],
  name: string,
  options: Record<string, unknown>,
): PluginEntry[] {
  let found = false;
  const next = plugins.map((entry): PluginEntry => {
    const pluginName = Array.isArray(entry) ? entry[0] : entry;
    if (pluginName !== name) return entry;
    found = true;
    const previous = Array.isArray(entry) ? entry[1] : {};
    return [name, { ...previous, ...options }];
  });
  return found ? next : [...next, [name, options]];
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const brand = loadBrand(process.env.APP_BRAND?.trim() || DEFAULT_BRAND);
  const apiKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY?.trim();

  let plugins = (config.plugins ?? []) as PluginEntry[];
  plugins = withPluginOptions(plugins, 'expo-splash-screen', {
    backgroundColor: brand.splash.light,
    image: brand.splash.image,
    dark: { backgroundColor: brand.splash.dark, image: brand.splash.image },
  });
  plugins = withPluginOptions(plugins, 'expo-image-picker', {
    cameraPermission: `${brand.name} uses your camera to photograph the issues you report.`,
    photosPermission: `${brand.name} uses your photo library to attach photos to the issues you report.`,
  });
  plugins = withPluginOptions(plugins, 'expo-location', {
    locationWhenInUsePermission: `${brand.name} uses your location to pinpoint civic issues and identify your borough.`,
  });

  return {
    ...config,
    name: brand.name,
    slug: brand.slug,
    scheme: brand.scheme,
    icon: brand.icon,
    ios: {
      ...config.ios,
      icon: brand.icon,
      bundleIdentifier: brand.ios.bundleIdentifier,
    },
    android: {
      ...config.android,
      package: brand.android.package,
      adaptiveIcon: {
        ...config.android?.adaptiveIcon,
        foregroundImage: brand.icon,
        backgroundColor: brand.android.adaptiveIconBackground,
      },
      config: {
        ...config.android?.config,
        ...(apiKey ? { googleMaps: { apiKey } } : {}),
      },
    },
    plugins: plugins as ExpoConfig['plugins'],
    extra: {
      ...config.extra,
      brand: brand.id,
      googleMapsAndroid: Boolean(apiKey),
    },
  };
};

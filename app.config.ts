import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Extends app.json. On Android, react-native-maps draws with Google Maps, which needs an API key in
 * the app (iOS uses Apple Maps and needs none). The key comes from `GOOGLE_MAPS_ANDROID_API_KEY` in
 * `.env` (git-ignored), and lands in AndroidManifest.xml at `npx expo prebuild`.
 *
 * Without a key the maps on Android show a "map unavailable" note instead of crashing the app
 * (`extra.googleMapsAndroid` tells the app whether a key was configured).
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const apiKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY?.trim();

  return {
    ...config,
    name: config.name ?? 'Montone',
    slug: config.slug ?? 'Montone',
    android: {
      ...config.android,
      config: {
        ...config.android?.config,
        ...(apiKey ? { googleMaps: { apiKey } } : {}),
      },
    },
    extra: {
      ...config.extra,
      googleMapsAndroid: Boolean(apiKey),
    },
  };
};

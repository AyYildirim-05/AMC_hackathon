import Constants from 'expo-constants';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { type Theme, useThemedStyles } from '@/hooks/use-themed-styles';
import { useTheme } from '@/hooks/use-theme';

import { MapIcon } from './MapIcon';

/**
 * Whether native maps can be drawn. On Android, react-native-maps uses Google Maps, which crashes the
 * whole app without an API key; `app.config.ts` reports whether one was configured. iOS uses Apple
 * Maps and needs no key.
 */
export const nativeMapsAvailable =
  Platform.OS !== 'android' || Boolean(Constants.expoConfig?.extra?.googleMapsAndroid);

/** Shown instead of a map on Android builds made without a Google Maps API key. */
export function MapUnavailable({ testID = 'map-unavailable' }: { testID?: string }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <View testID={testID} style={styles.container}>
      <MapIcon name="layers" size={28} color={theme.textSecondary} />
      <Text style={styles.title}>{t('map.unavailableTitle')}</Text>
      <Text style={styles.body}>{t('map.unavailableBody')}</Text>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      ...StyleSheet.absoluteFill,
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.two,
      padding: Spacing.four,
      backgroundColor: theme.backgroundElement,
    },
    title: { fontSize: 15, fontWeight: '700', color: theme.text, textAlign: 'center' },
    body: { fontSize: 13, color: theme.textSecondary, textAlign: 'center' },
  });

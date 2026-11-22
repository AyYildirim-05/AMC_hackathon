import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/layout/animated-icon';
import AppTabs from '@/components/layout/app-tabs';
import { AuthScreen } from '@/app/auth';
import { ThemedView } from '@/components/utils/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { restoreSavedLanguage } from '@/i18n';
import { AuthProvider, useAuth } from '@/providers/auth-provider';
import { QueryProvider } from '@/providers/query-provider';

SplashScreen.preventAutoHideAsync();

function RootContent() {
  const { status } = useAuth();
  const theme = useTheme();

  if (status === 'loading') {
    return (
      <ThemedView style={styles.loading}>
        <ActivityIndicator color={theme.accent} />
      </ThemedView>
    );
  }

  return status === 'signedIn' ? <AppTabs /> : <AuthScreen />;
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  useEffect(() => {
    restoreSavedLanguage();
  }, []);
  return (
    <QueryProvider>
      <AuthProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <AnimatedSplashOverlay />
          <RootContent />
        </ThemeProvider>
      </AuthProvider>
    </QueryProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

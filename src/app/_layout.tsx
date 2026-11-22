import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, useColorScheme, View } from 'react-native';

import { AuthScreen } from '@/app/auth';
import AppTabs from '@/components/layout/app-tabs';
import { OnboardingPresentationModal } from '@/components/layout/OnboardingPresentationModal';
import { SplashScreenOverlay } from '@/components/layout/SplashScreenOverlay';
import { ThemedView } from '@/components/utils/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { restoreSavedLanguage } from '@/i18n';
import { hasSeenOnboarding, markOnboardingSeen } from '@/lib/onboarding-storage';
import { AuthProvider, useAuth } from '@/providers/auth-provider';
import { QueryProvider } from '@/providers/query-provider';

SplashScreen.preventAutoHideAsync();

function RootContent() {
  const { status } = useAuth();
  const theme = useTheme();
  const [splashDone, setSplashDone] = useState(false);
  const [onboardingStatus, setOnboardingStatus] = useState<'checking' | 'needed' | 'seen'>(
    'checking',
  );

  useEffect(() => {
    let active = true;
    hasSeenOnboarding().then((seen) => {
      if (!active) return;
      setOnboardingStatus(seen ? 'seen' : 'needed');
    });
    return () => {
      active = false;
    };
  }, []);

  const handleCompleteOnboarding = useCallback(() => {
    setOnboardingStatus('seen');
    void markOnboardingSeen();
  }, []);

  const showOnboardingModal = splashDone && onboardingStatus === 'needed';

  return (
    <View style={styles.root}>
      {status === 'loading' ? (
        <ThemedView style={styles.loading}>
          <ActivityIndicator color={theme.accent} />
        </ThemedView>
      ) : status === 'signedIn' ? (
        <AppTabs />
      ) : (
        <AuthScreen />
      )}

      <SplashScreenOverlay
        ready={status !== 'loading' && onboardingStatus !== 'checking'}
        onFinish={() => setSplashDone(true)}
      />

      <OnboardingPresentationModal
        visible={showOnboardingModal}
        onComplete={handleCompleteOnboarding}
      />
    </View>
  );
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
          <RootContent />
        </ThemeProvider>
      </AuthProvider>
    </QueryProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

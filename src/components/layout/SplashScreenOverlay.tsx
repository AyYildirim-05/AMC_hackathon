import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface SplashScreenOverlayProps {
  /** Keeps the splash visible until initial app state (e.g. auth hydration) is ready. */
  ready?: boolean;
  /** Minimum display duration in milliseconds so the entrance animation completes cleanly. */
  minimumDurationMs?: number;
  /** Called once the splash screen has faded out and unmounted. */
  onFinish?: () => void;
  /** Optional testID for automated testing. */
  testID?: string;
}

const DEFAULT_MIN_DURATION_MS = 1350;
const FADE_OUT_DURATION_MS = 380;

export function SplashScreenOverlay({
  ready = true,
  minimumDurationMs = DEFAULT_MIN_DURATION_MS,
  onFinish,
  testID = 'splash-screen-overlay',
}: SplashScreenOverlayProps) {
  const { t } = useTranslation();
  const theme = useTheme();

  const [minElapsed, setMinElapsed] = useState(minimumDurationMs <= 0);
  const [visible, setVisible] = useState(true);
  const hasFinishedRef = useRef(false);
  const onFinishRef = useRef(onFinish);

  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);

  const containerOpacity = useSharedValue(1);
  const logoScale = useSharedValue(0.86);
  const logoOpacity = useSharedValue(0);
  const pulseScale = useSharedValue(0.95);
  const pulseOpacity = useSharedValue(0.45);
  const progress = useSharedValue(0.12);

  // Start entrance + pulse + progress animations on mount and hide the native splash screen.
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});

    logoOpacity.set(withTiming(1, { duration: 480, easing: Easing.out(Easing.cubic) }));
    logoScale.set(withTiming(1, { duration: 540, easing: Easing.out(Easing.back(1.3)) }));
    pulseScale.set(
      withRepeat(
        withSequence(
          withTiming(1.16, { duration: 900, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.96, { duration: 900, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        true,
      ),
    );
    pulseOpacity.set(
      withRepeat(
        withSequence(
          withTiming(0.18, { duration: 900, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.48, { duration: 900, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        true,
      ),
    );
    progress.set(
      withTiming(0.82, {
        duration: Math.max(300, minimumDurationMs),
        easing: Easing.out(Easing.cubic),
      }),
    );

    if (minimumDurationMs <= 0) return;

    const timer = setTimeout(() => {
      setMinElapsed(true);
    }, minimumDurationMs);

    return () => clearTimeout(timer);
  }, [logoOpacity, logoScale, minimumDurationMs, progress, pulseOpacity, pulseScale]);

  // Fade out once both app hydration and minimum display duration are complete.
  useEffect(() => {
    if (!ready || !minElapsed || hasFinishedRef.current) return;
    hasFinishedRef.current = true;

    progress.set(withTiming(1, { duration: 180, easing: Easing.out(Easing.quad) }));
    containerOpacity.set(
      withTiming(0, { duration: FADE_OUT_DURATION_MS, easing: Easing.out(Easing.cubic) }),
    );

    const timer = setTimeout(() => {
      setVisible(false);
      onFinishRef.current?.();
    }, FADE_OUT_DURATION_MS);

    return () => clearTimeout(timer);
  }, [containerOpacity, minElapsed, progress, ready]);

  const overlayAnimatedStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.get(),
  }));

  const logoAnimatedStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.get(),
    transform: [{ scale: logoScale.get() }],
  }));

  const pulseAnimatedStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.get(),
    transform: [{ scale: pulseScale.get() }],
  }));

  const progressFillStyle = useAnimatedStyle(() => ({
    width: `${Math.round(progress.get() * 100)}%`,
  }));

  if (!visible) return null;

  return (
    <Animated.View
      testID={testID}
      accessibilityLabel={t('splash.loadingLabel')}
      style={[styles.overlay, { backgroundColor: theme.background }, overlayAnimatedStyle]}
    >
      {/* Top civic pill */}
      <View
        style={[
          styles.topBadge,
          {
            backgroundColor: theme.backgroundElement,
            borderColor: theme.tint,
          },
        ]}
      >
        <View style={[styles.liveDot, { backgroundColor: theme.success }]} />
        <Text style={[styles.topBadgeText, { color: theme.textSecondary }]}>
          {t('splash.badge')}
        </Text>
      </View>

      {/* Center animated brand emblem */}
      <View style={styles.centerBlock}>
        <View style={styles.emblemStage}>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.outerRing,
              {
                borderColor: theme.neutral400,
                backgroundColor: theme.neutral200,
              },
              pulseAnimatedStyle,
            ]}
          />
          <View
            pointerEvents="none"
            style={[
              styles.innerRing,
              {
                borderColor: theme.neutral300,
                backgroundColor: theme.backgroundElement,
              },
            ]}
          />
          <Animated.View
            style={[
              styles.logoFrame,
              {
                backgroundColor: theme.cardBackground,
                borderColor: theme.tint,
                shadowColor: theme.shadow,
              },
              logoAnimatedStyle,
            ]}
          >
            <Image
              testID="splash-logo-image"
              source={require('@/assets/images/montone-icon.png')}
              style={styles.logoImage}
              contentFit="cover"
            />
          </Animated.View>
        </View>

        <Animated.View style={[styles.titleBlock, logoAnimatedStyle]}>
          <Text style={[styles.brandName, { color: theme.text }]}>{t('splash.title')}</Text>
          <Text style={[styles.tagline, { color: theme.textSecondary }]}>
            {t('splash.tagline')}
          </Text>
        </Animated.View>
      </View>

      {/* Bottom loading progress bar */}
      <View style={styles.footer}>
        <View
          style={[
            styles.progressTrack,
            {
              backgroundColor: theme.backgroundSelected,
            },
          ]}
        >
          <Animated.View
            style={[styles.progressFill, { backgroundColor: theme.accent }, progressFillStyle]}
          />
        </View>
        <Text style={[styles.footerCaption, { color: theme.textSecondary }]}>
          {t('splash.footer')}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 1000,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.six,
    paddingBottom: Spacing.five,
  },
  topBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + Spacing.half,
    borderRadius: 999,
    borderWidth: 1,
  },
  liveDot: {
    width: Spacing.two,
    height: Spacing.two,
    borderRadius: Spacing.one,
  },
  topBadgeText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  centerBlock: {
    alignItems: 'center',
    gap: Spacing.four,
  },
  emblemStage: {
    width: 196,
    height: 196,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outerRing: {
    position: 'absolute',
    width: 192,
    height: 192,
    borderRadius: 96,
    borderWidth: 1.5,
  },
  innerRing: {
    position: 'absolute',
    width: 148,
    height: 148,
    borderRadius: 74,
    borderWidth: 1,
  },
  logoFrame: {
    width: 112,
    height: 112,
    borderRadius: 30,
    borderWidth: 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 18,
    elevation: 10,
  },
  logoImage: {
    width: 112,
    height: 112,
  },
  titleBlock: {
    alignItems: 'center',
    gap: Spacing.two,
    maxWidth: 300,
  },
  brandName: {
    fontFamily: Fonts.rounded,
    fontSize: 38,
    lineHeight: 44,
    fontWeight: '700',
    letterSpacing: -0.6,
  },
  tagline: {
    fontFamily: Fonts.sans,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
    textAlign: 'center',
  },
  footer: {
    width: '100%',
    maxWidth: 260,
    alignItems: 'center',
    gap: Spacing.two,
  },
  progressTrack: {
    width: '100%',
    height: 6,
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  footerCaption: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    letterSpacing: 0.4,
    textAlign: 'center',
  },
});

export default SplashScreenOverlay;

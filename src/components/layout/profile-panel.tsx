import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  Animated,
  BackHandler,
  Easing,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LanguageSwitcher } from '@/components/utils/language-switcher';
import { ProfileScreen } from '@/components/utils/profile-screen';
import { ThemedButton } from '@/components/utils/themed-button';
import { ThemedText } from '@/components/utils/themed-text';
import { Spacing } from '@/constants/theme';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/providers/auth-provider';

/**
 * Door swing: each screen turns in 3D around a vertical hinge. The profile is hinged on the right
 * edge and swings in from edge-on; the screen underneath is hinged on the left edge and swings
 * away, so the two turn in opposite directions like a pair of saloon doors.
 */
const DOOR_ANGLE = '90deg';
const PERSPECTIVE = 1200;
const OPEN_MS = 520;
const CLOSE_MS = 440;
/** A drag only starts from this close to the panel's left edge, like iOS's swipe-back. */
const EDGE_WIDTH = 32;

type ProfilePanelContextValue = {
  open: () => void;
  close: () => void;
  isOpen: boolean;
};

const ProfilePanelContext = createContext<ProfilePanelContextValue>({
  open: () => {},
  close: () => {},
  isOpen: false,
});

/** Opens and closes the profile panel of the nearest `ProfilePanelProvider`. */
export function useProfilePanel() {
  return useContext(ProfilePanelContext);
}

/**
 * Hosts the profile as a door that swings in on a hinge at the right edge, while `children` swing
 * away on a hinge at the left edge: the two turn in opposite directions, like a pair of saloon
 * doors. Closes with the back button, a drag to the right from the panel's left edge, or Android's
 * back button. Wrap the whole tab app in one; a full-screen modal that shows a profile button needs
 * its own, since a modal draws above everything else.
 */
export function ProfilePanelProvider({ children }: { children: ReactNode }) {
  const { width } = useWindowDimensions();
  const theme = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  // Stays mounted while the close animation runs.
  const [mounted, setMounted] = useState(false);
  const [progress] = useState(() => new Animated.Value(0));

  const animateTo = useCallback(
    (toValue: 0 | 1) => {
      Animated.timing(progress, {
        toValue,
        duration: toValue === 1 ? OPEN_MS : CLOSE_MS,
        easing: toValue === 1 ? Easing.bezier(0.2, 0.9, 0.3, 1) : Easing.bezier(0.4, 0, 0.6, 1),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished && toValue === 0) setMounted(false);
      });
    },
    [progress],
  );

  const open = useCallback(() => {
    setMounted(true);
    setIsOpen(true);
    animateTo(1);
  }, [animateTo]);

  const close = useCallback(() => {
    setIsOpen(false);
    animateTo(0);
  }, [animateTo]);

  // Stop a running swing when the provider goes away (e.g. on sign-out), so it never outlives it.
  useEffect(() => () => progress.stopAnimation(), [progress]);

  // Android's back button closes the profile instead of leaving the screen.
  useEffect(() => {
    if (!isOpen) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      close();
      return true;
    });
    return () => subscription.remove();
  }, [isOpen, close]);

  // Drag the panel to the right from its left edge to close it; it follows the finger.
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_evt, g) =>
          g.x0 <= EDGE_WIDTH && g.dx > 8 && Math.abs(g.dx) > Math.abs(g.dy),
        onPanResponderMove: (_evt, g) => {
          progress.setValue(Math.max(0, Math.min(1, 1 - g.dx / width)));
        },
        onPanResponderRelease: (_evt, g) => {
          if (g.dx > width / 3 || g.vx > 0.5) close();
          else animateTo(1);
        },
        onPanResponderTerminate: () => animateTo(1),
      }),
    [progress, width, close, animateTo],
  );

  const contextValue = useMemo(() => ({ open, close, isOpen }), [open, close, isOpen]);

  // Screen underneath: hinge on its left edge, swings away from 0° to 90°.
  const underlayRotate = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', DOOR_ANGLE],
  });
  // Profile: hinge on its right edge, swings in from -90° (edge-on, invisible) to 0° (flat).
  const panelRotate = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [`-${DOOR_ANGLE}`, '0deg'],
  });
  // The turning screen darkens like a door moving out of the light.
  const dimOpacity = progress.interpolate({ inputRange: [0, 1], outputRange: [0, 0.45] });

  return (
    <ProfilePanelContext.Provider value={contextValue}>
      <View style={[styles.root, { backgroundColor: theme.background }]}>
        <Animated.View
          style={[
            styles.fill,
            styles.leftHinge,
            { transform: [{ perspective: PERSPECTIVE }, { rotateY: underlayRotate }] },
          ]}
          // Hidden from touch and screen readers while the profile covers it.
          pointerEvents={isOpen ? 'none' : 'auto'}
          importantForAccessibility={isOpen ? 'no-hide-descendants' : 'auto'}
          accessibilityElementsHidden={isOpen}
        >
          {children}
          {mounted ? (
            <Animated.View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: theme.shadow, opacity: dimOpacity },
              ]}
            />
          ) : null}
        </Animated.View>

        {mounted ? (
          <Animated.View
            testID="profile-panel"
            accessibilityViewIsModal
            style={[
              StyleSheet.absoluteFill,
              styles.panel,
              styles.rightHinge,
              {
                backgroundColor: theme.background,
                shadowColor: theme.shadow,
                transform: [{ perspective: PERSPECTIVE }, { rotateY: panelRotate }],
              },
            ]}
            {...panResponder.panHandlers}
          >
            <ProfilePage onClose={close} />
          </Animated.View>
        ) : null}
      </View>
    </ProfilePanelContext.Provider>
  );
}

/** The profile itself: back button and title, details, language, and Sign out. */
function ProfilePage({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const user = useCurrentUser();
  const { signOut } = useAuth();

  // Close first; signing out then swaps the app for the login screen.
  const handleSignOut = () => {
    onClose();
    void signOut();
  };

  return (
    <SafeAreaView style={styles.fill} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Pressable
          testID="profile-back-button"
          accessibilityRole="button"
          accessibilityLabel={t('profile.close')}
          onPress={onClose}
          hitSlop={12}
          style={({ pressed }) => [
            styles.backButton,
            { backgroundColor: theme.backgroundElement },
            pressed && styles.pressed,
          ]}
        >
          <ThemedText type="subtitle" style={styles.backChevron}>
            ‹
          </ThemedText>
        </Pressable>
        <ThemedText type="subtitle" accessibilityRole="header" style={styles.fill}>
          {t('profile.title')}
        </ThemedText>
      </View>
      {user ? (
        <ScrollView contentContainerStyle={styles.content}>
          <ProfileScreen user={user} />
          <View style={styles.language}>
            <ThemedText type="smallBold" accessibilityRole="header">
              {t('profile.language')}
            </ThemedText>
            <LanguageSwitcher />
          </View>
          <ThemedButton
            type="border"
            tone="danger"
            fullWidth
            style={styles.signOut}
            onPress={handleSignOut}
          >
            {t('auth.signOutButton')}
          </ThemedButton>
        </ScrollView>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  leftHinge: { transformOrigin: 'left center' },
  rightHinge: { transformOrigin: 'right center' },
  fill: { flex: 1 },
  panel: {
    // The shadow falls on the screen underneath, along the panel's left edge.
    shadowOffset: { width: -6, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: Platform.OS === 'android' ? 16 : 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backChevron: { lineHeight: 34, marginTop: -2 },
  pressed: { opacity: 0.75 },
  content: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.six },
  language: { gap: Spacing.two, marginTop: Spacing.four },
  signOut: { marginTop: Spacing.four },
});

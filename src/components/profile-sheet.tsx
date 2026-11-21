import { useTranslation } from 'react-i18next';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import {
  initialWindowMetrics,
  type Metrics,
  SafeAreaProvider,
  SafeAreaView,
} from 'react-native-safe-area-context';

import { ProfileScreen } from '@/components/profile-screen';
import { ThemedButton } from '@/components/themed-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useAuth } from '@/providers/auth-provider';

/**
 * Without starting metrics SafeAreaProvider renders nothing until native code reports insets,
 * which never happens on web or in tests; zero insets are corrected as soon as real ones arrive.
 */
const START_METRICS: Metrics = initialWindowMetrics ?? {
  frame: { x: 0, y: 0, width: 0, height: 0 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

export type ProfileSheetProps = {
  visible: boolean;
  onClose: () => void;
};

/**
 * The signed-in user's profile, slid up over the current screen, with Sign out at the bottom.
 * Opened from the avatar on every screen (the shared top bar and the map's own header).
 */
export function ProfileSheet({ visible, onClose }: ProfileSheetProps) {
  const { t } = useTranslation();
  const user = useCurrentUser();
  const { signOut } = useAuth();
  if (!user) return null;

  // Close the sheet first; signing out then swaps the app for the login screen.
  const handleSignOut = () => {
    onClose();
    void signOut();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      {/* A Modal is a separate native window, so it needs its own safe-area context. */}
      <SafeAreaProvider initialMetrics={START_METRICS}>
        <ThemedView style={styles.flex}>
          <SafeAreaView style={styles.flex} edges={['top', 'left', 'right']}>
            <View style={styles.header}>
              <ThemedText type="subtitle" accessibilityRole="header" style={styles.flex}>
                {t('profile.title')}
              </ThemedText>
              <ThemedButton type="border" size="small" rounded onPress={onClose}>
                {t('profile.close')}
              </ThemedButton>
            </View>
            <ScrollView contentContainerStyle={styles.content}>
              <ProfileScreen user={user} />
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
          </SafeAreaView>
        </ThemedView>
      </SafeAreaProvider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
  },
  content: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.six },
  signOut: { marginTop: Spacing.four },
});

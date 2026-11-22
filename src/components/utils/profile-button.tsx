import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { useProfilePanel } from '@/components/layout/profile-panel';
import { ThemedText } from '@/components/utils/themed-text';
import { computeInitials } from '@/components/utils/formatter';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useTheme } from '@/hooks/use-theme';

export type ProfileButtonProps = {
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * The signed-in user's avatar (initials). Pressing it slides their profile in from the right (see
 * `ProfilePanelProvider`). Renders nothing while no user is known, so screens can always include it.
 */
export function ProfileButton({ style, testID = 'profile-button' }: ProfileButtonProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const user = useCurrentUser();
  const profilePanel = useProfilePanel();

  if (!user) return null;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={t('profile.open', { username: user.username })}
      onPress={profilePanel.open}
      hitSlop={8}
      style={({ pressed }) => [
        styles.avatar,
        { backgroundColor: theme.backgroundSelected },
        pressed && styles.pressed,
        style,
      ]}
    >
      <ThemedText type="smallBold">{computeInitials(user.username)}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.75 },
});

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { ProfileSheet } from '@/components/profile-sheet';
import { ThemedText } from '@/components/themed-text';
import { computeInitials } from '@/components/utils/formatter';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useTheme } from '@/hooks/use-theme';

export type ProfileButtonProps = {
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * The signed-in user's avatar (initials). Pressing it opens their profile sheet. Renders nothing
 * while no user is known, so screens can always include it.
 */
export function ProfileButton({ style, testID = 'profile-button' }: ProfileButtonProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const user = useCurrentUser();
  const [open, setOpen] = useState(false);

  return (
    <>
      {user ? (
        <Pressable
          testID={testID}
          accessibilityRole="button"
          accessibilityLabel={t('profile.open', { username: user.username })}
          onPress={() => setOpen(true)}
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
      ) : null}
      {/* Mounted even before the user loads, so it shares the in-flight /me request. */}
      <ProfileSheet visible={open} onClose={() => setOpen(false)} />
    </>
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

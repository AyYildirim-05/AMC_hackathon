import { useQuery } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { computeInitials } from '@/components/utils/formatter';
import { ProfileSheet } from '@/components/profile-sheet';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useTheme } from '@/hooks/use-theme';
import { isSupportedLanguage, setLanguage, supportedLanguages } from '@/i18n';
import { fetchDistrict } from '@/lib/api/districts';

const APP_NAME = Constants.expoConfig?.name ?? 'Montone';

/**
 * Top bar shared by every tab: the signed-in user's home district and role, a FR/EN switch and
 * their avatar, which opens their profile. Falls back to the app name while the district loads or
 * when there is none.
 */
export function AppHeader() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const user = useCurrentUser();
  const [profileOpen, setProfileOpen] = useState(false);
  const districtId = user?.homeDistrictId ?? null;
  const { data: district } = useQuery({
    queryKey: ['districts', districtId],
    queryFn: () => fetchDistrict(districtId ?? ''),
    enabled: Boolean(districtId),
  });

  const language = isSupportedLanguage(i18n.language) ? i18n.language : 'en';
  const title = district ? (language === 'fr' ? district.nameFr : district.nameEn) : APP_NAME;

  return (
    <View style={styles.bar}>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[styles.icon, { backgroundColor: theme.accent }]}
      >
        <SymbolView
          name={{ ios: 'building.2', android: 'apartment', web: 'apartment' }}
          tintColor={theme.buttonText}
          size={18}
        />
      </View>

      <View style={styles.identity}>
        <ThemedText type="smallBold" numberOfLines={1} accessibilityRole="header">
          {title}
        </ThemedText>
        {user ? (
          <View style={styles.role}>
            <View style={[styles.dot, { backgroundColor: theme.success }]} />
            <ThemedText type="caption" tone="success" numberOfLines={1}>
              {t(`header.roles.${user.role}`)}
            </ThemedText>
          </View>
        ) : null}
      </View>

      <View style={[styles.languages, { backgroundColor: theme.backgroundElement }]}>
        {supportedLanguages.map((code) => {
          const selected = code === language;
          return (
            <Pressable
              key={code}
              accessibilityRole="button"
              accessibilityLabel={t(`language.names.${code}`)}
              accessibilityState={{ selected }}
              onPress={() => void setLanguage(code)}
              style={[styles.language, selected && { backgroundColor: theme.background }]}
            >
              <ThemedText type="smallBold" tone={selected ? 'primary' : 'secondary'}>
                {code.toUpperCase()}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      {user ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('profile.open', { username: user.username })}
          onPress={() => setProfileOpen(true)}
          style={[styles.avatar, { backgroundColor: theme.backgroundSelected }]}
        >
          <ThemedText type="smallBold">{computeInitials(user.username)}</ThemedText>
        </Pressable>
      ) : null}

      <ProfileSheet visible={profileOpen} onClose={() => setProfileOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identity: { flex: 1 },
  role: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  dot: { width: 6, height: 6, borderRadius: 3 },
  languages: { flexDirection: 'row', borderRadius: 999, padding: Spacing.half },
  language: {
    minWidth: 36,
    alignItems: 'center',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: 999,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

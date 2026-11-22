import { useQuery } from '@tanstack/react-query';
import { SymbolView } from 'expo-symbols';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { brand } from '@/brand';
import { ProfileButton } from '@/components/utils/profile-button';
import { ThemedText } from '@/components/utils/themed-text';
import { Spacing } from '@/constants/theme';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useTheme } from '@/hooks/use-theme';
import { isSupportedLanguage } from '@/i18n';
import { fetchDistrict } from '@/lib/api/districts';

const APP_NAME = brand.name;

/**
 * Top bar shared by every tab: the signed-in user's home district and role, and their avatar,
 * which opens their profile (where the app language is changed). Falls back to the app name while the district loads or
 * when there is none.
 */
export function AppHeader() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const user = useCurrentUser();
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

      <ProfileButton />
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
});

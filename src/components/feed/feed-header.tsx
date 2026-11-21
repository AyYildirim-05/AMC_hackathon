import { SymbolView } from 'expo-symbols';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { isSupportedLanguage, setLanguage, supportedLanguages } from '@/i18n';

export type FeedHeaderProps = {
  districtName: string;
  isDistrictClaimed: boolean;
  username: string;
  userInitials: string;
  districtPickerOpen: boolean;
  onPressDistrict: () => void;
  onPressProfile?: () => void;
};

export function FeedHeader({
  districtName,
  isDistrictClaimed,
  username,
  userInitials,
  districtPickerOpen,
  onPressDistrict,
  onPressProfile,
}: FeedHeaderProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const currentLang = isSupportedLanguage(i18n.language) ? i18n.language : 'fr';

  return (
    <ThemedView
      style={[
        styles.header,
        {
          borderBottomColor: theme.backgroundSelected,
        },
      ]}
    >
      <View style={styles.leftGroup}>
        <View style={[styles.logoBadge, { backgroundColor: theme.primaryBtnBackground }]}>
          <SymbolView
            name={{ ios: 'building.2.fill', android: 'location_city', web: 'location_city' }}
            size={18}
            tintColor={theme.buttonText}
          />
        </View>
        <View style={styles.brandStack}>
          <View style={styles.brandRow}>
            <ThemedText type="label" weight="bold" style={styles.brandTitle}>
              {t('feed.brand')}
            </ThemedText>
            <ThemedView type="backgroundSelected" style={styles.cityPill}>
              <ThemedText type="caption" weight="bold" themeColor="accent" style={styles.cityText}>
                {t('feed.cityBadge')}
              </ThemedText>
            </ThemedView>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: districtPickerOpen }}
            onPress={onPressDistrict}
            style={({ pressed }) => [styles.districtBtn, pressed && styles.pressed]}
          >
            <View
              style={[
                styles.syncDot,
                { backgroundColor: isDistrictClaimed ? theme.success : theme.textSecondary },
              ]}
            />
            <ThemedText
              type="caption"
              tone="secondary"
              weight="medium"
              numberOfLines={1}
              style={styles.districtLabel}
            >
              {districtName}
            </ThemedText>
            <SymbolView
              name={{
                ios: districtPickerOpen ? 'chevron.up' : 'chevron.down',
                android: districtPickerOpen ? 'expand_less' : 'expand_more',
                web: districtPickerOpen ? 'expand_less' : 'expand_more',
              }}
              size={12}
              tintColor={theme.textSecondary}
            />
          </Pressable>
        </View>
      </View>

      <View style={styles.rightGroup}>
        <ThemedView type="backgroundElement" style={styles.langToggle}>
          {supportedLanguages.map((lang) => {
            const active = lang === currentLang;
            return (
              <Pressable
                key={lang}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => void setLanguage(lang)}
                style={[
                  styles.langOption,
                  active && { backgroundColor: theme.primaryBtnBackground },
                ]}
              >
                <ThemedText
                  type="caption"
                  weight="bold"
                  themeColor={active ? 'buttonText' : 'textSecondary'}
                  style={styles.langText}
                >
                  {lang.toUpperCase()}
                </ThemedText>
              </Pressable>
            );
          })}
        </ThemedView>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`@${username}`}
          onPress={onPressProfile}
          style={({ pressed }) => [
            styles.avatarButton,
            { backgroundColor: theme.backgroundSelected, borderColor: theme.border },
            pressed && styles.pressed,
          ]}
        >
          <ThemedText type="caption" weight="bold">
            {userInitials}
          </ThemedText>
        </Pressable>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + Spacing.one,
    gap: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    flex: 1,
    minWidth: 0,
  },
  logoBadge: {
    width: 34,
    height: 34,
    borderRadius: Spacing.two + Spacing.half,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandStack: {
    flex: 1,
    minWidth: 0,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + Spacing.half,
  },
  brandTitle: {
    fontSize: 17,
    lineHeight: 22,
  },
  cityPill: {
    paddingHorizontal: Spacing.one + Spacing.half,
    paddingVertical: Spacing.half,
    borderRadius: 999,
  },
  cityText: {
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 0.6,
  },
  districtBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    marginTop: Spacing.half,
  },
  syncDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
  },
  districtLabel: {
    flexShrink: 1,
  },
  rightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  langToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 2,
    borderRadius: 999,
  },
  langOption: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: 999,
    minWidth: 30,
    alignItems: 'center',
  },
  langText: {
    fontSize: 11,
    lineHeight: 14,
  },
  avatarButton: {
    width: 34,
    height: 34,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.75,
  },
});

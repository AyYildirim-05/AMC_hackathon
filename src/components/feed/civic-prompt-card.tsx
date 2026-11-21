import { SymbolView } from 'expo-symbols';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ThemedButton } from '@/components/themed-button';
import { ThemedCard } from '@/components/themed-card';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type CivicPromptCardProps = {
  districtName: string;
  onPressReport?: () => void;
};

export function CivicPromptCard({ districtName, onPressReport }: CivicPromptCardProps) {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <ThemedCard
      variant="elevated"
      padding="medium"
      style={[styles.card, { backgroundColor: theme.primaryBtnBackground }]}
    >
      <View style={styles.row}>
        <View style={styles.textStack}>
          <ThemedText type="cardTitle" themeColor="buttonText" style={styles.title}>
            {t('feed.prompt.title')}
          </ThemedText>
          <ThemedText type="caption" themeColor="buttonText" style={styles.subtitle}>
            {t('feed.prompt.subtitle', { district: districtName })}
          </ThemedText>
        </View>

        <ThemedButton
          type="secondary"
          tone="accent"
          size="small"
          rounded
          onPress={onPressReport}
          style={[styles.ctaButton, { backgroundColor: theme.buttonText }]}
          textStyle={{ color: theme.primaryBtnBackground }}
          icon={
            <SymbolView
              name={{ ios: 'camera.fill', android: 'add_a_photo', web: 'add_a_photo' }}
              size={15}
              tintColor={theme.primaryBtnBackground}
            />
          }
        >
          {t('feed.prompt.cta')}
        </ThemedButton>
      </View>
    </ThemedCard>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  textStack: {
    flex: 1,
    minWidth: 0,
    gap: Spacing.one,
  },
  title: {
    fontSize: 16,
    lineHeight: 22,
  },
  subtitle: {
    opacity: 0.9,
    lineHeight: 17,
  },
  ctaButton: {
    paddingHorizontal: Spacing.three,
  },
});

import { SymbolView } from 'expo-symbols';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ThemedButton } from '@/components/themed-button';
import { ThemedCard } from '@/components/themed-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type UrgentAlertBannerProps = {
  title: string;
  body: string;
  statusLabel: string;
  updatedTime: string;
  districtName: string;
  onPressDetails?: () => void;
};

export function UrgentAlertBanner({
  title,
  body,
  statusLabel,
  updatedTime,
  districtName,
  onPressDetails,
}: UrgentAlertBannerProps) {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <ThemedCard
      variant="outlined"
      padding="medium"
      style={[
        styles.card,
        {
          backgroundColor: theme.backgroundElement,
          borderColor: theme.danger,
        },
      ]}
    >
      <View style={styles.topRow}>
        <View style={styles.titleRow}>
          <View style={[styles.iconBox, { backgroundColor: theme.danger }]}>
            <SymbolView
              name={{ ios: 'exclamationmark.octagon', android: 'emergency', web: 'emergency' }}
              size={16}
              tintColor={theme.buttonText}
            />
          </View>
          <View style={styles.titleStack}>
            <ThemedText type="overline" tone="danger" style={styles.eyebrow}>
              {t('feed.alert.eyebrow')}
            </ThemedText>
            <ThemedText type="label" weight="bold" numberOfLines={1}>
              {title}
            </ThemedText>
          </View>
        </View>

        <ThemedView style={styles.todayPill}>
          <ThemedText type="caption" weight="semibold" tone="danger">
            {statusLabel}
          </ThemedText>
        </ThemedView>
      </View>

      <ThemedText type="cardBody" style={styles.body} numberOfLines={2}>
        {body}
      </ThemedText>

      <View style={styles.footerRow}>
        <View style={styles.syncRow}>
          <SymbolView
            name={{ ios: 'clock', android: 'update', web: 'update' }}
            size={13}
            tintColor={theme.textSecondary}
          />
          <ThemedText type="caption" tone="secondary" numberOfLines={1}>
            {t('feed.alert.syncMeta', { time: updatedTime, district: districtName })}
          </ThemedText>
        </View>

        <ThemedButton
          type="text"
          size="small"
          iconPosition="right"
          onPress={onPressDetails}
          style={styles.detailsBtn}
          textStyle={styles.detailsBtnText}
          icon={
            <SymbolView
              name={{ ios: 'arrow.right', android: 'arrow_forward', web: 'arrow_forward' }}
              size={14}
              tintColor={theme.accent}
            />
          }
        >
          {t('feed.alert.details')}
        </ThemedButton>
      </View>
    </ThemedCard>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Spacing.three,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    flex: 1,
    minWidth: 0,
  },
  iconBox: {
    width: 30,
    height: 30,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleStack: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 0.8,
  },
  todayPill: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: 999,
  },
  body: {
    lineHeight: 19,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  syncRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    flexShrink: 1,
  },
  detailsBtn: {
    minHeight: 28,
    paddingVertical: 2,
    paddingHorizontal: Spacing.one,
  },
  detailsBtnText: {
    fontSize: 12,
    lineHeight: 16,
  },
});

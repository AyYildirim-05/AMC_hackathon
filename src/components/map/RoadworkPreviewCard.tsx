import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Roadwork } from '@/lib/api/roadworks';

import { MapIcon } from './MapIcon';
import { ROADWORK_STYLE } from './roadwork-style';

export interface RoadworkPreviewCardProps {
  work: Roadwork;
  /** True when the map shows works starting soon, false for works under way. */
  upcoming: boolean;
  onClose: () => void;
}

function formatDay(iso: string, language: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(language === 'fr' ? 'fr-CA' : 'en-CA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Bottom card for a City of Montréal roadwork picked on the map. */
export function RoadworkPreviewCard({ work, upcoming, onClose }: RoadworkPreviewCardProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const isDark = theme.text !== '#1C211F';
  const style = ROADWORK_STYLE[work.type];

  const surfaceBg = isDark ? '#212A25' : '#FFFFFF';
  const primaryText = isDark ? '#ECF4EF' : '#181D1B';
  const secondaryText = isDark ? '#9ECEB0' : '#434844';
  const dates = upcoming
    ? t('map.roadworks.starts', { date: formatDay(work.startDate, i18n.language) })
    : t('map.roadworks.until', { date: formatDay(work.endDate, i18n.language) });

  return (
    <View
      testID="map-roadwork-card"
      style={[styles.sheet, { backgroundColor: surfaceBg, shadowColor: theme.shadow }]}
    >
      <View style={styles.headerRow}>
        <View style={[styles.typeBadge, { backgroundColor: style.color }]}>
          <MapIcon name={style.icon} size={13} color="#FFFFFF" />
          <Text style={styles.typeBadgeText}>{t(`map.roadworks.types.${work.type}`)}</Text>
        </View>
        {work.isCityProject ? (
          <View style={[styles.cityBadge, { borderColor: secondaryText }]}>
            <Text style={[styles.cityBadgeText, { color: secondaryText }]}>
              {t('map.roadworks.cityProject')}
            </Text>
          </View>
        ) : null}
        <View style={styles.flex} />
        <Pressable
          testID="map-roadwork-close"
          accessibilityRole="button"
          accessibilityLabel={t('map.closeModal')}
          onPress={onClose}
          hitSlop={10}
          style={[styles.closeBtn, { backgroundColor: isDark ? '#2F3D35' : '#EAEFEB' }]}
        >
          <MapIcon name="close" size={13} color={secondaryText} />
        </Pressable>
      </View>

      <Text style={[styles.location, { color: primaryText }]} numberOfLines={2}>
        {work.location || work.borough}
      </Text>
      <Text style={[styles.reason, { color: secondaryText }]} numberOfLines={2}>
        {work.reason}
      </Text>

      <View style={styles.metaRow}>
        <Text style={[styles.meta, { color: primaryText }]}>{dates}</Text>
        <Text style={[styles.meta, { color: secondaryText }]}>• {work.borough}</Text>
      </View>
      {work.organization ? (
        <Text style={[styles.meta, { color: secondaryText }]} numberOfLines={1}>
          {t('map.roadworks.by', { organization: work.organization })}
        </Text>
      ) : null}
      {work.permitId ? (
        <Text style={[styles.permit, { color: secondaryText }]}>
          {t('map.roadworks.permit', { id: work.permitId })}
        </Text>
      ) : null}

      <Text style={[styles.source, { color: secondaryText }]}>{t('map.roadworks.source')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.three,
    gap: 6,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.14,
    shadowRadius: 14,
    elevation: 10,
  },
  flex: { flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  typeBadgeText: { color: '#FFFFFF', fontSize: 11.5, fontWeight: '700' },
  cityBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, borderWidth: 1 },
  cityBadgeText: { fontSize: 11, fontWeight: '600' },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  location: { fontSize: 16, fontWeight: '700', marginTop: 4 },
  reason: { fontSize: 13 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  meta: { fontSize: 12.5, fontWeight: '500' },
  permit: { fontSize: 11.5, fontFamily: Fonts.mono },
  source: { fontSize: 10.5, marginTop: 6, opacity: 0.8 },
});

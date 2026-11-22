import { useTranslation } from 'react-i18next';
import { ScrollView, Pressable, StyleSheet, Text, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ROADWORK_TYPES, type RoadworkType, type RoadworkWhen } from '@/lib/api/roadworks';

import { MapIcon } from './MapIcon';
import { ROADWORK_STYLE } from './roadwork-style';

export interface RoadworksFilterBarProps {
  types: readonly RoadworkType[];
  /** Works per type for the current borough, timing and city-only choice. */
  typeCounts?: Partial<Record<RoadworkType, number>>;
  onToggleType: (type: RoadworkType) => void;
  when: RoadworkWhen;
  onChangeWhen: (when: RoadworkWhen) => void;
  cityOnly: boolean;
  onToggleCityOnly: () => void;
  shownCount: number;
  status: 'loading' | 'error' | 'ready';
}

/** Second filter section on the map, for the City of Montréal roadworks layer. */
export function RoadworksFilterBar({
  types,
  typeCounts,
  onToggleType,
  when,
  onChangeWhen,
  cityOnly,
  onToggleCityOnly,
  shownCount,
  status,
}: RoadworksFilterBarProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const isDark = theme.text !== '#1C211F';
  const surface = isDark ? 'rgba(33, 42, 37, 0.94)' : 'rgba(255, 255, 255, 0.94)';
  const text = isDark ? '#D7E6DB' : '#39473F';

  const statusLabel =
    status === 'loading'
      ? t('map.roadworks.loading')
      : status === 'error'
        ? t('map.roadworks.error')
        : t('map.roadworks.count', { count: shownCount });

  return (
    <View testID="map-roadworks-filters" style={styles.section}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {ROADWORK_TYPES.map((type) => {
          const selected = types.includes(type);
          const style = ROADWORK_STYLE[type];
          return (
            <Pressable
              key={type}
              testID={`map-roadworks-type-${type}`}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onToggleType(type)}
              style={[
                styles.chip,
                selected
                  ? { backgroundColor: style.color }
                  : { backgroundColor: surface, borderColor: style.color },
              ]}
            >
              <MapIcon name={style.icon} size={13} color={selected ? '#FFFFFF' : style.color} />
              <Text style={[styles.chipLabel, { color: selected ? '#FFFFFF' : text }]}>
                {t(`map.roadworks.types.${type}`)}
              </Text>
              {typeCounts ? (
                <Text style={[styles.chipCount, { color: selected ? '#FFFFFF' : text }]}>
                  {typeCounts[type] ?? 0}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        <View style={[styles.segment, { backgroundColor: surface }]}>
          {(['active', 'upcoming'] as const).map((option) => {
            const selected = when === option;
            return (
              <Pressable
                key={option}
                testID={`map-roadworks-when-${option}`}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => onChangeWhen(option)}
                style={[styles.segmentOption, selected && styles.segmentOptionSelected]}
              >
                <Text style={[styles.chipLabel, { color: selected ? '#FFFFFF' : text }]}>
                  {t(`map.roadworks.when.${option}`)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          testID="map-roadworks-city-only"
          accessibilityRole="button"
          accessibilityState={{ selected: cityOnly }}
          onPress={onToggleCityOnly}
          style={[
            styles.chip,
            cityOnly ? styles.cityOnlySelected : { backgroundColor: surface, borderColor: text },
          ]}
        >
          <MapIcon name="city" size={13} color={cityOnly ? '#FFFFFF' : text} />
          <Text style={[styles.chipLabel, { color: cityOnly ? '#FFFFFF' : text }]}>
            {t('map.roadworks.cityOnly')}
          </Text>
        </Pressable>

        <View style={styles.statusPill}>
          <Text testID="map-roadworks-status" style={styles.statusText}>
            {statusLabel}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 6 },
  row: { paddingHorizontal: Spacing.three, gap: 6, alignItems: 'center' },
  chip: {
    height: 30,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  chipLabel: { fontSize: 11.5, fontWeight: '600' },
  chipCount: { fontSize: 10.5, fontWeight: '700', opacity: 0.85 },
  segment: { flexDirection: 'row', borderRadius: 999, padding: 2 },
  segmentOption: {
    height: 26,
    paddingHorizontal: 10,
    borderRadius: 999,
    justifyContent: 'center',
  },
  segmentOptionSelected: { backgroundColor: '#39473F' },
  cityOnlySelected: { backgroundColor: '#39473F', borderColor: '#39473F' },
  statusPill: {
    height: 26,
    paddingHorizontal: 10,
    borderRadius: 999,
    justifyContent: 'center',
    backgroundColor: 'rgba(57, 71, 63, 0.9)',
  },
  statusText: { color: '#C6EBD3', fontSize: 11, fontWeight: '600' },
});

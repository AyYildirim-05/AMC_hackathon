import { Image } from 'expo-image';
import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { MapIcon, type MapIconName } from '@/components/map/MapIcon';
import { computeInitials } from '@/components/utils/formatter';
import { Pill } from '@/components/utils/pill';
import { ThemedCard } from '@/components/utils/themed-card';
import { ThemedText } from '@/components/utils/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { District } from '@/lib/profile';

/** A district's name in the current language. */
export const districtName = (district: District, language: string) =>
  language.startsWith('en') ? district.name_en : district.name_fr;

export type IdentityCardProps = {
  displayName: string;
  username: string;
  roleLabel: string;
  /** Profile photo; without one the avatar shows initials. */
  avatarUrl?: string | null;
  verified?: boolean;
  activePost?: boolean;
  /** The district line under the divider, e.g. a home or managed district. */
  place?: { name: string; claimed?: boolean };
  postalCode?: string;
};

/** Who the user is: the dark card at the top of every profile. */
export function IdentityCard({
  displayName,
  username,
  roleLabel,
  avatarUrl,
  verified,
  activePost,
  place,
  postalCode,
}: IdentityCardProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const onAccent = { color: theme.buttonText };

  return (
    <View style={[styles.identity, { backgroundColor: theme.accent }]}>
      <View style={styles.identityTop}>
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[styles.avatar, { backgroundColor: theme.buttonText }]}
        >
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatarImage} contentFit="cover" />
          ) : (
            <ThemedText type="h3" style={{ color: theme.accent }}>
              {computeInitials(displayName)}
            </ThemedText>
          )}
        </View>
        <View style={styles.flex}>
          <ThemedText type="h3" numberOfLines={1} style={onAccent}>
            {displayName}
          </ThemedText>
          <ThemedText type="small" style={onAccent}>
            @{username}
          </ThemedText>
          {verified && <Pill tone="inverse">✓ {t('profile.verified')}</Pill>}
          <ThemedText type="caption" style={onAccent}>
            {roleLabel}
          </ThemedText>
        </View>
        {activePost && (
          <Pill tone="inverse" dot>
            {t('profile.activePost')}
          </Pill>
        )}
      </View>

      {(place || postalCode) && (
        <View style={[styles.divider, { backgroundColor: theme.buttonText }]} />
      )}
      {place && (
        <View style={styles.rowCenter}>
          <ThemedText type="smallBold" style={[onAccent, styles.shrink]} numberOfLines={1}>
            {place.name}
          </ThemedText>
          {place.claimed && <Pill tone="inverse">{t('profile.claimed').toUpperCase()}</Pill>}
        </View>
      )}
      {postalCode && (
        <ThemedText type="small" style={onAccent}>
          {t('profile.sector', { code: postalCode })}
        </ThemedText>
      )}
    </View>
  );
}

/** A titled block of a profile, with optional text on the right of the heading. */
export function Section({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <ThemedText type="overline" style={styles.shrink} accessibilityRole="header">
          {title}
        </ThemedText>
        {aside ? (
          <ThemedText type="small" tone="secondary">
            {aside}
          </ThemedText>
        ) : null}
      </View>
      {children}
    </View>
  );
}

/** Two-column grid of StatTiles. */
export function StatGrid({ children }: { children: ReactNode }) {
  return <View style={styles.grid}>{children}</View>;
}

export type StatTileProps = {
  value: string;
  label: string;
  /** Short qualifier shown next to the value, e.g. "311" or "Target < 8h". */
  tag?: string;
  icon: MapIconName;
};

/** A compact stat: an icon, the value with its optional tag, and the label under it. */
export function StatTile({ value, label, tag, icon }: StatTileProps) {
  const theme = useTheme();
  return (
    <ThemedCard variant="outlined" padding="small" style={styles.tile}>
      <View style={styles.tileRow}>
        <View style={[styles.tileIcon, { backgroundColor: theme.backgroundSelected }]}>
          <MapIcon name={icon} size={16} color={theme.text} />
        </View>
        <View style={styles.tileText}>
          <View style={styles.tileValueRow}>
            <ThemedText type="h3" numberOfLines={1} style={styles.shrink}>
              {value}
            </ThemedText>
            {tag ? <Pill>{tag}</Pill> : null}
          </View>
          <ThemedText type="small" tone="secondary" numberOfLines={2}>
            {label}
          </ThemedText>
        </View>
      </View>
    </ThemedCard>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  shrink: { flexShrink: 1 },
  rowCenter: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  identity: { borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.two },
  identityTop: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.three },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: '100%', height: '100%' },
  divider: { height: StyleSheet.hairlineWidth, opacity: 0.4 },
  section: { gap: Spacing.three },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  // Two columns: each tile takes just under half the row, leaving room for the gap.
  tile: { flexBasis: '47%', flexGrow: 1 },
  tileRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  tileIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileText: { flex: 1, minWidth: 0 },
  tileValueRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
});

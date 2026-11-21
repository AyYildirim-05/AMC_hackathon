import { useQuery } from '@tanstack/react-query';
import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AdminProfile } from '@/components/admin-profile';
import { ManagerProfile } from '@/components/manager-profile';
import { districtName, IdentityCard, type IdentityCardProps } from '@/components/profile-parts';
import { ResidentProfile } from '@/components/resident-profile';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { fetchDistrict } from '@/lib/api/districts';
import type { AuthUser } from '@/lib/auth/auth-api';
import {
  buildAdminProfile,
  buildDistrictProfile,
  buildResidentProfile,
  dummyProfileData,
  findPerson,
  type ProfileData,
} from '@/lib/profile';

export type ProfileScreenProps = {
  /** The signed-in user; their role picks the profile layout. */
  user: AuthUser;
  data?: ProfileData;
};

/**
 * The signed-in user's profile. The role from login decides the layout; name, photo, badges and
 * activity come from the dummy data, matched by username. Accounts missing from it get their
 * login identity only.
 */
export function ProfileScreen({ user, data = dummyProfileData }: ProfileScreenProps) {
  const { t, i18n } = useTranslation();
  // Same query as the header, so the home district is fetched once.
  const { data: homeDistrict } = useQuery({
    queryKey: ['districts', user.homeDistrictId],
    queryFn: () => fetchDistrict(user.homeDistrictId ?? ''),
    enabled: user.homeDistrictId !== null,
  });
  const homeName = homeDistrict
    ? i18n.language.startsWith('en')
      ? homeDistrict.nameEn
      : homeDistrict.nameFr
    : undefined;

  const person = findPerson(user.username, data);
  const identity: IdentityCardProps = {
    displayName: person?.display_name ?? user.username,
    avatarUrl: person?.avatar_url,
    verified: person?.is_verified,
    activePost: person?.is_active_post,
    username: user.username,
    roleLabel: t(`header.roles.${user.role}`),
    place: homeName ? { name: homeName } : undefined,
    postalCode: user.postalCode,
  };
  const missing = (
    <ThemedText type="small" tone="secondary">
      {t('profile.missingData', { username: user.username })}
    </ThemedText>
  );

  let body: ReactNode = missing;
  if (user.role === 'district_manager') {
    const profile = buildDistrictProfile(user.username, data);
    identity.roleLabel = t('profile.roleTitle');
    if (profile) {
      identity.place = {
        name: districtName(profile.district, i18n.language),
        claimed: profile.district.is_claimed,
      };
      body = <ManagerProfile profile={profile} />;
    }
  } else if (user.role === 'admin') {
    const profile = buildAdminProfile(user.username, data);
    identity.place = { name: t('profile.admin.allDistricts') };
    if (profile) body = <AdminProfile profile={profile} />;
  } else {
    const profile = buildResidentProfile(user.username, data);
    if (profile) {
      if (profile.homeDistrict) {
        identity.place = { name: districtName(profile.homeDistrict, i18n.language) };
      }
      body = <ResidentProfile profile={profile} />;
    }
  }

  return (
    <View style={styles.page}>
      <IdentityCard {...identity} />
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: Spacing.four },
});

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AdminProfile } from '@/components/utils/admin-profile';
import { ManagerProfile } from '@/components/utils/manager-profile';
import {
  districtName,
  IdentityCard,
  type IdentityCardProps,
} from '@/components/utils/profile-parts';
import { ResidentProfile } from '@/components/utils/resident-profile';
import { ThemedText } from '@/components/utils/themed-text';
import { Spacing } from '@/constants/theme';
import { fetchDistrict } from '@/lib/api/districts';
import { updateIssueStatus } from '@/lib/api/issues';
import { fetchMyProfile } from '@/lib/api/profile';
import type { AuthUser } from '@/lib/auth/auth-api';
import {
  buildAdminProfile,
  buildDistrictProfile,
  buildResidentProfile,
  EMPTY_PROFILE_DATA,
  findPerson,
  type ProfileData,
} from '@/lib/profile';
import type { IssueStatus } from '@/models/Issue';

export type ProfileScreenProps = {
  /** The signed-in user; their role picks the profile layout. */
  user: AuthUser;
  data?: ProfileData;
};

/**
 * The signed-in user's profile. Fetches live role-scoped profile data from `GET /api/profile/me`
 * (or uses an explicitly passed `data` prop in tests).
 */
export function ProfileScreen({ user, data }: ProfileScreenProps) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();

  // Same query as the header, so the home district is fetched once.
  const { data: homeDistrict } = useQuery({
    queryKey: ['districts', user.homeDistrictId],
    queryFn: () => fetchDistrict(user.homeDistrictId ?? ''),
    enabled: Boolean(user.homeDistrictId),
  });

  const { data: fetchedProfile } = useQuery<ProfileData>({
    queryKey: ['profile', 'me', user.id],
    queryFn: fetchMyProfile,
    enabled: data === undefined,
  });

  const statusMutation = useMutation({
    mutationFn: ({ issueId, status }: { issueId: string; status: IssueStatus }) =>
      updateIssueStatus(issueId, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['issues'] });
      void queryClient.invalidateQueries({ queryKey: ['profile', 'me'] });
    },
  });

  const profileData = data ?? fetchedProfile ?? EMPTY_PROFILE_DATA;

  const homeName = homeDistrict
    ? i18n.language.startsWith('en')
      ? homeDistrict.nameEn
      : homeDistrict.nameFr
    : undefined;

  const person = findPerson(user.username, profileData);
  const identity: IdentityCardProps = {
    displayName: person?.display_name ?? user.displayName ?? user.username,
    avatarUrl: person?.avatar_url ?? user.avatarUrl,
    verified: person?.is_verified ?? user.isVerified,
    activePost: person?.is_active_post ?? user.isActivePost,
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
    const profile = buildDistrictProfile(user.username, profileData);
    identity.roleLabel = t('profile.roleTitle');
    if (profile) {
      identity.place = {
        name: districtName(profile.district, i18n.language),
        claimed: profile.district.is_claimed,
      };
      body = (
        <ManagerProfile
          profile={profile}
          onUpdateStatus={(issueId, status) => {
            statusMutation.mutate({ issueId, status });
          }}
        />
      );
    }
  } else if (user.role === 'admin') {
    const profile = buildAdminProfile(user.username, profileData);
    identity.place = { name: t('profile.admin.allDistricts') };
    if (profile) body = <AdminProfile profile={profile} />;
  } else {
    const profile = buildResidentProfile(user.username, profileData);
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

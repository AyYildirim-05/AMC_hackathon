import { useQuery } from '@tanstack/react-query';

import { type AuthUser, fetchCurrentUser } from '@/lib/auth/auth-api';
import { useAuth } from '@/providers/auth-provider';

/**
 * The signed-in user. After an app restart the auth provider only has tokens, so the profile is
 * loaded from `/api/auth/me` (same query key as explore.tsx, so it is fetched once).
 */
export function useCurrentUser(): AuthUser | null {
  const { user, isAuthenticated } = useAuth();
  const { data } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: fetchCurrentUser,
    enabled: isAuthenticated && !user,
  });
  return user ?? data ?? null;
}

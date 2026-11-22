import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios';

import { TEST_PROFILE_DATA } from '../../../../test/fixtures';

import { ProfilePanelProvider } from '@/components/layout/profile-panel';
import i18n, { setLanguage } from '@/i18n';
import { AppHeader } from '@/components/utils/app-header';
import { apiClient } from '@/lib/api/client';
import type { AuthUser } from '@/lib/auth/auth-api';

let mockUser: AuthUser | null = null;
const mockSignOut = jest.fn(async () => {});
jest.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ user: mockUser, isAuthenticated: true, signOut: mockSignOut }),
}));
jest.mock('expo-symbols', () => ({ SymbolView: () => null }));
jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'en', languageTag: 'en-US' }],
}));
jest.mock('expo-secure-store', () => ({
  getItemAsync: async () => null,
  setItemAsync: async () => {},
  deleteItemAsync: async () => {},
}));

const manager: AuthUser = {
  id: '64b7f0c2a1b2c3d4e5f60719',
  username: 'camille_mtl',
  email: 'camille.tremblay@example.ca',
  postalCode: 'H2J1S4',
  homeDistrictId: '64b7f0c2a1b2c3d4e5f60718',
  role: 'district_manager',
  preferredLanguage: 'fr',
};

let requests: string[];
beforeEach(() => {
  requests = [];
  apiClient.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
    requests.push(`${config.method} ${config.url}`);
    const data =
      config.url === '/api/auth/me'
        ? { user: manager }
        : config.url === '/api/profile/me'
          ? {
              person: {
                id: TEST_PROFILE_DATA.persons[0].id,
                username: 'camille_mtl',
                displayName: 'Camille Tremblay',
                avatarUrl: null,
                email: manager.email,
                postalCode: manager.postalCode,
                homeDistrictId: TEST_PROFILE_DATA.districts[0].id,
                role: 'district_manager',
                isVerified: true,
                isActivePost: true,
                preferredLanguage: 'fr',
              },
              persons: TEST_PROFILE_DATA.persons.map((p) => ({
                id: p.id,
                username: p.username,
                displayName: p.display_name,
                avatarUrl: p.avatar_url,
                email: p.email,
                postalCode: p.postal_code,
                homeDistrictId: p.home_district_id,
                role: p.role,
                isVerified: p.is_verified,
                isActivePost: p.is_active_post,
                preferredLanguage: p.preferred_language,
              })),
              districts: TEST_PROFILE_DATA.districts.map((d) => ({
                id: d.id,
                nameFr: d.name_fr,
                nameEn: d.name_en,
                openNorthSlug: d.open_north_slug,
                districtType: d.district_type,
                managerId: d.manager_id,
                isClaimed: d.is_claimed,
              })),
              issues: TEST_PROFILE_DATA.issues,
              comments: TEST_PROFILE_DATA.comments,
              votes: TEST_PROFILE_DATA.votes,
            }
          : { id: manager.homeDistrictId, nameFr: 'Le Plateau-Mont-Royal', nameEn: 'The Plateau' };
    const response: AxiosResponse = { status: 200, data, statusText: '', headers: {}, config };
    return response;
  };
});
afterEach(async () => {
  await setLanguage('en');
});

const renderHeader = (user: AuthUser | null) => {
  mockUser = user;
  // gcTime: Infinity schedules no cache-cleanup timer, which would keep Jest alive for 5 minutes.
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ProfilePanelProvider>
        <AppHeader />
      </ProfilePanelProvider>
    </QueryClientProvider>,
  );
};

it("shows the signed-in user's district, role and initials", async () => {
  await renderHeader(manager);

  expect(await screen.findByText('The Plateau')).toBeOnTheScreen();
  expect(requests).toEqual([`get /api/districts/${manager.homeDistrictId}`]);
  expect(screen.getByText('Borough manager')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Open profile, @camille_mtl' })).toBeOnTheScreen();
  expect(screen.getByText('CM')).toBeOnTheScreen();
});

it('has no language switch; the language is changed from the profile', async () => {
  await renderHeader(manager);
  await screen.findByText('The Plateau');
  expect(screen.queryByText('FR')).toBeNull();
  expect(screen.queryByText('EN')).toBeNull();

  await fireEvent.press(screen.getByRole('button', { name: 'Open profile, @camille_mtl' }));
  expect(screen.getByRole('button', { name: 'English' })).toBeSelected();
  await fireEvent.press(screen.getByRole('button', { name: 'French' }));

  expect(i18n.language).toBe('fr');
  expect(screen.getByRole('button', { name: 'Français' })).toBeSelected();
  await fireEvent.press(screen.getByRole('button', { name: 'Fermer' }));
  expect(await screen.findByText('Le Plateau-Mont-Royal')).toBeOnTheScreen();
  expect(screen.getByText('Gestionnaire d’arrondissement')).toBeOnTheScreen();
});

it('falls back to the app name without a home district, and asks the API for nothing', async () => {
  await renderHeader({ ...manager, homeDistrictId: null, role: 'resident' });

  expect(screen.getByText('MonTone')).toBeOnTheScreen();
  expect(screen.getByText('Resident')).toBeOnTheScreen();
  expect(requests).toEqual([]);
});

it('loads the profile itself when the auth provider only has tokens (after a restart)', async () => {
  await renderHeader(null);

  expect(await screen.findByText('The Plateau')).toBeOnTheScreen();
  expect(screen.getByText('Borough manager')).toBeOnTheScreen();
  expect(requests).toEqual(['get /api/auth/me', `get /api/districts/${manager.homeDistrictId}`]);
});

it("opens the user's profile from the avatar and closes it again", async () => {
  await renderHeader(manager);
  await screen.findByText('The Plateau');
  expect(screen.queryByText('Profile')).toBeNull();

  await fireEvent.press(screen.getByRole('button', { name: 'Open profile, @camille_mtl' }));

  expect(screen.getByRole('header', { name: 'Profile' })).toBeOnTheScreen();
  expect(await screen.findByText('Camille Tremblay')).toBeOnTheScreen();
  expect(screen.getByText('Triage queue')).toBeOnTheScreen();

  await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
  // The profile slides out to the right, then unmounts.
  await waitFor(() => expect(screen.queryByText('Camille Tremblay')).toBeNull());
  expect(screen.getByText('The Plateau')).toBeOnTheScreen();
});

it('signs out from the profile and closes it', async () => {
  mockSignOut.mockClear();
  await renderHeader(manager);
  await screen.findByText('The Plateau');

  await fireEvent.press(screen.getByRole('button', { name: 'Open profile, @camille_mtl' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Sign out' }));

  expect(mockSignOut).toHaveBeenCalledTimes(1);
  await waitFor(() => expect(screen.queryByText('Camille Tremblay')).toBeNull());
});

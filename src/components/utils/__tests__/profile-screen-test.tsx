import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react-native';

import { TEST_PROFILE_DATA } from '../../../../test/fixtures';

import '@/i18n';
import { ProfileScreen } from '@/components/utils/profile-screen';
import type { AuthUser } from '@/lib/auth/auth-api';
import type { ProfileData } from '@/lib/profile';

// The ripple animation isn't under test; a minimal stand-in avoids loading the native runtime.
jest.mock('react-native-reanimated', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  const sharedValue = <T,>(initial: T) => {
    let value = initial;
    return { get: () => value, set: (next: T) => (value = next) };
  };
  return {
    __esModule: true,
    default: { View },
    useSharedValue: sharedValue,
    useAnimatedStyle: (factory: () => object) => factory(),
    withTiming: <T,>(value: T) => value,
  };
});
jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'en', languageTag: 'en-US' }],
}));

/** A logged-in user as the server returns it; homeDistrictId null keeps the API out of it. */
const loggedIn = (username: string, role: AuthUser['role'], email: string): AuthUser => ({
  id: '64b7f0c2a1b2c3d4e5f60719',
  username,
  email,
  postalCode: 'H2J1S4',
  homeDistrictId: null,
  role,
  preferredLanguage: 'en',
});

const renderProfile = (user: AuthUser, data: ProfileData = TEST_PROFILE_DATA) => {
  // gcTime: Infinity schedules no cache-cleanup timer, which would keep Jest alive for 5 minutes.
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ProfileScreen user={user} data={data} />
    </QueryClientProvider>,
  );
};

it('shows the district manager layout for a district_manager', async () => {
  await renderProfile(loggedIn('camille_mtl', 'district_manager', 'camille.tremblay@example.ca'));

  expect(screen.getByText('Camille Tremblay')).toBeOnTheScreen();
  expect(screen.getByText('Official borough manager')).toBeOnTheScreen();
  expect(screen.getByText(/Verified/)).toBeOnTheScreen();
  expect(screen.getByText('Sector #H2J1S4')).toBeOnTheScreen();
  expect(screen.getByText('Triage queue')).toBeOnTheScreen();
  expect(screen.queryByText('My reports')).toBeNull();
});

it("shows a resident's activity and own reports for a resident", async () => {
  await renderProfile(loggedIn('marc_velo', 'resident', 'marc.gagnon@example.ca'));

  expect(screen.getByText('Marc Gagnon')).toBeOnTheScreen();
  expect(screen.getByText('Resident')).toBeOnTheScreen();
  expect(screen.getByText('Le Plateau-Mont-Royal')).toBeOnTheScreen(); // home district
  expect(screen.getByText('My reports')).toBeOnTheScreen();
  expect(screen.getByText('Blocked bike lane on Rue Rachel Est')).toBeOnTheScreen();
  expect(screen.getByText('Comments')).toBeOnTheScreen();
  expect(screen.queryByText('Triage queue')).toBeNull();
  expect(screen.queryByText(/Verified/)).toBeNull();
});

it('shows every district and who manages it for an admin', async () => {
  await renderProfile(loggedIn('admin_mtl', 'admin', 'admin@montone.example.ca'));

  expect(screen.getByText('City overview')).toBeOnTheScreen();
  expect(screen.getByText('Managed by @camille_mtl')).toBeOnTheScreen();
  expect(screen.getByText('Westmount')).toBeOnTheScreen();
  expect(screen.getAllByText('No manager assigned')).toHaveLength(2);
});

it('lets the role from login choose the layout, not the dummy data', async () => {
  // camille_mtl manages a district in the dummy data, but this login says resident.
  await renderProfile(loggedIn('camille_mtl', 'resident', 'camille.tremblay@example.ca'));

  expect(screen.getByText('My reports')).toBeOnTheScreen();
  expect(screen.getByText('No reports yet.')).toBeOnTheScreen();
  expect(screen.queryByText('Triage queue')).toBeNull();
});

it('shows the identity and says the activity data is missing for an unknown account', async () => {
  await renderProfile(loggedIn('new_user', 'resident', 'new_user@example.ca'));

  expect(screen.getByText('@new_user')).toBeOnTheScreen();
  expect(screen.getByText(/No activity data for @new_user yet/)).toBeOnTheScreen();
  expect(screen.queryByText('My reports')).toBeNull();
});

it("shows the manager badges only when the person's data says so", async () => {
  const unverified: ProfileData = {
    ...TEST_PROFILE_DATA,
    persons: TEST_PROFILE_DATA.persons.map((p) =>
      p.username === 'camille_mtl' ? { ...p, is_verified: false, is_active_post: false } : p,
    ),
  };
  await renderProfile(
    loggedIn('camille_mtl', 'district_manager', 'camille.tremblay@example.ca'),
    unverified,
  );

  expect(screen.getByText('Camille Tremblay')).toBeOnTheScreen();
  expect(screen.queryByText(/Verified/)).toBeNull();
  expect(screen.queryByText('Active post')).toBeNull();
  expect(screen.getByText('Triage queue')).toBeOnTheScreen();
});

it("shows a team account's own report from the dummy data", async () => {
  await renderProfile(loggedIn('Ahmet', 'resident', 'ahmet@example.ca'));

  expect(screen.getByText('Rosemont–La Petite-Patrie')).toBeOnTheScreen();
  expect(screen.getByText('Streetlight out on Rue Masson')).toBeOnTheScreen();
  expect(screen.queryByText(/No activity data/)).toBeNull();
});

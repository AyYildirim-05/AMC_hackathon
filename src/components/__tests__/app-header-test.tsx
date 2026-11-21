import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios';

import i18n, { setLanguage } from '@/i18n';
import { AppHeader } from '@/components/app-header';
import { apiClient } from '@/lib/api/client';
import type { AuthUser } from '@/lib/auth/auth-api';

let mockUser: AuthUser | null = null;
const mockSignOut = jest.fn(async () => {});
jest.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ user: mockUser, isAuthenticated: true, signOut: mockSignOut }),
}));
jest.mock('expo-symbols', () => ({ SymbolView: () => null }));
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
      <AppHeader />
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

it('switches the app language and shows the French district name', async () => {
  await renderHeader(manager);
  await screen.findByText('The Plateau');
  expect(screen.getByRole('button', { name: 'English' })).toBeSelected();

  await fireEvent.press(screen.getByRole('button', { name: 'French' }));

  expect(i18n.language).toBe('fr');
  expect(await screen.findByText('Le Plateau-Mont-Royal')).toBeOnTheScreen();
  expect(screen.getByText('Gestionnaire d’arrondissement')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Français' })).toBeSelected();
});

it('falls back to the app name without a home district, and asks the API for nothing', async () => {
  await renderHeader({ ...manager, homeDistrictId: null, role: 'resident' });

  expect(screen.getByText('Montone')).toBeOnTheScreen();
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
  expect(screen.getByText('Camille Tremblay')).toBeOnTheScreen();
  expect(screen.getByText('Triage queue')).toBeOnTheScreen();

  await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
  expect(screen.queryByText('Camille Tremblay')).toBeNull();
});

it('signs out from the profile and closes it', async () => {
  mockSignOut.mockClear();
  await renderHeader(manager);
  await screen.findByText('The Plateau');

  await fireEvent.press(screen.getByRole('button', { name: 'Open profile, @camille_mtl' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Sign out' }));

  expect(mockSignOut).toHaveBeenCalledTimes(1);
  expect(screen.queryByText('Camille Tremblay')).toBeNull();
});

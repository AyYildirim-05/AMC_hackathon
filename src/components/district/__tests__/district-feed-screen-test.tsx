import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { setLanguage } from '@/i18n';
import { DistrictFeedScreen } from '@/components/district/district-feed-screen';
import type { AuthUser } from '@/lib/auth/auth-api';

// camille_mtl lives in Le Plateau-Mont-Royal in dummy_data/person.json.
const mockUser: AuthUser = {
  id: '64b7f0c2a1b2c3d4e5f60719',
  username: 'camille_mtl',
  email: 'camille.tremblay@example.ca',
  postalCode: 'H2J1S4',
  homeDistrictId: null,
  role: 'district_manager',
  preferredLanguage: 'fr',
};
jest.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ user: mockUser, isAuthenticated: true, signOut: async () => {} }),
}));
const mockNavigate = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ navigate: mockNavigate }) }));
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
  getLocales: () => [{ languageCode: 'fr', languageTag: 'fr-CA' }],
}));
jest.mock('expo-secure-store', () => ({
  getItemAsync: async () => null,
  setItemAsync: async () => {},
  deleteItemAsync: async () => {},
}));

const renderFeed = () => {
  // gcTime: Infinity schedules no cache-cleanup timer, which would keep Jest alive for 5 minutes.
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}
    >
      <QueryClientProvider client={client}>
        <DistrictFeedScreen />
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
};

beforeEach(async () => {
  mockNavigate.mockClear();
  await setLanguage('fr');
});
afterAll(async () => {
  await setLanguage('en');
});

it("shows the user's district feed matching screen3", async () => {
  await renderFeed();

  expect(screen.getByText('OpenNorth Sync')).toBeOnTheScreen();
  expect(screen.getByText('le-plateau-mont-royal')).toBeOnTheScreen();
  expect(screen.getByText('Tous')).toBeOnTheScreen();
  expect(screen.getByText('5')).toBeOnTheScreen();

  // Works alert: the Plateau's in-progress report with an official update.
  const alert = screen.getByTestId('district-feed-alert');
  expect(within(alert).getByText('Alerte travaux express')).toBeOnTheScreen();
  expect(within(alert).getByText('Blocked bike lane on Rue Rachel Est')).toBeOnTheScreen();

  expect(screen.getByText('Signalements récents')).toBeOnTheScreen();
  expect(screen.getByText('Le Plateau-Mont-Royal & limitrophes')).toBeOnTheScreen();
  expect(screen.getByText('Un problème dans votre rue ?')).toBeOnTheScreen();
});

it('flags reports from other districts', async () => {
  await renderFeed();

  const ribbon = screen.getByTestId('district-feed-outside-7c9e6679-7425-40de-944b-e07fc1f90ae7');
  expect(within(ribbon).getByText(/Hors de mon quartier • Ville-Marie/)).toBeOnTheScreen();
  expect(
    screen.queryByTestId('district-feed-outside-f47ac10b-58cc-4372-a567-0e02b2c3d479'),
  ).toBeNull();
});

it('filters the feed by category', async () => {
  await renderFeed();
  expect(screen.getByText('Deep pothole near Beaubien and Saint-Denis')).toBeOnTheScreen();

  await fireEvent.press(screen.getByTestId('district-feed-category-traffic_safety'));

  expect(screen.getByTestId('district-feed-category-traffic_safety')).toBeSelected();
  expect(screen.queryByText('Deep pothole near Beaubien and Saint-Denis')).toBeNull();
});

it('switches district from the picker', async () => {
  await renderFeed();

  await fireEvent.press(screen.getByTestId('district-feed-picker'));
  await fireEvent.press(screen.getByRole('button', { name: /Ville-Marie/ }));

  expect(screen.getByText('Ville-Marie & limitrophes')).toBeOnTheScreen();
  expect(screen.getAllByText('ville-marie').length).toBeGreaterThanOrEqual(1);
});

it('opens the report form from the call to action', async () => {
  await renderFeed();

  await fireEvent.press(screen.getByTestId('district-feed-report-button'));

  expect(mockNavigate).toHaveBeenCalledWith('/report');
});

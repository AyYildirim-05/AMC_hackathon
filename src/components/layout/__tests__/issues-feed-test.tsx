import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import IssuesScreen from '@/app/index';
import { setLanguage } from '@/i18n';
import type { AuthUser } from '@/lib/auth/auth-api';

import { installMockBackendApi } from '../../../../test/fixtures';

// A resident of Le Plateau-Mont-Royal (district …101 in the fixtures).
const mockUser: AuthUser = {
  id: '5e6f7a8b-9c0d-4e1f-2a3b-4c5d6e7f8a9b',
  username: 'marc_velo',
  email: 'marc.gagnon@example.ca',
  postalCode: 'H2H1M8',
  homeDistrictId: '11111111-1111-4111-8111-111111111101',
  role: 'resident',
  preferredLanguage: 'en',
};
jest.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ user: mockUser, isAuthenticated: true, signOut: async () => {} }),
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

// Fixture reports: Plateau 1 (in progress), Ville-Marie 1 (in progress), Rosemont 2 (to do),
// Westmount 1 (to do).
const PLATEAU = 'Blocked bike lane on Rue Rachel Est';
const VILLE_MARIE = 'Out-of-service station elevator near Berri-UQAM';
const ROSEMONT = ['Deep pothole near Beaubien and Saint-Denis', 'Streetlight out on Rue Masson'];

let restoreApi: (() => void) | undefined;
beforeEach(async () => {
  restoreApi = installMockBackendApi();
  await setLanguage('en');
});
afterEach(() => restoreApi?.());

const renderFeed = async () => {
  // gcTime: Infinity schedules no cache-cleanup timer, which would keep Jest alive for 5 minutes.
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  await render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}
    >
      <QueryClientProvider client={client}>
        <IssuesScreen />
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
  await screen.findByText(PLATEAU);
};

const pickBorough = async (option: string) => {
  await fireEvent.press(screen.getByTestId('feed-borough-button'));
  await fireEvent.press(await screen.findByTestId(`feed-borough-option-${option}`));
};

it('greets the user by name in a card with the app header, above the search', async () => {
  await renderFeed();

  const card = screen.getByTestId('welcome-card');
  expect(await screen.findByText('Hello, Marc Gagnon')).toBeOnTheScreen();
  expect(within(card).getByText('@marc_velo')).toBeOnTheScreen();
  // The app header (district and role) is inside the card, and only there.
  expect(screen.getAllByText('Resident')).toHaveLength(1);
  expect(card).toContainElement(screen.getByText('Resident'));
  expect(screen.getByTestId('feed-search-input')).toBeOnTheScreen();
});

it('starts on the borough the user lives in', async () => {
  await renderFeed();

  expect(
    await screen.findByText('My borough · Le Plateau-Mont-Royal', { exact: false }),
  ).toBeOnTheScreen();
  expect(screen.getByText(PLATEAU)).toBeOnTheScreen();
  expect(screen.queryByText(VILLE_MARIE)).toBeNull();
  expect(screen.getByTestId('feed-results-count')).toHaveTextContent('1 report');
});

it('shows every borough, then filters them by status with live counts', async () => {
  await renderFeed();
  await pickBorough('all');

  await waitFor(() =>
    expect(screen.getByTestId('feed-results-count')).toHaveTextContent('5 reports'),
  );
  expect(screen.getByTestId('feed-status-in_progress')).toHaveTextContent('In progress2');
  expect(screen.getByTestId('feed-status-not_started')).toHaveTextContent('To do3');

  await fireEvent.press(screen.getByTestId('feed-status-in_progress'));

  expect(screen.getByTestId('feed-status-in_progress')).toBeSelected();
  expect(screen.getByText(PLATEAU)).toBeOnTheScreen();
  expect(screen.getByText(VILLE_MARIE)).toBeOnTheScreen();
  expect(screen.queryByText(ROSEMONT[0])).toBeNull();
  expect(screen.getByTestId('feed-results-count')).toHaveTextContent('2 reports');
});

it('shows another borough instead of the one the user lives in', async () => {
  await renderFeed();
  await pickBorough('rosemont-la-petite-patrie');

  await waitFor(() => expect(screen.getByText(ROSEMONT[0])).toBeOnTheScreen());
  expect(screen.getByText(ROSEMONT[1])).toBeOnTheScreen();
  expect(screen.queryByText(PLATEAU)).toBeNull();
  expect(screen.getByTestId('feed-borough-button')).toHaveTextContent(
    'Rosemont–La Petite-Patrie ▾',
  );
});

it('picks the borough in a sheet with a search, a close button, and a tap-outside close', async () => {
  await renderFeed();

  await fireEvent.press(screen.getByTestId('feed-borough-button'));
  expect(await screen.findByTestId('feed-borough-picker')).toBeOnTheScreen();
  expect(screen.getByRole('header', { name: 'Choose a borough' })).toBeOnTheScreen();
  expect(screen.getByTestId('feed-borough-option-ville-marie')).toBeOnTheScreen();

  await fireEvent.changeText(screen.getByTestId('feed-borough-picker-search'), 'rose');
  expect(screen.getByTestId('feed-borough-option-rosemont-la-petite-patrie')).toBeOnTheScreen();
  expect(screen.queryByTestId('feed-borough-option-ville-marie')).toBeNull();

  await fireEvent.press(screen.getByTestId('feed-borough-picker-close'));
  await waitFor(() => expect(screen.queryByTestId('feed-borough-picker')).toBeNull());
  // Closing keeps the current borough.
  expect(screen.getByText(PLATEAU)).toBeOnTheScreen();

  // Tapping the dimmed screen above the sheet closes it too.
  await fireEvent.press(screen.getByTestId('feed-borough-button'));
  await fireEvent.press(await screen.findByTestId('feed-borough-picker-backdrop'));
  await waitFor(() => expect(screen.queryByTestId('feed-borough-picker')).toBeNull());
});

it('searches across boroughs, and resets from the empty state', async () => {
  await renderFeed();
  await pickBorough('all');

  await fireEvent.changeText(screen.getByTestId('feed-search-input'), 'masson');
  expect(screen.getByText(ROSEMONT[1])).toBeOnTheScreen();
  expect(screen.getByTestId('feed-results-count')).toHaveTextContent('1 report');

  await fireEvent.changeText(screen.getByTestId('feed-search-input'), 'nothing like this');
  expect(screen.getByTestId('feed-empty')).toBeOnTheScreen();

  await fireEvent.press(screen.getByTestId('feed-reset-filters'));
  expect(screen.getByTestId('feed-search-input').props.value).toBe('');
  expect(screen.getByTestId('feed-results-count')).toHaveTextContent('5 reports');
});

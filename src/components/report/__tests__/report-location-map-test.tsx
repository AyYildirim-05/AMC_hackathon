import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';

import CardScreen from '@/app/card';
import { setLanguage } from '@/i18n';
import { DistrictScreen } from '@/components/report/DistrictScreen';
import { OVERLAY_FRACTION, ReportLocationMap } from '@/components/report/ReportLocationMap';
import { ISSUE_STATUS_COLORS } from '@/components/utils/issue-status';
import { regionForPoints, reserveBottom } from '@/components/utils/map-utils';
import type { AuthUser } from '@/lib/auth/auth-api';
import type { Issue } from '@/models/Issue';

import { installMockBackendApi, TEST_ISSUES } from '../../../../test/fixtures';

const mockNavigate = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ navigate: mockNavigate }),
}));

const mockUser: AuthUser = {
  id: '64b7f0c2a1b2c3d4e5f60719',
  username: 'marc_velo',
  email: 'marc.gagnon@example.ca',
  postalCode: 'H2J1S4',
  homeDistrictId: null,
  role: 'resident',
  preferredLanguage: 'en',
};
jest.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ user: mockUser, isAuthenticated: true, signOut: async () => {} }),
}));

// Symbol views render nothing under Jest; a stand-in exposes which icon a marker draws.
jest.mock('@/components/map/MapIcon', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    ...jest.requireActual<typeof import('@/components/map/MapIcon')>('@/components/map/MapIcon'),
    MapIcon: ({ name }: { name: string }) => <View testID={`map-icon-${name}`} />,
  };
});

// A device standing on Rue Masson, in Rosemont–La Petite-Patrie.
const GPS = { latitude: 45.546312, longitude: -73.577421 };
jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  requestForegroundPermissionsAsync: async () => ({ status: 'granted' }),
  getCurrentPositionAsync: async () => ({ coords: { latitude: 45.546312, longitude: -73.577421 } }),
  reverseGeocodeAsync: async () => [],
}));

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

const issue = (
  id: string,
  status: Issue['status'],
  latitude: number,
  category: Issue['category'] = 'traffic_safety',
): Issue => ({
  ...TEST_ISSUES[0],
  id,
  title: `Issue ${id}`,
  status,
  category,
  latitude,
  longitude: -73.58,
});
const dotColor = (label: RegExp) =>
  StyleSheet.flatten(screen.getByLabelText(label).props.style).backgroundColor;

describe('ReportLocationMap', () => {
  beforeEach(async () => {
    await setLanguage('en');
  });

  it('marks the report point, colors each issue by status and shows its category icon', async () => {
    await render(
      <ReportLocationMap
        point={{ latitude: 45.53, longitude: -73.58 }}
        issues={[
          issue('a', 'not_started', 45.531, 'traffic_safety'),
          issue('b', 'in_progress', 45.532, 'roads_potholes'),
          issue('c', 'resolved', 45.533, 'streetlights_utilities'),
        ]}
      />,
    );

    expect(screen.getByTestId('report-map-point').props.coordinate).toEqual({
      latitude: 45.53,
      longitude: -73.58,
    });
    expect(screen.getByLabelText('Your report')).toBeOnTheScreen();
    expect(screen.getByTestId('report-map-issue-b').props.coordinate).toEqual({
      latitude: 45.532,
      longitude: -73.58,
    });
    expect(dotColor(/Issue a, Cycling safety, To do/)).toBe(ISSUE_STATUS_COLORS.not_started);
    expect(dotColor(/Issue b, Potholes & roads, In progress/)).toBe(
      ISSUE_STATUS_COLORS.in_progress,
    );
    expect(dotColor(/Issue c, Streetlights & utilities, Resolved/)).toBe(
      ISSUE_STATUS_COLORS.resolved,
    );
    const marker = (id: string) => within(screen.getByTestId(`report-map-issue-${id}`));
    expect(marker('a').getByTestId('map-icon-bike')).toBeOnTheScreen();
    expect(marker('b').getByTestId('map-icon-pothole')).toBeOnTheScreen();
    expect(marker('c').getByTestId('map-icon-lightbulb')).toBeOnTheScreen();
  });

  it('frames the markers above the badge and button that cover the bottom of the map', async () => {
    const point = { latitude: 45.53, longitude: -73.58 };
    const issues = [issue('a', 'not_started', 45.54)];
    await render(<ReportLocationMap point={point} issues={issues} />);

    expect(screen.getByTestId('report-location-map').props.initialRegion).toEqual(
      reserveBottom(regionForPoints([point, ...issues]), OVERLAY_FRACTION),
    );
  });
});

describe('DistrictScreen report map', () => {
  let restoreApi: (() => void) | undefined;

  beforeEach(async () => {
    restoreApi = installMockBackendApi({ currentUsername: mockUser.username });
    await setLanguage('en');
  });
  afterEach(() => restoreApi?.());

  const renderScreen = () => {
    // gcTime: Infinity schedules no cache-cleanup timer, which would keep Jest alive for 5 minutes.
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    return render(<DistrictScreen />, { wrapper });
  };

  it("puts the report at the device's location and shows only that district's issues by status", async () => {
    await renderScreen();

    // The GPS position (Rosemont) becomes the report point...
    await waitFor(() =>
      expect(screen.getByTestId('report-map-point').props.coordinate).toEqual({
        latitude: GPS.latitude,
        longitude: GPS.longitude,
      }),
    );
    // ...and the map shows Rosemont's two open issues, not the Plateau one.
    const rosemont = TEST_ISSUES.filter(
      (i) => i.district_id === '11111111-1111-4111-8111-111111111103',
    );
    expect(rosemont).toHaveLength(2);
    for (const i of rosemont) {
      expect(await screen.findByTestId(`report-map-issue-${i.id}`)).toBeOnTheScreen();
    }
    expect(screen.queryByTestId(`report-map-issue-${TEST_ISSUES[0].id}`)).toBeNull();

    const legend = screen.getByTestId('report-map-legend');
    expect(legend).toHaveTextContent(/Other issues in Rosemont/);
    expect(legend).toHaveTextContent(/To do \(2\)/);
    expect(legend).toHaveTextContent(/In progress \(0\)/);
  });

  it('adds the newly published issue to the report map and displays it on the Carte map tab', async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    let createdIssue: Partial<Issue> | undefined;
    await render(<DistrictScreen onSubmitSuccess={(issueData) => (createdIssue = issueData)} />, {
      wrapper,
    });
    await waitFor(() => expect(screen.getAllByTestId(/^report-map-issue-/)).toHaveLength(2));

    // Fill the required fields (GPS already filled the address & coordinates)
    await fireEvent.press(screen.getByTestId('category-card-roads_potholes'));
    await fireEvent.changeText(screen.getByTestId('report-title-input'), 'Pothole on Masson');
    await fireEvent.changeText(
      screen.getByTestId('report-description-input'),
      'Deep pothole near the crosswalk.',
    );

    await fireEvent.press(screen.getByTestId('publish-report-button'));

    // Publishing updates & invalidates the issue queries, so the district's list includes the new dot.
    await waitFor(() => expect(screen.getAllByTestId(/^report-map-issue-/)).toHaveLength(3));
    const known = new Set(TEST_ISSUES.map((i) => `report-map-issue-${i.id}`));
    const added = screen
      .getAllByTestId(/^report-map-issue-/)
      .find((m) => !known.has(m.props.testID));
    expect(added?.props.coordinate).toEqual({ latitude: GPS.latitude, longitude: GPS.longitude });
    expect(screen.getByTestId('report-map-legend')).toHaveTextContent(/To do \(3\)/);
    expect(mockNavigate).toHaveBeenCalledWith('/');
    expect(createdIssue?.id).toBeTruthy();

    // Switching to the Carte (Map) tab displays the newly created issue pin on the Montreal map.
    await render(<CardScreen />, { wrapper });
    const pin = await screen.findByTestId(`map-pin-${createdIssue!.id}`);
    expect(pin).toBeOnTheScreen();
    expect(pin.props.coordinate).toEqual({ latitude: GPS.latitude, longitude: GPS.longitude });
    expect(screen.getByText('Pothole on Masson')).toBeOnTheScreen();
  });
});

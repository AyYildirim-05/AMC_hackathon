import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';

import { setLanguage } from '@/i18n';
import { DistrictScreen } from '@/components/report/DistrictScreen';
import { ReportLocationMap } from '@/components/report/ReportLocationMap';
import { ISSUE_STATUS_COLORS } from '@/components/utils/issue-status';
import type { AuthUser } from '@/lib/auth/auth-api';
import type { Issue } from '@/models/Issue';

import { installMockBackendApi, TEST_ISSUES } from '../../../../test/fixtures';

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

const issue = (id: string, status: Issue['status'], latitude: number): Issue => ({
  ...TEST_ISSUES[0],
  id,
  title: `Issue ${id}`,
  status,
  latitude,
  longitude: -73.58,
});
const dotColor = (label: RegExp) =>
  StyleSheet.flatten(screen.getByLabelText(label).props.style).backgroundColor;

describe('ReportLocationMap', () => {
  beforeEach(async () => {
    await setLanguage('en');
  });

  it('marks the report point and colors each issue by its status', async () => {
    await render(
      <ReportLocationMap
        point={{ latitude: 45.53, longitude: -73.58 }}
        issues={[
          issue('a', 'not_started', 45.531),
          issue('b', 'in_progress', 45.532),
          issue('c', 'resolved', 45.533),
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
    expect(dotColor(/Issue a, To do/)).toBe(ISSUE_STATUS_COLORS.not_started);
    expect(dotColor(/Issue b, In progress/)).toBe(ISSUE_STATUS_COLORS.in_progress);
    expect(dotColor(/Issue c, Resolved/)).toBe(ISSUE_STATUS_COLORS.resolved);
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
});

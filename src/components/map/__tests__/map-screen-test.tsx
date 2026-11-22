import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { Share } from 'react-native';

import { installMockBackendApi, TEST_DISTRICTS, TEST_ISSUES } from '../../../../test/fixtures';

import CardScreen from '@/app/card';
import {
  BOROUGH_REGIONS,
  deltaToLeafletZoom,
  filterMapIssues,
  getCategoryCounts,
  getDistrictName,
  MONTREAL_DEFAULT_REGION,
  nextLayerMode,
  normalizeDistrict,
  normalizeIssue,
  REV_CORRIDORS,
  shortStreetLabel,
  zoomRegion,
} from '@/components/utils/map-utils';
import i18n from '@/i18n';

const mockAnimateToRegion = jest.fn();
const mockSignOut = jest.fn();

jest.mock('react-native-maps', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Pressable, View } = jest.requireActual<typeof import('react-native')>('react-native');

  const MockMapView = React.forwardRef(function MockMapView(
    { children, testID, ...props }: { children?: React.ReactNode; testID?: string },
    ref: React.ForwardedRef<{ animateToRegion: typeof mockAnimateToRegion }>,
  ) {
    React.useImperativeHandle(ref, () => ({
      animateToRegion: mockAnimateToRegion,
    }));
    return (
      <View testID={testID ?? 'native-map-view'} {...props}>
        {children}
      </View>
    );
  });

  function MockMarker({
    children,
    onPress,
    testID,
  }: {
    children?: React.ReactNode;
    onPress?: () => void;
    testID?: string;
  }) {
    return (
      <Pressable testID={testID} accessibilityRole="button" onPress={onPress}>
        {children}
      </Pressable>
    );
  }

  function MockPolyline() {
    return <View />;
  }

  return {
    __esModule: true,
    default: MockMapView,
    Marker: MockMarker,
    Polyline: MockPolyline,
  };
});

jest.mock('react-native-reanimated', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  const sharedValue = <T,>(initial: T) => {
    let current = initial;
    return {
      get value() {
        return current;
      },
      set value(next: T) {
        current = next;
      },
      get: () => current,
      set: (next: T) => {
        current = next;
      },
    };
  };
  return {
    __esModule: true,
    default: { View },
    Easing: { out: (fn: unknown) => fn, ease: (v: number) => v },
    useSharedValue: sharedValue,
    useAnimatedStyle: (factory: () => object) => factory(),
    withTiming: <T,>(value: T) => value,
    withRepeat: <T,>(value: T) => value,
  };
});
jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'fr', languageTag: 'fr-CA' }],
}));
jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    getItemAsync: async (key: string) => store.get(key) ?? null,
    setItemAsync: async (key: string, value: string) => void store.set(key, value),
    deleteItemAsync: async (key: string) => void store.delete(key),
  };
});
jest.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({
    status: 'signedIn',
    isAuthenticated: true,
    user: { id: 'u1', username: 'camille_mtl', email: 'camille@montreal.ca' },
    signIn: jest.fn(),
    signOut: mockSignOut,
  }),
}));

const issues = TEST_ISSUES;
const districts = TEST_DISTRICTS;

async function renderCardScreen() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  const utils = await render(
    <QueryClientProvider client={queryClient}>
      <CardScreen />
    </QueryClientProvider>,
  );
  await screen.findByText('Blocked bike lane on Rue Rachel Est');
  return utils;
}

describe('map-utils', () => {
  it('provides valid Montreal default region, borough regions, and REV GPS corridors', () => {
    expect(MONTREAL_DEFAULT_REGION.latitude).toBeCloseTo(45.5265, 3);
    expect(BOROUGH_REGIONS['le-plateau-mont-royal']).toBeDefined();
    expect(REV_CORRIDORS.length).toBeGreaterThanOrEqual(2);
    for (const corridor of REV_CORRIDORS) {
      expect(corridor.coordinates.length).toBeGreaterThanOrEqual(4);
    }
  });

  it('normalizes camelCase API issues and districts into frontend models', () => {
    const normalizedIssue = normalizeIssue({
      id: 'abc123',
      title: 'Ice on sidewalk',
      description: 'Slippery corner',
      category: 'snow_ice',
      status: 'completed',
      images: [],
      address: '100 Rue Saint-Denis',
      latitude: 45.52,
      longitude: -73.57,
      districtId: 'd1',
      createdById: 'p1',
      updatedById: null,
      upvoteCount: 7,
      resolutionConfirmations: 2,
      external311Ref: 'MTL-311-999',
      createdAt: '2026-11-21T10:00:00.000Z',
      updatedAt: '2026-11-21T11:00:00.000Z',
    });
    expect(normalizedIssue.district_id).toBe('d1');
    expect(normalizedIssue.upvote_count).toBe(7);
    expect(normalizedIssue.resolution_confirmations).toBe(2);
    expect(normalizedIssue.external_311_ref).toBe('MTL-311-999');
    expect(normalizedIssue.status).toBe('resolved');
    expect(normalizedIssue.category).toBe('roads_potholes');

    const normalizedDistrict = normalizeDistrict({
      id: 'd1',
      nameFr: 'Le Plateau-Mont-Royal',
      nameEn: 'Le Plateau-Mont-Royal',
      openNorthSlug: 'le-plateau-mont-royal',
      districtType: 'borough',
      managerId: null,
      isClaimed: false,
      createdAt: '2026-10-01T10:00:00.000Z',
    });
    expect(normalizedDistrict.name_fr).toBe('Le Plateau-Mont-Royal');
    expect(normalizedDistrict.open_north_slug).toBe('le-plateau-mont-royal');
  });

  it('filters issues by search query (#311, accents, borough name), category, status, and district', () => {
    expect(
      filterMapIssues(
        issues,
        { query: 'Rachel', category: 'all', status: 'all', districtId: 'all' },
        districts,
      ),
    ).toHaveLength(1);

    // Leading # works for #311 references
    expect(
      filterMapIssues(
        issues,
        { query: '#311', category: 'all', status: 'all', districtId: 'all' },
        districts,
      ),
    ).toHaveLength(2);

    // Accent-insensitive matching ("Montreal" matches "Montréal")
    expect(
      filterMapIssues(
        issues,
        { query: 'Montreal', category: 'all', status: 'all', districtId: 'all' },
        districts,
      ),
    ).toHaveLength(4); // the Westmount report's address has no "Montréal"

    // Borough name search
    expect(
      filterMapIssues(
        issues,
        { query: 'Rosemont', category: 'all', status: 'all', districtId: 'all' },
        districts,
      )[0]?.id,
    ).toBe(issues[2].id);

    expect(
      filterMapIssues(
        issues,
        { query: '', category: 'roads_potholes', status: 'not_started', districtId: 'all' },
        districts,
      ),
    ).toHaveLength(2);
  });

  it('computes accurate category counts', () => {
    expect(getCategoryCounts(issues)).toEqual({
      all: 5,
      traffic_safety: 1,
      roads_potholes: 2,
      streetlights_utilities: 2,
    });
  });

  it('resolves district names, short street labels, region zoom clamping, and layer cycles', () => {
    expect(getDistrictName(districts[0].id, districts, 'fr')).toBe('Le Plateau-Mont-Royal');
    expect(getDistrictName('missing-id', districts, 'en')).toBeNull();
    expect(shortStreetLabel('1250 Rue Rachel Est, Montréal, QC H2J 2J9')).toBe(
      '1250 Rue Rachel Est',
    );
    expect(zoomRegion(MONTREAL_DEFAULT_REGION, 0.01).latitudeDelta).toBe(0.004);
    expect(zoomRegion(MONTREAL_DEFAULT_REGION, 20).latitudeDelta).toBe(0.24);
    expect(deltaToLeafletZoom(0.042)).toBeGreaterThanOrEqual(12);
    expect(nextLayerMode('standard')).toBe('works');
    expect(nextLayerMode('works')).toBe('contrast');
    expect(nextLayerMode('contrast')).toBe('standard');
  });
});

describe('CardScreen (Map page) — all interactive controls', () => {
  let restoreApi: (() => void) | undefined;

  beforeEach(async () => {
    restoreApi = installMockBackendApi({ currentUsername: 'camille_mtl' });
    mockAnimateToRegion.mockClear();
    mockSignOut.mockClear();
    await i18n.changeLanguage('fr');
  });

  afterEach(() => {
    restoreApi?.();
  });

  it('renders header, real map view, markers, and default selected incident preview in French', async () => {
    await renderCardScreen();

    expect(screen.getByText('CityPulse MTL')).toBeOnTheScreen();
    expect(screen.getByText('Tous les arrondissements ▾')).toBeOnTheScreen();
    expect(screen.getByTestId('montreal-map-canvas')).toBeOnTheScreen();
    expect(screen.getByTestId('map-preview-sheet')).toBeOnTheScreen();

    expect(screen.getByText('Blocked bike lane on Rue Rachel Est')).toBeOnTheScreen();
    expect(screen.getByText('#MTL-311-2026-88412')).toBeOnTheScreen();
    expect(screen.getByText('Équipe notifiée')).toBeOnTheScreen();
    expect(screen.getByText('Consulter le dossier')).toBeOnTheScreen();

    for (const issue of issues) {
      expect(screen.getByTestId(`map-pin-${issue.id}`)).toBeOnTheScreen();
    }
  });

  it('supports search bar typing (#311, borough), clear button, and empty-state reset', async () => {
    await renderCardScreen();

    // Search by #311 filters to the 2 issues with a 311 reference
    await fireEvent.changeText(screen.getByTestId('map-search-input'), '#311');
    expect(screen.getByTestId(`map-pin-${issues[0].id}`)).toBeOnTheScreen();
    expect(screen.getByTestId(`map-pin-${issues[1].id}`)).toBeOnTheScreen();
    expect(screen.queryByTestId(`map-pin-${issues[2].id}`)).toBeNull();

    // Clear button resets query and restores all pins
    await fireEvent.press(screen.getByTestId('map-search-clear'));
    expect(screen.getByTestId(`map-pin-${issues[2].id}`)).toBeOnTheScreen();

    // Unmatched search shows empty sheet & reset restores everything
    await fireEvent.changeText(screen.getByTestId('map-search-input'), 'nonexistent-street-xyz');
    expect(screen.getByTestId('map-empty-sheet')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('map-reset-filters-button'));
    expect(screen.getByTestId(`map-pin-${issues[0].id}`)).toBeOnTheScreen();
  });

  it('supports category filter chips and advanced status filter bar', async () => {
    await renderCardScreen();

    // Category filter: Chaussée -> selects Beaubien pothole and pans map
    await fireEvent.press(screen.getByTestId('map-filter-roads_potholes'));
    expect(screen.getByText('Deep pothole near Beaubien and Saint-Denis')).toBeOnTheScreen();
    expect(screen.queryByTestId(`map-pin-${issues[0].id}`)).toBeNull();
    expect(mockAnimateToRegion).toHaveBeenCalledWith(
      expect.objectContaining({
        latitude: issues[2].latitude,
        longitude: issues[2].longitude,
      }),
      320,
    );

    // Back to All categories
    await fireEvent.press(screen.getByTestId('map-filter-all'));
    expect(screen.getByTestId(`map-pin-${issues[0].id}`)).toBeOnTheScreen();

    // Open advanced status filter row via tune button
    await fireEvent.press(screen.getByTestId('map-advanced-filter-button'));
    expect(screen.getByTestId('map-status-not_started')).toBeOnTheScreen();
    expect(screen.getByTestId('map-status-in_progress')).toBeOnTheScreen();
    expect(screen.getByTestId('map-status-resolved')).toBeOnTheScreen();

    // Filter to resolved (0 dummy issues resolved -> empty sheet)
    await fireEvent.press(screen.getByTestId('map-status-resolved'));
    expect(screen.getByTestId('map-empty-sheet')).toBeOnTheScreen();

    // Switch to all statuses -> pins return
    await fireEvent.press(screen.getByTestId('map-status-all'));
    expect(screen.getByTestId(`map-pin-${issues[0].id}`)).toBeOnTheScreen();
  });

  it('filters by borough via the header selector modal and updates the header label', async () => {
    await renderCardScreen();

    await fireEvent.press(screen.getByTestId('map-borough-selector'));
    await fireEvent.press(screen.getByTestId('map-borough-option-ville-marie'));

    expect(screen.getByText('Ville-Marie ▾')).toBeOnTheScreen();
    expect(screen.getByText('Out-of-service station elevator near Berri-UQAM')).toBeOnTheScreen();
    expect(screen.queryByTestId(`map-pin-${issues[0].id}`)).toBeNull();
    expect(mockAnimateToRegion).toHaveBeenCalled();

    // Switch back to all boroughs
    await fireEvent.press(screen.getByTestId('map-borough-selector'));
    await fireEvent.press(screen.getByTestId('map-borough-option-all'));
    expect(screen.getByText('Tous les arrondissements ▾')).toBeOnTheScreen();
  });

  it('animates the map and switches preview sheet when tapping another marker', async () => {
    await renderCardScreen();

    await fireEvent.press(screen.getByTestId(`map-pin-${issues[1].id}`));
    expect(screen.getByText('Out-of-service station elevator near Berri-UQAM')).toBeOnTheScreen();
    expect(screen.getByText('#MTL-311-2026-89004')).toBeOnTheScreen();
    expect(mockAnimateToRegion).toHaveBeenCalledWith(
      expect.objectContaining({
        latitude: issues[1].latitude,
        longitude: issues[1].longitude,
      }),
      320,
    );
  });

  it('handles zoom in/out, recenter, and all 3 map layers', async () => {
    await renderCardScreen();

    await fireEvent.press(screen.getByTestId('map-zoom-in-button'));
    expect(mockAnimateToRegion).toHaveBeenCalledTimes(1);

    await fireEvent.press(screen.getByTestId('map-zoom-out-button'));
    expect(mockAnimateToRegion).toHaveBeenCalledTimes(2);

    await fireEvent.press(screen.getByTestId('map-recenter-button'));
    expect(mockAnimateToRegion).toHaveBeenCalledTimes(3);

    // Cycle layers: standard -> works -> contrast -> standard
    await fireEvent.press(screen.getByTestId('map-layers-button'));
    expect(screen.getByText('Travaux & REV')).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('map-layers-button'));
    expect(screen.getByText('Contraste')).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('map-layers-button'));
    expect(screen.queryByText('Contraste')).toBeNull();
  });

  it('handles preview sheet collapse, upvote, share, detail modal, and profile sign-out', async () => {
    const shareSpy = jest
      .spyOn(Share, 'share')
      .mockResolvedValue({ action: Share.sharedAction } as never);

    await renderCardScreen();

    // Collapse & expand preview sheet via drag handle
    expect(screen.getByText(/Inspection team notified/i)).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('map-sheet-handle'));
    expect(screen.queryByText(/Inspection team notified/i)).toBeNull();
    await fireEvent.press(screen.getByTestId('map-sheet-handle'));
    expect(screen.getByText(/Inspection team notified/i)).toBeOnTheScreen();

    // Upvote toggle (2 -> 3)
    const upvoteBtn = screen.getByTestId('map-preview-upvote');
    expect(within(upvoteBtn).getByText('2')).toBeOnTheScreen();
    await fireEvent.press(upvoteBtn);
    expect(await within(upvoteBtn).findByText('3')).toBeOnTheScreen();

    // Share button invokes Share.share with title & address
    await fireEvent.press(screen.getByTestId('map-preview-share'));
    expect(shareSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        title: issues[0].title,
        message: expect.stringContaining('1250 Rue Rachel Est'),
      }),
    );

    // Open full record modal via primary button & confirm resolution inside modal
    await fireEvent.press(screen.getByTestId('map-preview-view-record'));
    expect(screen.getByTestId('map-detail-modal')).toBeOnTheScreen();
    expect(screen.getByText('@marc_velo')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('issue-confirm-button'));
    expect(await screen.findByText('2 confirmés')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('map-detail-modal-close'));

    // Profile avatar -> the same profile page as every other tab -> Sign out button
    await fireEvent.press(screen.getByTestId('map-profile-button'));
    expect(screen.getByRole('header', { name: 'Profil' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByText('Se déconnecter'));
    expect(mockSignOut).toHaveBeenCalledTimes(1);

    shareSpy.mockRestore();
  });

  it('switches language from the profile page, not the header', async () => {
    await renderCardScreen();
    expect(screen.queryByTestId('map-lang-en')).toBeNull();
    expect(screen.queryByTestId('map-lang-fr')).toBeNull();

    await fireEvent.press(screen.getByTestId('map-profile-button'));
    await fireEvent.press(screen.getByRole('button', { name: 'Anglais' }));
    expect(screen.getByText('View record')).toBeOnTheScreen();
    expect(screen.getByText('All boroughs ▾')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'French' }));
    expect(screen.getByText('Consulter le dossier')).toBeOnTheScreen();
  });
});

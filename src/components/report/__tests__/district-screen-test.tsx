import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  act,
  fireEvent,
  render as rtlRender,
  screen,
  waitFor,
  within,
} from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Alert, Linking } from 'react-native';

import { ProfilePanelProvider } from '@/components/layout/profile-panel';
import { DistrictScreen } from '@/components/report/DistrictScreen';
import { setLanguage } from '@/i18n';
import { fetchIssues } from '@/lib/api/issues';
import { fetchMyProfile } from '@/lib/api/profile';
import type { AuthUser } from '@/lib/auth/auth-api';

import { installMockBackendApi, TEST_ISSUES } from '../../../../test/fixtures';

const mockNavigate = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ navigate: mockNavigate }),
}));

// The header's profile button reads the signed-in user and opens the profile sheet.
const mockUser: AuthUser = {
  id: '64b7f0c2a1b2c3d4e5f60719',
  username: 'camille_mtl',
  email: 'camille.tremblay@example.ca',
  postalCode: 'H2J1S4',
  homeDistrictId: null,
  role: 'resident',
  preferredLanguage: 'en',
};
jest.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ user: mockUser, isAuthenticated: true, signOut: async () => {} }),
}));

const mockRequestForegroundPermissions = jest.fn(async () => ({ status: 'denied' }));
const mockGetCurrentPosition = jest.fn();
const mockReverseGeocode = jest.fn();
const mockGeocode = jest.fn(async (_address: string): Promise<object[]> => []);
jest.mock('expo-location', () => ({
  geocodeAsync: (address: string) => mockGeocode(address),
  Accuracy: { Balanced: 3 },
  requestForegroundPermissionsAsync: () => mockRequestForegroundPermissions(),
  getCurrentPositionAsync: (opts?: unknown) => mockGetCurrentPosition(opts),
  reverseGeocodeAsync: (coords?: unknown) => mockReverseGeocode(coords),
}));

const mockRequestCameraPermissions = jest.fn(async () => ({ granted: true }));
const mockLaunchCamera = jest.fn();
const mockLaunchImageLibrary = jest.fn();
jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: () => mockRequestCameraPermissions(),
  launchCameraAsync: (opts?: unknown) => mockLaunchCamera(opts),
  launchImageLibraryAsync: (opts?: unknown) => mockLaunchImageLibrary(opts),
}));

const render = async (ui: React.ReactElement) => {
  // gcTime: Infinity schedules no cache-cleanup timer, which would keep Jest alive for 5 minutes.
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <ProfilePanelProvider>{children}</ProfilePanelProvider>
    </QueryClientProvider>
  );
  const utils = await rtlRender(ui, { wrapper });
  await screen.findByText('Le Plateau-Mont-Royal');
  return utils;
};

const fillRequiredFields = async () => {
  await fireEvent.press(screen.getByTestId('category-card-traffic_safety'));
  await fireEvent.changeText(
    screen.getByTestId('location-address-input'),
    '1250 Rue Rachel Est, Montréal, QC H2J 2J9',
  );
  await fireEvent.changeText(
    screen.getByTestId('report-title-input'),
    'Piste cyclable bloquée sur Rachel Est',
  );
  await fireEvent.changeText(
    screen.getByTestId('report-description-input'),
    'Clôtures de chantier obstruant la piste cyclable.',
  );
};

describe('DistrictScreen', () => {
  let restoreApi: (() => void) | undefined;

  beforeEach(async () => {
    mockNavigate.mockReset();
    mockRequestForegroundPermissions.mockReset();
    mockRequestForegroundPermissions.mockResolvedValue({ status: 'denied' });
    mockGetCurrentPosition.mockReset();
    mockReverseGeocode.mockReset();
    mockGeocode.mockReset();
    mockGeocode.mockResolvedValue([]);
    mockRequestCameraPermissions.mockReset();
    mockRequestCameraPermissions.mockResolvedValue({ granted: true });
    mockLaunchCamera.mockReset();
    mockLaunchImageLibrary.mockReset();
    restoreApi = installMockBackendApi({ currentUsername: mockUser.username });
    await setLanguage('fr');
  });

  afterEach(() => {
    restoreApi?.();
  });

  afterAll(async () => {
    await setLanguage('en');
  });

  it('renders all sections with empty initial fields and disabled publish button in French', async () => {
    const handleBack = jest.fn();
    const handleSubmit = jest.fn();

    await render(<DistrictScreen onBack={handleBack} onSubmitSuccess={handleSubmit} />);

    // 1. Navigation Header
    expect(screen.getByTestId('district-screen-profile-button')).toBeOnTheScreen();
    expect(screen.getByText('Municipalité')).toBeOnTheScreen();

    // Stepper header has been removed
    expect(screen.queryByText('• ÉTAPE 1 SUR 2')).toBeNull();
    expect(screen.queryByText('Détails & Localisation')).toBeNull();

    // 3. OpenNorth Pipeline & Borough Card
    expect(screen.getByText('OPENNORTH PIPELINE • En direct')).toBeOnTheScreen();
    expect(screen.getByText('Le Plateau-Mont-Royal')).toBeOnTheScreen();
    expect(screen.getByText('Secteur électoral H2J 1S4 • Arrondissement validé')).toBeOnTheScreen();
    expect(screen.getByTestId('tab-mon-arrondissement')).toBeOnTheScreen();
    expect(screen.getByTestId('tab-autre-arrondissement')).toBeOnTheScreen();

    // 4. Type d'incident civique (2x2 Grid)
    expect(screen.getByText("Type d'incident civique")).toBeOnTheScreen();
    expect(screen.getByText('Sécurité & Pistes cyclables')).toBeOnTheScreen();
    expect(screen.getByText('Nids-de-poule & Chaussée')).toBeOnTheScreen();
    expect(screen.getByText('Éclairage & Utilités')).toBeOnTheScreen();
    expect(screen.getByText('Parcs & Propreté')).toBeOnTheScreen();

    // 5. Localisation précise + Use current location button
    expect(screen.getByText('Localisation précise')).toBeOnTheScreen();
    expect(screen.getByText('ADRESSE DÉTECTÉE')).toBeOnTheScreen();
    expect(screen.getByTestId('location-address-input').props.value).toBe('');
    expect(screen.getByTestId('use-current-location-button')).toBeOnTheScreen();
    expect(screen.getByText('Utiliser ma position actuelle')).toBeOnTheScreen();
    expect(screen.getByTestId('map-adjust-pin-button')).toBeOnTheScreen();

    // 6 & 7. Empty title and description
    expect(screen.getByText('0/70')).toBeOnTheScreen();
    expect(screen.getByTestId('report-title-input').props.value).toBe('');
    expect(screen.getByTestId('report-description-input').props.value).toBe('');

    // 8. Proof section: first option is camera, second is gallery
    expect(screen.getByText('Photos justificatives (max. 3)')).toBeOnTheScreen();
    expect(screen.getByText('0 ajoutées')).toBeOnTheScreen();
    expect(screen.getByTestId('photo-slot-empty-1')).toBeOnTheScreen();
    expect(screen.getByText('Prendre photo')).toBeOnTheScreen();
    expect(screen.getByTestId('add-photo-button')).toBeOnTheScreen();
    expect(screen.getByText('Galerie')).toBeOnTheScreen();
    expect(screen.getByTestId('photo-slot-optional')).toBeOnTheScreen();

    // 9 & 10. Publish button starts disabled until all required fields are filled
    const publishBtn = screen.getByTestId('publish-report-button');
    expect(publishBtn).toBeDisabled();
  });

  it('has no back button: it is the top-level Report tab', async () => {
    await render(<DistrictScreen />);

    expect(screen.queryByTestId('district-screen-back-button')).toBeNull();
  });

  it('allows switching categories when tapping category cards', async () => {
    await render(<DistrictScreen />);

    expect(
      screen.getByTestId('category-card-traffic_safety').props.accessibilityState.selected,
    ).toBe(false);

    await fireEvent.press(screen.getByTestId('category-card-roads_potholes'));

    await waitFor(() => {
      expect(
        screen.getByTestId('category-card-roads_potholes').props.accessibilityState.selected,
      ).toBe(true);
    });
  });

  it('allows switching districts via modal when clicking Autre arrondissement', async () => {
    await render(<DistrictScreen />);

    await fireEvent.press(screen.getByTestId('tab-autre-arrondissement'));

    const modalTitle = await screen.findByText('Sélectionner un arrondissement');
    expect(modalTitle).toBeOnTheScreen();

    await fireEvent.press(
      screen.getByTestId('borough-option-11111111-1111-4111-8111-111111111102'),
    );

    await waitFor(() => {
      expect(screen.getByText('Ville-Marie')).toBeOnTheScreen();
      expect(screen.getByText(/Secteur électoral H2L 2C9/)).toBeOnTheScreen();
    });
  });

  it('lists every Montréal borough in the picker, searchable, including ones the app did not know', async () => {
    await render(<DistrictScreen />);

    await fireEvent.press(screen.getByTestId('tab-autre-arrondissement'));
    await screen.findByText('Sélectionner un arrondissement');

    // Verdun comes from the server's OpenNorth borough list, not from the districts created before.
    const verdun = await screen.findByTestId('borough-option-11111111-1111-4111-8111-111111111199');
    expect(screen.getByText('5 arrondissements')).toBeOnTheScreen();
    // No postal code is known for Verdun, so the Plateau fallback is not shown as its own.
    expect(within(verdun).getByText('Arrondissement validé')).toBeOnTheScreen();
    expect(within(verdun).queryByText(/Secteur/)).toBeNull();

    await fireEvent.changeText(screen.getByTestId('borough-search-input'), 'verd');
    expect(screen.getByText('1 arrondissement')).toBeOnTheScreen();
    expect(screen.queryByTestId('borough-option-11111111-1111-4111-8111-111111111102')).toBeNull();

    await fireEvent.press(
      screen.getByTestId('borough-option-11111111-1111-4111-8111-111111111199'),
    );
    await waitFor(() => expect(screen.getByText('Verdun')).toBeOnTheScreen());
  });

  it('opens the phone camera on the first proof option and gallery on the second option', async () => {
    mockLaunchCamera.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///camera-shot-1.jpg' }],
    });
    mockLaunchImageLibrary.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///gallery-pick-1.jpg' }],
    });

    await render(<DistrictScreen />);

    // First option opens the camera
    await fireEvent.press(screen.getByTestId('photo-slot-empty-1'));
    await waitFor(() => {
      expect(mockRequestCameraPermissions).toHaveBeenCalledTimes(1);
      expect(mockLaunchCamera).toHaveBeenCalledTimes(1);
      expect(mockLaunchImageLibrary).not.toHaveBeenCalled();
    });
    expect(await screen.findByText('1 ajoutée')).toBeOnTheScreen();

    // Remove photo so both slots are empty again, then test the second option (gallery)
    await fireEvent.press(screen.getByTestId('remove-photo-0-button'));
    expect(await screen.findByText('0 ajoutées')).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('add-photo-button'));
    await waitFor(() => {
      expect(mockLaunchImageLibrary).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByText('1 ajoutée')).toBeOnTheScreen();

    // With 1 photo attached, the first remaining option (slot 2) opens camera and slot 3 opens gallery
    await fireEvent.press(screen.getByTestId('add-photo-button'));
    await waitFor(() => {
      expect(mockLaunchCamera).toHaveBeenCalledTimes(2);
    });
    expect(await screen.findByText('2 ajoutées')).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('photo-slot-optional'));
    await waitFor(() => {
      expect(mockLaunchImageLibrary).toHaveBeenCalledTimes(2);
    });
    expect(await screen.findByText('3 ajoutées')).toBeOnTheScreen();
  });

  it('uses the current location button to populate coordinates, address, and district', async () => {
    await render(<DistrictScreen />);

    // Grant location permission when the user explicitly taps the button
    mockRequestForegroundPermissions.mockResolvedValue({ status: 'granted' });
    mockGetCurrentPosition.mockResolvedValue({
      coords: { latitude: 45.515218, longitude: -73.560412 },
    });
    mockReverseGeocode.mockResolvedValue([
      {
        streetNumber: '505',
        street: 'Rue Sainte-Catherine Est',
        city: 'Montréal',
        region: 'QC',
        postalCode: 'H2L 2C9',
        district: 'Ville-Marie',
      },
    ]);

    await fireEvent.press(screen.getByTestId('use-current-location-button'));

    expect(await screen.findByText('Ville-Marie')).toBeOnTheScreen();
    expect(screen.getByTestId('location-address-input').props.value).toBe(
      '505 Rue Sainte-Catherine Est, Montréal, QC H2L 2C9',
    );
    expect(screen.getByText(/45.515218, -73.560412 • Ville-Marie/)).toBeOnTheScreen();
  });

  it('disables the publish button until all required fields are filled', async () => {
    await render(<DistrictScreen />);

    const publishBtn = screen.getByTestId('publish-report-button');
    expect(publishBtn).toBeDisabled();

    // Only category
    await fireEvent.press(screen.getByTestId('category-card-roads_potholes'));
    expect(screen.getByTestId('publish-report-button')).toBeDisabled();

    // Add address
    await fireEvent.changeText(screen.getByTestId('location-address-input'), '100 Rue Saint-Denis');
    expect(screen.getByTestId('publish-report-button')).toBeDisabled();

    // Add title (still missing description)
    await fireEvent.changeText(screen.getByTestId('report-title-input'), 'Nid-de-poule dangereux');
    expect(screen.getByTestId('publish-report-button')).toBeDisabled();
    expect(screen.getByText('22/70')).toBeOnTheScreen();

    // Add description -> now all required fields are filled!
    await fireEvent.changeText(
      screen.getByTestId('report-description-input'),
      'Grand nid-de-poule dans la voie de droite.',
    );
    expect(screen.getByTestId('publish-report-button')).not.toBeDisabled();
  });

  it('toggles 311 switch on press', async () => {
    await render(<DistrictScreen />);

    const switchComponent = screen.getByTestId('mtl-311-switch');
    expect(switchComponent.props.value).toBe(true);

    await fireEvent(switchComponent, 'valueChange', false);

    await waitFor(() => {
      expect(screen.getByTestId('mtl-311-switch').props.value).toBe(false);
    });
  });

  it('saves draft and shows toast feedback', async () => {
    await render(<DistrictScreen />);

    await fireEvent.press(screen.getByTestId('save-draft-button'));
    expect(await screen.findByText('Brouillon enregistré avec succès.')).toBeOnTheScreen();
  });

  describe('send to 311', () => {
    const publish = async () => {
      await render(<DistrictScreen />);
      await screen.findByTestId(`report-map-issue-${TEST_ISSUES[0].id}`);
      await fillRequiredFields();
    };
    const pressPublish = async () => {
      await fireEvent.press(screen.getByTestId('publish-report-button'));
      await fireEvent.press(await screen.findByTestId('duplicate-publish-anyway-button'));
    };

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('offers to email 311 after publishing, with the report filled in, and no fake ticket', async () => {
      const alert = jest.spyOn(Alert, 'alert');
      const openUrl = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
      await publish();
      expect(screen.getByTestId('mtl-311-switch').props.value).toBe(true);
      await pressPublish();

      await waitFor(() =>
        expect(alert).toHaveBeenCalledWith(
          'Envoyer ce signalement au 311 ?',
          expect.stringContaining('votre application de courriel'),
          expect.any(Array),
        ),
      );
      const buttons = alert.mock.calls[0][2] as { text: string; onPress?: () => void }[];
      expect(buttons.map((b) => b.text)).toEqual([
        'Plus tard',
        'Appeler le 311',
        'Courriel au 311',
      ]);

      await act(async () => {
        buttons.find((b) => b.text === 'Courriel au 311')?.onPress?.();
      });
      const url = decodeURIComponent(openUrl.mock.calls[0][0]);
      expect(url).toMatch(/^mailto:\?subject=\[MonTone #[A-Z0-9]{6}\] /);
      expect(url).toContain('Adresse : 1250 Rue Rachel Est, Montréal, QC H2J 2J9');
      expect(url).toContain('Envoyé avec MonTone.');
      expect(url).not.toContain('MTL-311');
    });

    it('calls 311 from the same prompt', async () => {
      const alert = jest.spyOn(Alert, 'alert');
      const openUrl = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
      await publish();
      await pressPublish();
      await waitFor(() => expect(alert).toHaveBeenCalled());
      const buttons = alert.mock.calls[0][2] as { text: string; onPress?: () => void }[];
      await act(async () => {
        buttons.find((b) => b.text === 'Appeler le 311')?.onPress?.();
      });
      expect(openUrl).toHaveBeenCalledWith('tel:5148720311');
    });

    it('does not prompt when 311 is switched off', async () => {
      const alert = jest.spyOn(Alert, 'alert');
      await publish();
      await fireEvent(screen.getByTestId('mtl-311-switch'), 'valueChange', false);
      await pressPublish();
      await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/'));
      expect(alert).not.toHaveBeenCalled();
    });
  });

  it('creates the issue, resets all fields to empty, and switches to the Issues tab', async () => {
    const handleSubmit = jest.fn();
    await render(<DistrictScreen onSubmitSuccess={handleSubmit} />);
    await screen.findByTestId(`report-map-issue-${TEST_ISSUES[0].id}`);

    await fillRequiredFields();
    await fireEvent.press(screen.getByTestId('weather-element-chip-snow_ice'));
    await fireEvent.press(screen.getByTestId('weather-element-chip-high_wind'));
    expect(
      screen.getByTestId('weather-element-chip-snow_ice').props.accessibilityState.selected,
    ).toBe(true);
    expect(screen.getByTestId('publish-report-button')).not.toBeDisabled();

    await fireEvent.press(screen.getByTestId('publish-report-button'));
    // The default point is on top of an open issue, so the resident is asked first.
    await fireEvent.press(await screen.findByTestId('duplicate-publish-anyway-button'));

    await waitFor(() => {
      expect(handleSubmit).toHaveBeenCalledTimes(1);
    });
    expect(handleSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        elements: ['snow_ice', 'high_wind'],
      }),
    );

    // All fields reset to empty and publish button disabled again
    expect(screen.getByTestId('report-title-input').props.value).toBe('');
    expect(screen.getByTestId('report-description-input').props.value).toBe('');
    expect(screen.getByTestId('location-address-input').props.value).toBe('');
    expect(
      screen.getByTestId('category-card-traffic_safety').props.accessibilityState.selected,
    ).toBe(false);
    expect(
      screen.getByTestId('weather-element-chip-snow_ice').props.accessibilityState.selected,
    ).toBe(false);
    expect(
      screen.getByTestId('weather-element-chip-high_wind').props.accessibilityState.selected,
    ).toBe(false);
    expect(screen.getByText('0 ajoutées')).toBeOnTheScreen();
    expect(screen.getByTestId('publish-report-button')).toBeDisabled();

    // Switches to the Issues tab ('/')
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  describe('when an open issue of the same category is within 50 m of the report point', () => {
    const nearby = TEST_ISSUES[0]; // in progress, exactly at the default report point

    it('offers an upvote instead, and does not upvote twice', async () => {
      const handleSubmit = jest.fn();
      await render(<DistrictScreen onSubmitSuccess={handleSubmit} />);
      await screen.findByTestId(`report-map-issue-${nearby.id}`);
      await fillRequiredFields();

      await fireEvent.press(screen.getByTestId('publish-report-button'));
      expect(
        await screen.findByText(
          'Déjà signalé à 0 m - ajouter votre vote (+1) plutôt que de créer un doublon ?',
        ),
      ).toBeOnTheScreen();
      expect(screen.getByText(nearby.title)).toBeOnTheScreen();

      await fireEvent.press(screen.getByTestId('duplicate-upvote-button'));
      expect(
        await screen.findByText('Votre vote a été ajouté au signalement existant.'),
      ).toBeOnTheScreen();
      expect(handleSubmit).not.toHaveBeenCalled();
      expect(mockNavigate).not.toHaveBeenCalled();

      // The vote endpoint toggles: a second "upvote" must not remove the first.
      await fireEvent.press(screen.getByTestId('publish-report-button'));
      await fireEvent.press(await screen.findByTestId('duplicate-upvote-button'));
      expect(
        await screen.findByText('Vous avez déjà voté pour le signalement existant.'),
      ).toBeOnTheScreen();
      expect(handleSubmit).not.toHaveBeenCalled();
    });

    it('cancel publishes nothing', async () => {
      const handleSubmit = jest.fn();
      await render(<DistrictScreen onSubmitSuccess={handleSubmit} />);
      await screen.findByTestId(`report-map-issue-${nearby.id}`);
      await fillRequiredFields();

      await fireEvent.press(screen.getByTestId('publish-report-button'));
      await fireEvent.press(await screen.findByTestId('duplicate-cancel-button'));

      expect(screen.queryByTestId('duplicate-issue-prompt')).toBeNull();
      expect(handleSubmit).not.toHaveBeenCalled();
    });

    it('ignores it when the report is in another category', async () => {
      const handleSubmit = jest.fn();
      await render(<DistrictScreen onSubmitSuccess={handleSubmit} />);
      await screen.findByTestId(`report-map-issue-${nearby.id}`);
      await fillRequiredFields();

      await fireEvent.press(screen.getByTestId('category-card-roads_potholes'));
      await waitFor(() =>
        expect(
          screen.getByTestId('category-card-roads_potholes').props.accessibilityState.selected,
        ).toBe(true),
      );
      await fireEvent.press(screen.getByTestId('publish-report-button'));

      await waitFor(() => {
        expect(handleSubmit).toHaveBeenCalledTimes(1);
      });
      expect(mockNavigate).toHaveBeenCalledWith('/');
      expect(screen.queryByTestId('duplicate-issue-prompt')).toBeNull();
    });

    it('does not prompt district managers', async () => {
      mockUser.role = 'district_manager';
      try {
        const handleSubmit = jest.fn();
        await render(<DistrictScreen onSubmitSuccess={handleSubmit} />);
        await screen.findByTestId(`report-map-issue-${nearby.id}`);
        await fillRequiredFields();

        await fireEvent.press(screen.getByTestId('publish-report-button'));

        await waitFor(() => {
          expect(handleSubmit).toHaveBeenCalledTimes(1);
        });
        expect(mockNavigate).toHaveBeenCalledWith('/');
        expect(screen.queryByTestId('duplicate-issue-prompt')).toBeNull();
      } finally {
        mockUser.role = 'resident';
      }
    });
  });

  it('supports English locale when switched', async () => {
    await setLanguage('en');
    await render(<DistrictScreen />);

    expect(screen.getByText('District')).toBeOnTheScreen();
    expect(screen.queryByText('• STEP 1 OF 2')).toBeNull();
    expect(screen.queryByText('Details & Location')).toBeNull();
    expect(screen.getByText('My borough')).toBeOnTheScreen();
    expect(screen.getByText('Other borough')).toBeOnTheScreen();
    expect(screen.getByText('Safety & Bike paths')).toBeOnTheScreen();
    expect(screen.getByText('Use my current location')).toBeOnTheScreen();
    expect(screen.getByText('Take photo')).toBeOnTheScreen();
    expect(screen.getByText('Gallery')).toBeOnTheScreen();
  });

  it("opens the signed-in user's profile from the header", async () => {
    await render(<DistrictScreen />);

    await fireEvent.press(screen.getByTestId('district-screen-profile-button'));

    expect(screen.getByRole('header', { name: 'Profil' })).toBeOnTheScreen();
  });

  it('places the report pin from the map: address and borough follow the pin', async () => {
    mockReverseGeocode.mockResolvedValue([
      {
        streetNumber: '2600',
        street: 'Rue Masson',
        city: 'Montréal',
        region: 'QC',
        postalCode: 'H1Y 1W1',
        district: 'Rosemont',
      },
    ]);
    await render(<DistrictScreen />);

    await fireEvent.press(screen.getByTestId('map-adjust-pin-button'));
    expect(screen.getByTestId('map-pin-hint')).toBeOnTheScreen();
    expect(screen.getByText("Déplacez la carte pour placer l'épingle")).toBeOnTheScreen();
    expect(screen.getByText('Terminé')).toBeOnTheScreen();

    await fireEvent(screen.getByTestId('report-location-map'), 'press', {
      nativeEvent: { coordinate: { latitude: 45.5463121, longitude: -73.5774209 } },
    });

    await waitFor(() =>
      expect(screen.getByTestId('location-address-input').props.value).toBe(
        '2600 Rue Masson, Montréal, QC H1Y 1W1',
      ),
    );
    expect(screen.getByText(/45.546312, -73.577421/)).toBeOnTheScreen();
    expect(mockReverseGeocode).toHaveBeenCalledWith({ latitude: 45.546312, longitude: -73.577421 });
    // The borough follows the pin (OpenNorth lookup for the new point).
    expect(await screen.findByText('Rosemont–La Petite-Patrie')).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('map-adjust-pin-button'));
    expect(screen.queryByTestId('map-pin-hint')).toBeNull();
  });

  it('places the pin far from the user by panning the map under the fixed pin', async () => {
    mockReverseGeocode.mockResolvedValue([
      {
        streetNumber: '2600',
        street: 'Rue Masson',
        city: 'Montréal',
        region: 'QC',
        postalCode: 'H1Y 1W1',
        district: 'Rosemont',
      },
    ]);
    await render(<DistrictScreen />);

    await fireEvent.press(screen.getByTestId('map-adjust-pin-button'));
    // The form doesn't scroll while pinning, so drags move the map.
    expect(screen.getByTestId('report-map-center-pin')).toBeOnTheScreen();
    await fireEvent(screen.getByTestId('report-location-map'), 'regionChangeComplete', {
      latitude: 45.5463121,
      longitude: -73.5774209,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    });

    await waitFor(() =>
      expect(screen.getByTestId('location-address-input').props.value).toBe(
        '2600 Rue Masson, Montréal, QC H1Y 1W1',
      ),
    );
    expect(await screen.findByText('Rosemont–La Petite-Patrie')).toBeOnTheScreen();
  });

  it('searches a typed address and moves the report point there', async () => {
    mockReverseGeocode.mockResolvedValue([
      {
        streetNumber: '2600',
        street: 'Rue Masson',
        city: 'Montréal',
        region: 'QC',
        postalCode: 'H1Y 1W1',
        district: 'Rosemont',
      },
    ]);
    mockGeocode.mockResolvedValue([{ latitude: 45.5463121, longitude: -73.5774209 }]);
    await render(<DistrictScreen />);

    await fireEvent.changeText(screen.getByTestId('location-address-input'), '2600 rue Masson');
    await fireEvent.press(screen.getByTestId('address-search-button'));

    // Without a city, the address is looked up in Montréal.
    expect(mockGeocode).toHaveBeenCalledWith('2600 rue Masson, Montréal, QC');
    await waitFor(() =>
      expect(screen.getByTestId('location-address-input').props.value).toBe(
        '2600 Rue Masson, Montréal, QC H1Y 1W1',
      ),
    );
    expect(screen.getByText(/45.546312, -73.577421/)).toBeOnTheScreen();
    expect(await screen.findByText('Rosemont–La Petite-Patrie')).toBeOnTheScreen();
  });

  it('says so when a typed address is not found, and keeps the point', async () => {
    await render(<DistrictScreen />);
    const pointText = () => screen.getByText(/^-?\d+\.\d+, -?\d+\.\d+ •/).props.children;
    const before = pointText();

    await fireEvent.changeText(screen.getByTestId('location-address-input'), 'nowhere street');
    await fireEvent(screen.getByTestId('location-address-input'), 'submitEditing');

    expect(
      await screen.findByText("Adresse introuvable. Essayez de placer l'épingle sur la carte."),
    ).toBeOnTheScreen();
    expect(pointText()).toBe(before);
  });

  it('does not let the GPS lookup at open move a pin the user already placed', async () => {
    let resolvePosition: (value: object) => void = () => {};
    mockRequestForegroundPermissions.mockResolvedValue({ status: 'granted' });
    mockGetCurrentPosition.mockReturnValue(
      new Promise((resolve) => {
        resolvePosition = resolve;
      }),
    );
    mockReverseGeocode.mockResolvedValue([
      {
        streetNumber: '2600',
        street: 'Rue Masson',
        city: 'Montréal',
        region: 'QC',
        postalCode: 'H1Y 1W1',
        district: 'Rosemont',
      },
    ]);
    await render(<DistrictScreen />);

    await fireEvent.press(screen.getByTestId('map-adjust-pin-button'));
    await fireEvent(screen.getByTestId('report-location-map'), 'press', {
      nativeEvent: { coordinate: { latitude: 45.5463121, longitude: -73.5774209 } },
    });
    await waitFor(() => expect(screen.getByText(/45.546312, -73.577421/)).toBeOnTheScreen());

    // GPS answers late, with the user's own position downtown.
    await act(async () => {
      resolvePosition({ coords: { latitude: 45.515218, longitude: -73.560412 } });
    });

    expect(screen.getByText(/45.546312, -73.577421/)).toBeOnTheScreen();
    expect(screen.queryByText(/45.515218/)).toBeNull();
  });

  it('auto-detects the borough via device GPS and OpenNorth API', async () => {
    mockRequestForegroundPermissions.mockResolvedValue({ status: 'granted' });
    mockGetCurrentPosition.mockResolvedValue({
      coords: { latitude: 45.515218, longitude: -73.560412 },
    });
    mockReverseGeocode.mockResolvedValue([
      {
        streetNumber: '505',
        street: 'Rue Sainte-Catherine Est',
        city: 'Montréal',
        region: 'QC',
        postalCode: 'H2L 2C9',
        district: 'Ville-Marie',
      },
    ]);

    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    await rtlRender(
      <QueryClientProvider client={client}>
        <DistrictScreen />
      </QueryClientProvider>,
    );

    expect(await screen.findByText('Ville-Marie')).toBeOnTheScreen();
    expect(screen.getByTestId('location-address-input').props.value).toBe(
      '505 Rue Sainte-Catherine Est, Montréal, QC H2L 2C9',
    );
    expect(screen.getByText(/45.515218, -73.560412 • Ville-Marie/)).toBeOnTheScreen();
  });

  it('fills the description from the submitted photo in French when app language is French', async () => {
    mockLaunchImageLibrary.mockResolvedValue({
      canceled: false,
      assets: [
        {
          uri: 'file:///pothole.jpg',
          base64: '/9j/4AAQSkZJRg==',
          mimeType: 'image/jpeg',
          fileName: 'pothole.jpg',
        },
      ],
    });

    await render(<DistrictScreen />);

    // Disabled until at least one photo is attached.
    expect(screen.getByTestId('ai-generate-description-button')).toBeDisabled();

    await fireEvent.press(screen.getByTestId('add-photo-button'));
    expect(await screen.findByText('1 ajoutée')).toBeOnTheScreen();
    expect(screen.getByTestId('ai-generate-description-button')).not.toBeDisabled();

    await fireEvent.press(screen.getByTestId('ai-generate-description-button'));

    await waitFor(() => {
      expect(screen.getByTestId('report-description-input').props.value).toBe(
        'Un nid-de-poule profond et de l’asphalte fissuré endommagent la chaussée, posant un risque pour les cyclistes et les véhicules.',
      );
    });
    expect(screen.getByText('Description remplie à partir de votre photo.')).toBeOnTheScreen();
  });

  it('fills the description in English when app language is switched to English', async () => {
    await setLanguage('en');
    mockLaunchCamera.mockResolvedValue({
      canceled: false,
      assets: [
        {
          uri: 'file:///sidewalk.png',
          base64: 'iVBORw0KGgo=',
          mimeType: 'image/png',
          fileName: 'sidewalk.png',
        },
      ],
    });

    await render(<DistrictScreen />);

    await fireEvent.press(screen.getByTestId('photo-slot-empty-1'));
    expect(await screen.findByText('1 added')).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('ai-generate-description-button'));

    await waitFor(() => {
      expect(screen.getByTestId('report-description-input').props.value).toBe(
        'A deep pothole and cracked asphalt are damaging the roadway, creating a hazard for cyclists and vehicles.',
      );
    });
    expect(screen.getByText('Description filled from your photo.')).toBeOnTheScreen();
  });

  it('refetches all issue and personal profile React Query caches when a new issue is published', async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity, staleTime: 30_000 } },
    });
    // Pre-populate both the global issues query and an inactive personal profile query,
    // mimicking the closed Profile drawer before a new report is submitted.
    await client.fetchQuery({
      queryKey: ['issues'],
      queryFn: fetchIssues,
    });
    await client.fetchQuery({
      queryKey: ['profile', 'me', mockUser.id],
      queryFn: fetchMyProfile,
    });
    const invalidateSpy = jest.spyOn(client, 'invalidateQueries');

    const handleSubmit = jest.fn();
    await rtlRender(
      <QueryClientProvider client={client}>
        <ProfilePanelProvider>
          <DistrictScreen onSubmitSuccess={handleSubmit} />
        </ProfilePanelProvider>
      </QueryClientProvider>,
    );
    await screen.findByText('Le Plateau-Mont-Royal');

    await fireEvent.press(screen.getByTestId('category-card-roads_potholes'));
    await fireEvent.changeText(
      screen.getByTestId('location-address-input'),
      '1250 Rue Rachel Est, Montréal, QC H2J 2J9',
    );
    await fireEvent.changeText(
      screen.getByTestId('report-title-input'),
      'Fresh React Query report',
    );
    await fireEvent.changeText(
      screen.getByTestId('report-description-input'),
      'Deep pothole reported to verify React Query refetch across all pages.',
    );
    await fireEvent.press(screen.getByTestId('publish-report-button'));

    await waitFor(() => {
      expect(handleSubmit).toHaveBeenCalledTimes(1);
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['issues'], refetchType: 'all' });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['profile', 'me'], refetchType: 'all' });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['districts'], refetchType: 'all' });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['votes', 'me'], refetchType: 'all' });

    const cachedIssues = client.getQueryData<typeof TEST_ISSUES>(['issues']);
    expect(cachedIssues?.some((i) => i.title === 'Fresh React Query report')).toBe(true);

    const cachedProfile = client.getQueryData<{ issues: typeof TEST_ISSUES }>([
      'profile',
      'me',
      mockUser.id,
    ]);
    expect(cachedProfile?.issues.some((i) => i.title === 'Fresh React Query report')).toBe(true);
  });
});

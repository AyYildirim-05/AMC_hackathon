import { setLanguage } from '@/i18n';
import { fireEvent, render as rtlRender, screen, waitFor } from '@testing-library/react-native';

import { installMockBackendApi } from '../../../../test/fixtures';

import { DistrictScreen } from '@/components/report/DistrictScreen';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import type { AuthUser } from '@/lib/auth/auth-api';

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

const render = async (ui: React.ReactElement) => {
  // gcTime: Infinity schedules no cache-cleanup timer, which would keep Jest alive for 5 minutes.
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const utils = await rtlRender(ui, { wrapper });
  await screen.findByText('Le Plateau-Mont-Royal');
  return utils;
};

describe('DistrictScreen', () => {
  let restoreApi: (() => void) | undefined;

  beforeEach(async () => {
    restoreApi = installMockBackendApi({ currentUsername: mockUser.username });
    await setLanguage('fr');
  });

  afterEach(() => {
    restoreApi?.();
  });

  afterAll(async () => {
    await setLanguage('en');
  });

  it('renders all sections and details matching screen 2.png in French', async () => {
    const handleBack = jest.fn();
    const handleSubmit = jest.fn();

    await render(<DistrictScreen onBack={handleBack} onSubmitSuccess={handleSubmit} />);

    // 1. Navigation Header
    expect(screen.getByTestId('district-screen-profile-button')).toBeOnTheScreen();
    expect(screen.getByText('Municipalité')).toBeOnTheScreen();

    // 2. Stepper / Progress Bar
    expect(screen.getByText('• ÉTAPE 1 SUR 2')).toBeOnTheScreen();
    expect(screen.getByText('Détails & Localisation')).toBeOnTheScreen();

    // 3. OpenNorth Pipeline & Borough Card
    expect(screen.getByText('OPENNORTH PIPELINE • En direct')).toBeOnTheScreen();
    expect(screen.getByText('Le Plateau-Mont-Royal')).toBeOnTheScreen();
    expect(screen.getByText('Secteur électoral H2J 1S4 • Arrondissement validé')).toBeOnTheScreen();
    expect(screen.getByTestId('tab-mon-arrondissement')).toBeOnTheScreen();
    expect(screen.getByTestId('tab-autre-arrondissement')).toBeOnTheScreen();

    // 4. Type d'incident civique (2x2 Grid)
    expect(screen.getByText("Type d'incident civique")).toBeOnTheScreen();
    expect(screen.getByText('Requis')).toBeOnTheScreen();
    expect(
      screen.getByText('Sélectionnez la catégorie qui correspond au problème rencontré.'),
    ).toBeOnTheScreen();
    expect(screen.getByText('Sécurité & Pistes cyclables')).toBeOnTheScreen();
    expect(screen.getByText('Voies REV, feux, piétons')).toBeOnTheScreen();
    expect(screen.getByText('Nids-de-poule & Chaussée')).toBeOnTheScreen();
    expect(screen.getByText('Asphalte, trottoirs cassés')).toBeOnTheScreen();
    expect(screen.getByText('Éclairage & Utilités')).toBeOnTheScreen();
    expect(screen.getByText('Lampadaires, égouts, eau')).toBeOnTheScreen();
    expect(screen.getByText('Parcs & Propreté')).toBeOnTheScreen();
    expect(screen.getByText('Dépôts sauvages, parcs')).toBeOnTheScreen();

    // 5. Localisation précise
    expect(screen.getByText('Localisation précise')).toBeOnTheScreen();
    expect(screen.getByText('ADRESSE DÉTECTÉE')).toBeOnTheScreen();
    expect(screen.getByTestId('location-address-input')).toBeOnTheScreen();
    expect(screen.getByTestId('address-search-button')).toBeOnTheScreen();
    expect(screen.getByText(/45.529841, -73.575124 • Parc La Fontaine/)).toBeOnTheScreen();
    expect(screen.getByTestId('map-adjust-pin-button')).toBeOnTheScreen();
    expect(screen.getByText("Ajuster l'épingle")).toBeOnTheScreen();

    // 6. Titre du signalement
    expect(screen.getByText('Titre du signalement')).toBeOnTheScreen();
    expect(screen.getByText('37/70')).toBeOnTheScreen();
    const titleInput = screen.getByTestId('report-title-input');
    expect(titleInput).toBeOnTheScreen();
    expect(titleInput.props.value).toBe('Piste cyclable bloquée sur Rachel Est');

    // 7. Description détaillée
    expect(screen.getByText('Description détaillée')).toBeOnTheScreen();
    expect(screen.getByText('Détour requis')).toBeOnTheScreen();
    const descInput = screen.getByTestId('report-description-input');
    expect(descInput).toBeOnTheScreen();
    expect(descInput.props.value).toContain(
      'Clôtures de chantier obstruant complètement le REV/piste cyclable',
    );

    // 8. Photos justificatives (max. 3)
    expect(screen.getByText('Photos justificatives (max. 3)')).toBeOnTheScreen();
    expect(screen.getByText('1 ajoutée')).toBeOnTheScreen();
    expect(screen.getByText(/Photo jointe/)).toBeOnTheScreen();
    expect(screen.getByTestId('remove-photo-0-button')).toBeOnTheScreen();
    expect(screen.getByTestId('add-photo-button')).toBeOnTheScreen();
    expect(screen.getByText('Ajouter photo')).toBeOnTheScreen();
    expect(screen.getByTestId('photo-slot-optional')).toBeOnTheScreen();
    expect(screen.getByText('Optionnel')).toBeOnTheScreen();

    // 9. Transmission MTL-311
    expect(screen.getByText('Transmission MTL-311')).toBeOnTheScreen();
    expect(screen.getByText('AUTO-TICKET')).toBeOnTheScreen();
    expect(screen.getByTestId('mtl-311-switch')).toBeOnTheScreen();
    expect(
      screen.getByText(
        'Transmettre automatiquement une requête officielle aux services municipaux de la Ville de Montréal.',
      ),
    ).toBeOnTheScreen();
    expect(
      screen.getByText(
        'Numéro de suivi municipal officiel délivré après publication (ex. MTL-311-2026-XXXXX).',
      ),
    ).toBeOnTheScreen();

    // 10. Action Buttons
    expect(screen.getByTestId('publish-report-button')).toBeOnTheScreen();
    expect(screen.getByText('Publier le signalement')).toBeOnTheScreen();
    expect(screen.getByTestId('save-draft-button')).toBeOnTheScreen();
    expect(screen.getByText('Enregistrer comme brouillon')).toBeOnTheScreen();

    // 11. Footer
    expect(
      screen.getByText('Charte citoyenne CityPulse MTL • Données ouvertes OpenNorth'),
    ).toBeOnTheScreen();
  });

  it('has no back button: it is the top-level Report tab', async () => {
    await render(<DistrictScreen />);

    expect(screen.queryByTestId('district-screen-back-button')).toBeNull();
  });

  it('allows switching categories when tapping category cards', async () => {
    await render(<DistrictScreen />);

    // Initially 'traffic_safety' is selected
    expect(
      screen.getByTestId('category-card-traffic_safety').props.accessibilityState.selected,
    ).toBe(true);

    // Tap potholes category
    fireEvent.press(screen.getByTestId('category-card-roads_potholes'));

    await waitFor(() => {
      expect(
        screen.getByTestId('category-card-roads_potholes').props.accessibilityState.selected,
      ).toBe(true);
      expect(
        screen.getByTestId('category-card-traffic_safety').props.accessibilityState.selected,
      ).toBe(false);
    });
  });

  it('allows switching districts via modal when clicking Autre arrondissement', async () => {
    await render(<DistrictScreen />);

    fireEvent.press(screen.getByTestId('tab-autre-arrondissement'));

    // Modal opens with other districts
    const modalTitle = await screen.findByText('Sélectionner un arrondissement');
    expect(modalTitle).toBeOnTheScreen();

    // Select Ville-Marie
    fireEvent.press(screen.getByTestId('borough-option-11111111-1111-4111-8111-111111111102'));

    // Verify district card updated
    await waitFor(() => {
      expect(screen.getByText('Ville-Marie')).toBeOnTheScreen();
      expect(screen.getByText(/Secteur électoral H2L 2C9/)).toBeOnTheScreen();
    });
  });

  it('removes and updates photo count on remove button press', async () => {
    await render(<DistrictScreen />);

    expect(screen.getByText('1 ajoutée')).toBeOnTheScreen();
    fireEvent.press(screen.getByTestId('remove-photo-0-button'));

    expect(await screen.findByText('0 ajoutées')).toBeOnTheScreen();
  });

  it('allows editing title and updates character counter', async () => {
    await render(<DistrictScreen />);

    const titleInput = screen.getByTestId('report-title-input');
    fireEvent.changeText(titleInput, 'Nid-de-poule dangereux');

    expect(await screen.findByText('22/70')).toBeOnTheScreen();
  });

  it('toggles 311 switch on press', async () => {
    await render(<DistrictScreen />);

    const switchComponent = screen.getByTestId('mtl-311-switch');
    expect(switchComponent.props.value).toBe(true);

    fireEvent(switchComponent, 'valueChange', false);

    await waitFor(() => {
      expect(screen.getByTestId('mtl-311-switch').props.value).toBe(false);
    });
  });

  it('saves draft and shows toast feedback', async () => {
    await render(<DistrictScreen />);

    fireEvent.press(screen.getByTestId('save-draft-button'));
    expect(await screen.findByText('Brouillon enregistré avec succès.')).toBeOnTheScreen();
  });

  it('submits report and shows official publication modal', async () => {
    const handleSubmit = jest.fn();
    await render(<DistrictScreen onSubmitSuccess={handleSubmit} />);

    await fireEvent.press(screen.getByTestId('publish-report-button'));

    expect(await screen.findByText('Signalement publié avec succès !')).toBeOnTheScreen();
    expect(handleSubmit).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('published-ticket-ref')).toBeOnTheScreen();

    // Close modal
    fireEvent.press(screen.getByTestId('close-success-modal-button'));
  });

  it('supports English locale when switched', async () => {
    await setLanguage('en');
    await render(<DistrictScreen />);

    expect(screen.getByText('District')).toBeOnTheScreen();
    expect(screen.getByText('• STEP 1 OF 2')).toBeOnTheScreen();
    expect(screen.getByText('Details & Location')).toBeOnTheScreen();
    expect(screen.getByText('My borough')).toBeOnTheScreen();
    expect(screen.getByText('Other borough')).toBeOnTheScreen();
    expect(screen.getByText('Safety & Bike paths')).toBeOnTheScreen();
  });
  it("opens the signed-in user's profile from the header", async () => {
    await render(<DistrictScreen />);

    await fireEvent.press(screen.getByTestId('district-screen-profile-button'));

    expect(screen.getByRole('header', { name: 'Profil' })).toBeOnTheScreen();
  });
});

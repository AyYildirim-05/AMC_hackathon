import '@/i18n';
import { fireEvent, render as rtlRender, screen } from '@testing-library/react-native';

import { installMockBackendApi, TEST_ISSUES } from '../../../../test/fixtures';
import { IssueDetailScreen } from '@/components/layout/IssueDetailScreen';

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

const render = (ui: React.ReactElement) => {
  // gcTime: Infinity schedules no cache-cleanup timer, which would keep Jest alive for 5 minutes.
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return rtlRender(ui, { wrapper });
};

const mockBikeIssue = TEST_ISSUES[0];

describe('IssueDetailScreen', () => {
  let restoreApi: (() => void) | undefined;

  beforeEach(() => {
    restoreApi = installMockBackendApi({ currentUsername: mockUser.username });
  });

  afterEach(() => {
    restoreApi?.();
  });

  it('renders all sections and details matching screen.png example', async () => {
    const handleClose = jest.fn();
    await render(<IssueDetailScreen issue={mockBikeIssue} visible={true} onClose={handleClose} />);

    // Wait for districts & comments fetched from the API
    expect(await screen.findByText('Le Plateau-Mont-Royal • Verified')).toBeOnTheScreen();
    expect(await screen.findByText('3 updates')).toBeOnTheScreen();

    // 1. Navigation & Header
    expect(screen.getByTestId('issue-detail-back-button')).toBeOnTheScreen();
    expect(screen.getByTestId('issue-detail-share-button')).toBeOnTheScreen();

    // 2. Badges & Metadata
    expect(screen.getByText('Traffic & Safety')).toBeOnTheScreen();
    expect(screen.getByText('# MTL-311-2026-88412')).toBeOnTheScreen();
    expect(
      screen.getAllByText('Blocked bike lane on Rue Rachel Est').length,
    ).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('1250 Rue Rachel Est, Montréal, QC H2J 2J9')).toBeOnTheScreen();
    expect(screen.getByText(/Reported by @marc_velo/)).toBeOnTheScreen();

    // 3. Photo & Overlays
    expect(screen.getByText('In Progress')).toBeOnTheScreen();
    expect(screen.getByText('Citizen Photo')).toBeOnTheScreen();
    expect(screen.getByText('Rachel Est × Parc La Fontaine')).toBeOnTheScreen();
    expect(screen.getByText(/GPS Coordinates Verified/)).toBeOnTheScreen();
    expect(screen.getByText('Full map ↗')).toBeOnTheScreen();

    // 4. Community Action & Validation
    expect(screen.getByText('Community Action & Validation')).toBeOnTheScreen();
    expect(screen.getByText('Ground verification')).toBeOnTheScreen();
    expect(screen.getByTestId('detail-upvote-button')).toBeOnTheScreen();
    expect(screen.getByTestId('detail-confirm-button')).toBeOnTheScreen();
    expect(screen.getByText('Upvote Issue (2)')).toBeOnTheScreen();
    expect(screen.getByText('Confirm Resolved (1)')).toBeOnTheScreen();

    // 5. Municipal Timeline (Suivi de l'intervention municipale)
    expect(screen.getByText("Suivi de l'intervention municipale")).toBeOnTheScreen();
    expect(screen.getByText('ARR-08-311')).toBeOnTheScreen();
    expect(screen.getByText('Signalé par le citoyen')).toBeOnTheScreen();
    expect(screen.getByText('Transmis aux inspecteurs du Plateau-Mont-Royal')).toBeOnTheScreen();
    expect(screen.getByText('Équipe dépêchée sur les lieux (Actif)')).toBeOnTheScreen();
    expect(screen.getByText('Résolution finale & réouverture de la voie')).toBeOnTheScreen();

    // 6. Comments & Updates
    expect(screen.getByText('Comments & Updates')).toBeOnTheScreen();
    expect(screen.getByText('3 updates')).toBeOnTheScreen();
    expect(screen.getByText('Official Borough Response')).toBeOnTheScreen();
    expect(
      screen.getByText(
        'The bike lane on Rachel Street East near Parc La Fontaine is completely blocked by construction barriers with no detour signs.',
      ),
    ).toBeOnTheScreen();
    expect(
      screen.getByText(
        '“Thank you for reporting this. Le Plateau-Mont-Royal inspection team has been notified and will verify contractor permit compliance today.”',
      ),
    ).toBeOnTheScreen();
    expect(
      screen.getByText(
        'Confirmed—they moved the fencing back onto the sidewalk perimeter this afternoon so cyclists can pass safely.',
      ),
    ).toBeOnTheScreen();
    expect(
      screen.getByText('Official ticket dispatched to Public Works Inspection'),
    ).toBeOnTheScreen();

    // 7. Comment Input Bar
    expect(screen.getByTestId('comment-input')).toBeOnTheScreen();
    expect(screen.getByTestId('comment-send-button')).toBeOnTheScreen();
  });

  it('calls onClose when clicking back button', async () => {
    const handleClose = jest.fn();
    await render(<IssueDetailScreen issue={mockBikeIssue} visible={true} onClose={handleClose} />);

    await fireEvent.press(screen.getByTestId('issue-detail-back-button'));
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('toggles upvote count on press', async () => {
    await render(<IssueDetailScreen issue={mockBikeIssue} visible={true} onClose={jest.fn()} />);

    const upvoteBtn = screen.getByTestId('detail-upvote-button');
    expect(screen.getByText('Upvote Issue (2)')).toBeOnTheScreen();

    await fireEvent.press(upvoteBtn);
    expect(screen.getByText('Upvote Issue (3)')).toBeOnTheScreen();

    await fireEvent.press(upvoteBtn);
    expect(screen.getByText('Upvote Issue (2)')).toBeOnTheScreen();
  });

  it('allows adding a new comment', async () => {
    await render(<IssueDetailScreen issue={mockBikeIssue} visible={true} onClose={jest.fn()} />);
    await screen.findByText('3 updates');

    const input = screen.getByTestId('comment-input');
    const sendBtn = screen.getByTestId('comment-send-button');

    await fireEvent.changeText(input, 'Inspected again this afternoon, clear now!');
    await fireEvent.press(sendBtn);

    expect(await screen.findByText('Inspected again this afternoon, clear now!')).toBeOnTheScreen();
    expect(await screen.findByText('4 updates')).toBeOnTheScreen();
  });
  it("opens the signed-in user's profile from the header", async () => {
    await render(<IssueDetailScreen issue={mockBikeIssue} visible={true} onClose={jest.fn()} />);

    const button = screen.getByTestId('issue-detail-profile-button');
    expect(screen.getByText('CM')).toBeOnTheScreen();
    await fireEvent.press(button);

    expect(screen.getByRole('header', { name: 'Profile' })).toBeOnTheScreen();
  });
});

import { fireEvent, render, screen } from '@testing-library/react-native';

import { TEST_PROFILE_DATA } from '../../../../test/fixtures';

import '@/i18n';
import { ManagerProfile } from '@/components/utils/manager-profile';
import { buildDistrictProfile, type DistrictProfile } from '@/lib/profile';

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

const camille = (): DistrictProfile => {
  const profile = buildDistrictProfile('camille_mtl', TEST_PROFILE_DATA);
  if (!profile) throw new Error('test fixtures have no profile for camille_mtl');
  return profile;
};

it("shows the territories and her district's numbers from the dummy data", async () => {
  await render(<ManagerProfile profile={camille()} />);

  expect(screen.getByText('@ops_villemarie')).toBeOnTheScreen();
  expect(screen.getByText('Active report')).toBeOnTheScreen();
  expect(screen.getByText('100%')).toBeOnTheScreen();
  expect(screen.getByText('3.7h')).toBeOnTheScreen();
  expect(screen.getByText('le-plateau-mont-royal')).toBeOnTheScreen();
});

it('opens on the tab that has issues and shows the triage card with the official reply', async () => {
  await render(<ManagerProfile profile={camille()} />);

  expect(screen.getByRole('button', { name: 'Intervention in progress (1)' })).toBeSelected();
  expect(screen.getByText('Blocked bike lane on Rue Rachel Est')).toBeOnTheScreen();
  expect(screen.getByText('MTL-311-2026-88412')).toBeOnTheScreen();
  expect(screen.getByText(/Reported by @marc_velo/)).toBeOnTheScreen();
  expect(screen.getByText(/inspection team has been notified/)).toBeOnTheScreen();
});

it('moves an issue to another tab and updates the numbers when its status changes', async () => {
  await render(<ManagerProfile profile={camille()} />);

  await fireEvent.press(
    screen.getByRole('button', { name: 'Change status, currently Intervention in progress' }),
  );
  expect(screen.getByRole('radio', { name: 'Intervention in progress' })).toBeChecked();
  await fireEvent.press(screen.getByRole('radio', { name: 'Resolved' }));

  expect(screen.getByRole('button', { name: 'Intervention in progress (0)' })).toBeOnTheScreen();
  expect(screen.getByText('No reports here.')).toBeOnTheScreen();
  expect(screen.getByText('Active reports')).toBeOnTheScreen(); // 0 active → plural label

  await fireEvent.press(screen.getByRole('button', { name: 'Resolved (1)' }));
  expect(screen.getByText('Blocked bike lane on Rue Rachel Est')).toBeOnTheScreen();
});

it('disables the actions that have no backend yet', async () => {
  await render(<ManagerProfile profile={camille()} />);

  for (const name of [
    'Publish an official response',
    'Assign local roadworks',
    'Link to 311 file',
    'Manage boundaries',
    '311 history',
  ]) {
    expect(screen.getByRole('button', { name })).toBeDisabled();
  }
});

it('highlights urgent high-severity issues at the top of the triage queue with their /10 score', async () => {
  const base = camille();
  const existing = base.issues[0];
  const lowIssue = {
    ...existing,
    id: 'issue-low-1',
    title: 'Minor bench graffiti',
    status: 'not_started' as const,
    severity_score: 2,
    urgency: 'low' as const,
    created_at: '2026-11-22T03:00:00.000Z',
  };
  const urgentIssue = {
    ...existing,
    id: 'issue-urgent-1',
    title: 'Downed power wire on Rue Rachel',
    status: 'not_started' as const,
    severity_score: 10,
    urgency: 'high' as const,
    created_at: '2026-11-21T08:00:00.000Z',
  };
  const mediumIssue = {
    ...existing,
    id: 'issue-medium-1',
    title: 'Deep pothole near Parc La Fontaine',
    status: 'not_started' as const,
    severity_score: 6,
    urgency: 'medium' as const,
    created_at: '2026-11-22T01:00:00.000Z',
  };

  await render(
    <ManagerProfile
      profile={{
        ...base,
        issues: [lowIssue, mediumIssue, urgentIssue],
        reporterUsername: {
          [lowIssue.id]: 'marc_velo',
          [mediumIssue.id]: 'marc_velo',
          [urgentIssue.id]: 'marc_velo',
        },
      }}
    />,
  );

  expect(screen.getByText('🚨 High urgency • 10/10')).toBeOnTheScreen();
  expect(screen.getByText('⚠️ Medium urgency • 6/10')).toBeOnTheScreen();
  expect(screen.getByText('🟢 Low urgency • 2/10')).toBeOnTheScreen();

  // Verify DOM order places the 10/10 urgent hazard before 6/10 and 2/10.
  const badges = screen.getAllByTestId(/^triage-severity-badge-/);
  expect(badges.map((b) => b.props.testID)).toEqual([
    'triage-severity-badge-issue-urgent-1',
    'triage-severity-badge-issue-medium-1',
    'triage-severity-badge-issue-low-1',
  ]);
});

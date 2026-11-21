import { fireEvent, render, screen } from '@testing-library/react-native';

import '@/i18n';
import { ManagerProfile } from '@/components/manager-profile';
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
  const profile = buildDistrictProfile('camille_mtl');
  if (!profile) throw new Error('dummy data has no profile for camille_mtl');
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

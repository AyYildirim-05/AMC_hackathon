import '@/i18n';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { BackHandler, Pressable, Text } from 'react-native';

import { ProfilePanelProvider, useProfilePanel } from '@/components/layout/profile-panel';

// The panel's motion is under test, not the profile's content: no signed-in user to load.
jest.mock('@/hooks/use-current-user', () => ({ useCurrentUser: () => null }));
jest.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ signOut: async () => {} }) }));
// The buttons' ripple animation isn't under test; a minimal stand-in avoids the native runtime.
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

function Screen() {
  const panel = useProfilePanel();
  return (
    <Pressable testID="open-profile" accessibilityRole="button" onPress={panel.open}>
      <Text>Home screen</Text>
    </Pressable>
  );
}

const renderPanel = () =>
  render(
    <ProfilePanelProvider>
      <Screen />
    </ProfilePanelProvider>,
  );

it('slides the profile in over the screen and hides the screen underneath from touch and screen readers', async () => {
  await renderPanel();
  expect(screen.queryByTestId('profile-panel')).toBeNull();

  await fireEvent.press(screen.getByTestId('open-profile'));

  expect(screen.getByTestId('profile-panel')).toBeOnTheScreen();
  expect(screen.getByRole('header', { name: 'Profile' })).toBeOnTheScreen();
  // The screen underneath is still mounted (it slides left), but out of reach while covered.
  expect(screen.queryByText('Home screen')).toBeNull();
  expect(screen.getByText('Home screen', { includeHiddenElements: true })).toBeTruthy();
});

it('slides the profile back out with the back button and gives the screen back', async () => {
  await renderPanel();
  await fireEvent.press(screen.getByTestId('open-profile'));

  await fireEvent.press(screen.getByTestId('profile-back-button'));

  await waitFor(() => expect(screen.queryByTestId('profile-panel')).toBeNull());
  expect(screen.getByText('Home screen')).toBeOnTheScreen();
});

it("closes on Android's back button while open, and leaves it alone otherwise", async () => {
  type Handler = Parameters<typeof BackHandler.addEventListener>[1];
  const handlers: Handler[] = [];
  const spy = jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, handler) => {
    handlers.push(handler);
    return {
      remove: () => {
        handlers.splice(handlers.indexOf(handler), 1);
      },
    };
  });
  await renderPanel();
  expect(handlers).toHaveLength(0);

  await fireEvent.press(screen.getByTestId('open-profile'));
  expect(handlers).toHaveLength(1);
  expect(handlers[0]({} as Parameters<Handler>[0])).toBe(true);

  await waitFor(() => expect(screen.queryByTestId('profile-panel')).toBeNull());
  expect(handlers).toHaveLength(0);
  spy.mockRestore();
});

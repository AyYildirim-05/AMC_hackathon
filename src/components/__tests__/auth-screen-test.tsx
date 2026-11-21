import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import '@/i18n';
import { AuthScreen } from '@/app/auth';
import * as authApi from '@/lib/auth/auth-api';
import { resetTokenCache } from '@/lib/auth/token-storage';
import { AuthProvider, useAuth } from '@/providers/auth-provider';
import { createQueryClient, QueryProvider } from '@/providers/query-provider';

const mockSecureStore = new Map<string, string>();

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
jest.mock('expo-secure-store', () => ({
  getItemAsync: async (key: string) => mockSecureStore.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => void mockSecureStore.set(key, value),
  deleteItemAsync: async (key: string) => void mockSecureStore.delete(key),
}));
jest.mock('expo-network', () => ({
  addNetworkStateListener: () => ({ remove: () => {} }),
}));

function Harness() {
  const { status, user } = useAuth();
  if (status === 'signedIn') {
    return <Text>Signed in: {user?.username}</Text>;
  }
  return <AuthScreen />;
}

function renderAuth() {
  mockSecureStore.clear();
  resetTokenCache();
  const client = createQueryClient();
  client.setDefaultOptions({
    queries: { ...client.getDefaultOptions().queries, gcTime: Infinity },
  });
  return render(
    <QueryProvider client={client}>
      <AuthProvider>
        <Harness />
      </AuthProvider>
    </QueryProvider>,
  );
}

describe('AuthScreen', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('validates required fields before calling login API', async () => {
    const loginSpy = jest.spyOn(authApi, 'loginWithEmail');
    await renderAuth();

    await fireEvent.press(screen.getByText('Sign in'));

    expect(screen.getByText('Please fill in all required fields.')).toBeOnTheScreen();
    expect(loginSpy).not.toHaveBeenCalled();
  });

  it('toggles password visibility and signs in with email and password', async () => {
    const loginSpy = jest.spyOn(authApi, 'loginWithEmail').mockResolvedValueOnce({
      accessToken: 'jwt-access',
      refreshToken: 'jwt-refresh',
      expiresIn: 3600,
      uid: 'u1',
      user: {
        id: 'u1',
        username: 'camille_mtl',
        email: 'camille@gmail.com',
        postalCode: 'H2J1S4',
        homeDistrictId: null,
        role: 'resident',
        preferredLanguage: 'en',
      },
    });

    await renderAuth();

    const passwordInput = screen.getByPlaceholderText('At least 8 characters');
    expect(passwordInput.props.secureTextEntry).toBe(true);
    await fireEvent.press(screen.getByText('Show'));
    expect(passwordInput.props.secureTextEntry).toBe(false);
    expect(screen.getByText('Hide')).toBeOnTheScreen();

    await fireEvent.changeText(
      screen.getByPlaceholderText('you@gmail.com or username'),
      'camille@gmail.com',
    );
    await fireEvent.changeText(passwordInput, 'password123');
    await fireEvent.press(screen.getByText('Sign in'));

    await waitFor(() => {
      expect(screen.getByText('Signed in: camille_mtl')).toBeOnTheScreen();
    });
    expect(loginSpy).toHaveBeenCalledWith({
      email: 'camille@gmail.com',
      password: 'password123',
    });
  });

  it('switches to register mode and validates password confirmation and postal code', async () => {
    const registerSpy = jest.spyOn(authApi, 'registerWithEmail');
    await renderAuth();

    await fireEvent.press(screen.getByText("Don't have an account? Create one"));

    expect(screen.getByText('Create your account')).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByPlaceholderText('e.g. camille_mtl'), 'camille_mtl');
    await fireEvent.changeText(screen.getByPlaceholderText('you@gmail.com'), 'camille@gmail.com');
    await fireEvent.changeText(screen.getByPlaceholderText('At least 8 characters'), 'password123');
    await fireEvent.changeText(
      screen.getByPlaceholderText('Re-enter your password'),
      'different123',
    );
    await fireEvent.changeText(screen.getByPlaceholderText('H2J 1S4'), 'H2J 1S4');
    await fireEvent.press(screen.getByText('Create account'));

    expect(screen.getByText('Passwords do not match.')).toBeOnTheScreen();

    await fireEvent.changeText(
      screen.getByPlaceholderText('Re-enter your password'),
      'password123',
    );
    await fireEvent.changeText(screen.getByPlaceholderText('H2J 1S4'), '12345');
    await fireEvent.press(screen.getByText('Create account'));

    expect(
      screen.getByText('Enter a valid 6-character Canadian postal code (e.g. H2J 1S4).'),
    ).toBeOnTheScreen();
    expect(registerSpy).not.toHaveBeenCalled();
  });
});

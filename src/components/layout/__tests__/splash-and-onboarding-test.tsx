import '@/i18n';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as SplashScreen from 'expo-splash-screen';

import { OnboardingPresentationModal } from '@/components/layout/OnboardingPresentationModal';
import { SplashScreenOverlay } from '@/components/layout/SplashScreenOverlay';
import {
  hasSeenOnboarding,
  markOnboardingSeen,
  resetOnboardingSeen,
} from '@/lib/onboarding-storage';

jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(() => Promise.resolve(true)),
  hideAsync: jest.fn(() => Promise.resolve(true)),
}));

jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    getItemAsync: async (key: string) => store.get(key) ?? null,
    setItemAsync: async (key: string, value: string) => void store.set(key, value),
    deleteItemAsync: async (key: string) => void store.delete(key),
  };
});

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
    withRepeat: <T,>(value: T) => value,
    withSequence: <T,>(...values: T[]) => values[values.length - 1],
    Easing: {
      out: (fn: unknown) => fn,
      inOut: (fn: unknown) => fn,
      cubic: (t: number) => t,
      quad: (t: number) => t,
      ease: (t: number) => t,
      back: () => (t: number) => t,
    },
  };
});

describe('SplashScreenOverlay', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders the branded MonTone splash screen, hides native splash, and calls onFinish when ready', async () => {
    const onFinish = jest.fn();

    await render(<SplashScreenOverlay ready={true} minimumDurationMs={1000} onFinish={onFinish} />);

    expect(SplashScreen.hideAsync).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('splash-screen-overlay')).toBeOnTheScreen();
    expect(screen.getByTestId('splash-logo-image')).toBeOnTheScreen();
    expect(screen.getByText('MonTone')).toBeOnTheScreen();
    expect(
      screen.getByText('Report, track, and resolve neighborhood issues together.'),
    ).toBeOnTheScreen();
    expect(onFinish).not.toHaveBeenCalled();

    // Advance past minimum display duration and fade-out duration.
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    await act(async () => {
      jest.advanceTimersByTime(450);
    });

    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('splash-screen-overlay')).toBeNull();
  });

  it('stays visible while ready is false and finishes once ready becomes true', async () => {
    const onFinish = jest.fn();

    const { rerender } = await render(
      <SplashScreenOverlay ready={false} minimumDurationMs={500} onFinish={onFinish} />,
    );

    await act(async () => {
      jest.advanceTimersByTime(2000);
    });
    expect(onFinish).not.toHaveBeenCalled();
    expect(screen.getByTestId('splash-screen-overlay')).toBeOnTheScreen();

    await rerender(
      <SplashScreenOverlay ready={true} minimumDurationMs={500} onFinish={onFinish} />,
    );
    await act(async () => {
      jest.advanceTimersByTime(450);
    });

    expect(onFinish).toHaveBeenCalledTimes(1);
  });
});

describe('OnboardingPresentationModal', () => {
  it('navigates across all feature slides and calls onComplete on Get Started', async () => {
    const onComplete = jest.fn();
    await render(<OnboardingPresentationModal visible={true} onComplete={onComplete} />);

    expect(screen.getByTestId('onboarding-presentation-modal')).toBeOnTheScreen();
    expect(screen.getByText('Pinpoint Issues in Seconds')).toBeOnTheScreen();
    expect(screen.queryByTestId('onboarding-back-button')).toBeNull();

    // Advance to Slide 2
    await fireEvent.press(screen.getByTestId('onboarding-next-button'));
    expect(screen.getByTestId('onboarding-back-button')).toBeOnTheScreen();
    expect(screen.getByTestId('onboarding-dot-1')).toBeSelected();

    // Go back to Slide 1
    await fireEvent.press(screen.getByTestId('onboarding-back-button'));
    expect(screen.getByTestId('onboarding-dot-0')).toBeSelected();

    // Jump straight to the final slide via pagination dot and complete
    await fireEvent.press(screen.getByTestId('onboarding-dot-3'));
    expect(screen.getByTestId('onboarding-start-button')).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('onboarding-start-button'));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('promises only the 311 hand-off the app has: email, and a MonTone reference', async () => {
    await render(<OnboardingPresentationModal visible={true} onComplete={jest.fn()} />);

    expect(screen.getByText('MonTone #A1B2C3')).toBeOnTheScreen();
    expect(screen.getByText(/send it to 311 by email/)).toBeOnTheScreen();
    // No made-up official 311 number or "311 tracking".
    expect(screen.queryByText(/MTL-311/)).toBeNull();
  });

  it('dismisses immediately when Skip is pressed', async () => {
    const onComplete = jest.fn();
    await render(<OnboardingPresentationModal visible={true} onComplete={onComplete} />);

    await fireEvent.press(screen.getByTestId('onboarding-skip-button'));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});

describe('onboarding-storage', () => {
  beforeEach(async () => {
    await resetOnboardingSeen();
  });

  it('defaults to false, persists true after markOnboardingSeen, and resets cleanly', async () => {
    expect(await hasSeenOnboarding()).toBe(false);

    await markOnboardingSeen();
    expect(await hasSeenOnboarding()).toBe(true);

    await resetOnboardingSeen();
    expect(await hasSeenOnboarding()).toBe(false);
  });
});

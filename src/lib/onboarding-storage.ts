import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const ONBOARDING_STORAGE_KEY = 'app.onboarding_seen_v1';
const isWeb = Platform.OS === 'web';

/** Returns `true` if the user has already seen and dismissed the first-launch presentation modal. */
export async function hasSeenOnboarding(): Promise<boolean> {
  try {
    const value = isWeb
      ? (globalThis.localStorage?.getItem(ONBOARDING_STORAGE_KEY) ?? null)
      : await SecureStore.getItemAsync(ONBOARDING_STORAGE_KEY);
    return value === 'true';
  } catch {
    return false;
  }
}

/** Persists that the first-launch presentation modal has been completed or skipped. */
export async function markOnboardingSeen(): Promise<void> {
  try {
    if (isWeb) {
      globalThis.localStorage?.setItem(ONBOARDING_STORAGE_KEY, 'true');
    } else {
      await SecureStore.setItemAsync(ONBOARDING_STORAGE_KEY, 'true');
    }
  } catch {
    // Storage unavailable: dismissal still applies for this session.
  }
}

/** Clears the saved onboarding flag so the presentation modal can be shown again. */
export async function resetOnboardingSeen(): Promise<void> {
  try {
    if (isWeb) {
      globalThis.localStorage?.removeItem(ONBOARDING_STORAGE_KEY);
    } else {
      await SecureStore.deleteItemAsync(ONBOARDING_STORAGE_KEY);
    }
  } catch {
    // Ignore storage cleanup errors.
  }
}

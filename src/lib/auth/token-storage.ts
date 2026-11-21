import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export type AuthTokens = {
  accessToken: string;
  refreshToken?: string | null;
};

const ACCESS_KEY = process.env.EXPO_PUBLIC_AUTH_ACCESS_KEY ?? 'auth.accessToken';
const REFRESH_KEY = process.env.EXPO_PUBLIC_AUTH_REFRESH_KEY ?? 'auth.refreshToken';

/**
 * SecureStore is native-only (Keychain / Keystore). On web we fall back to localStorage,
 * which any script on the page can read; prefer httpOnly cookies there if the server allows.
 */
const isWeb = Platform.OS === 'web';

async function read(key: string): Promise<string | null> {
  try {
    return isWeb
      ? (globalThis.localStorage?.getItem(key) ?? null)
      : await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function write(key: string, value: string | null | undefined): Promise<void> {
  try {
    if (isWeb) {
      if (value) globalThis.localStorage?.setItem(key, value);
      else globalThis.localStorage?.removeItem(key);
    } else if (value) {
      await SecureStore.setItemAsync(key, value);
    } else {
      await SecureStore.deleteItemAsync(key);
    }
  } catch {
    // Storage can be unavailable (private browsing, locked keychain). The in-memory copy
    // still lets this session work; the user signs in again next launch.
  }
}

/** In-memory copy so every request doesn't hit storage. `undefined` means not loaded yet. */
let cache: AuthTokens | null | undefined;

export async function loadTokens(): Promise<AuthTokens | null> {
  if (cache !== undefined) return cache;
  const [accessToken, refreshToken] = await Promise.all([read(ACCESS_KEY), read(REFRESH_KEY)]);
  const trimmed = accessToken?.trim();
  cache ??= trimmed ? { accessToken: trimmed, refreshToken: refreshToken?.trim() || null } : null;
  return cache;
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    if (typeof globalThis.atob !== 'function') return null;
    const parsed: unknown = JSON.parse(globalThis.atob(padded));
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function isTokenExpired(token: string): boolean {
  if (token.startsWith('mock.')) return true;
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== 'number') return false;
  return payload.exp <= Math.floor(Date.now() / 1000);
}

/**
 * Returns true if the stored tokens are usable to start an authenticated session:
 * access token is non-empty and either unexpired or paired with an unexpired refresh token.
 */
export function isStoredTokenUsable(tokens: AuthTokens | null): boolean {
  if (!tokens?.accessToken?.trim()) return false;
  if (!isTokenExpired(tokens.accessToken)) return true;
  return Boolean(tokens.refreshToken?.trim() && !isTokenExpired(tokens.refreshToken));
}

export async function saveTokens(tokens: AuthTokens): Promise<void> {
  cache = tokens;
  await Promise.all([
    write(ACCESS_KEY, tokens.accessToken),
    write(REFRESH_KEY, tokens.refreshToken),
  ]);
}

export async function clearTokens(): Promise<void> {
  cache = null;
  await Promise.all([write(ACCESS_KEY, null), write(REFRESH_KEY, null)]);
}

/** Test helper: forget the in-memory copy so the next load reads storage. */
export function resetTokenCache() {
  cache = undefined;
}

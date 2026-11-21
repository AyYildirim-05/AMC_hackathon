import { isAxiosError } from 'axios';

import { apiClient } from '@/lib/api/client';
import type { AuthTokens } from '@/lib/auth/token-storage';

export type AuthUser = {
  id: string;
  username: string;
  email: string;
  postalCode: string;
  homeDistrictId: string | null;
  role: 'resident' | 'district_manager' | 'admin';
  preferredLanguage: 'fr' | 'en';
};

export type LoginCredentials = {
  /** Email address or username. */
  email: string;
  password: string;
};

export type RegisterCredentials = {
  username: string;
  email: string;
  password: string;
  postalCode: string;
  preferredLanguage?: 'fr' | 'en';
};

/** @deprecated Use `LoginCredentials` or `RegisterCredentials`. */
export type Credentials = LoginCredentials;

/** Returned by `POST /api/auth/login` and `POST /api/auth/register`. */
export type AuthResponse = AuthTokens & {
  expiresIn: number;
  uid: string;
  user: AuthUser;
};

/**
 * Email (or username) + password login against the Express backend.
 * Pass the result to `useAuth().signIn(res, res.user)`.
 * `skipAuth` keeps a wrong password (401) from triggering a token refresh or sign-out.
 */
export async function loginWithEmail(credentials: LoginCredentials): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>('/api/auth/login', credentials, {
    skipAuth: true,
  });
  return data;
}

export async function registerWithEmail(credentials: RegisterCredentials): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>('/api/auth/register', credentials, {
    skipAuth: true,
  });
  return data;
}

export async function fetchCurrentUser(): Promise<AuthUser> {
  const { data } = await apiClient.get<{ user: AuthUser }>('/api/auth/me');
  return data.user;
}

type ApiErrorBody = {
  error?: string;
  details?: {
    fieldErrors?: Record<string, string[] | undefined>;
    formErrors?: string[];
  };
};

/** Extracts a user-friendly message from an Express/Zod API error response. */
export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (!isAxiosError<ApiErrorBody>(error)) {
    return error instanceof Error && error.message ? error.message : fallback;
  }

  const body = error.response?.data;
  const fieldErrors = body?.details?.fieldErrors;
  if (fieldErrors) {
    for (const messages of Object.values(fieldErrors)) {
      if (messages && messages.length > 0) return messages[0];
    }
  }
  const formErrors = body?.details?.formErrors;
  if (formErrors && formErrors.length > 0) return formErrors[0];

  if (body?.error) return body.error;
  if (!error.response) return fallback;
  return error.message || fallback;
}

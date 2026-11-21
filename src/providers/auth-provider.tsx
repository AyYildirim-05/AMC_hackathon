import { useQueryClient } from '@tanstack/react-query';
import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react';

import type { AuthUser } from '@/lib/auth/auth-api';
import { onUnauthorized } from '@/lib/auth/auth-events';
import {
  type AuthTokens,
  clearTokens,
  isStoredTokenUsable,
  loadTokens,
  saveTokens,
} from '@/lib/auth/token-storage';

export type AuthStatus = 'loading' | 'signedIn' | 'signedOut';

type AuthContextValue = {
  status: AuthStatus;
  isAuthenticated: boolean;
  user: AuthUser | null;
  /** Store tokens (and optionally user profile) returned by your login/register endpoint. */
  signIn: (tokens: AuthTokens, user?: AuthUser | null) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/** Must be rendered inside QueryProvider. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    let active = true;
    loadTokens().then(async (tokens) => {
      if (!isStoredTokenUsable(tokens)) {
        if (tokens) await clearTokens();
        if (active) setStatus('signedOut');
        return;
      }
      if (active) setStatus('signedIn');
    });
    // The axios interceptor emits this when a 401 can't be fixed by refreshing.
    const unsubscribe = onUnauthorized(() => {
      setUser(null);
      setStatus('signedOut');
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      isAuthenticated: status === 'signedIn',
      user,
      signIn: async (tokens, signedInUser) => {
        await saveTokens(tokens);
        if (signedInUser !== undefined) setUser(signedInUser);
        setStatus('signedIn');
      },
      signOut: async () => {
        await clearTokens();
        queryClient.clear();
        setUser(null);
        setStatus('signedOut');
      },
    }),
    [status, user, queryClient],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>.');
  return context;
}

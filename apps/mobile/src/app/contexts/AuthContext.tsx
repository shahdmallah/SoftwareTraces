// Updated to hydrate auth state from secure storage and persist session changes so mobile API requests can reuse the token.
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { clearStoredSession, getStoredSession, persistSession, type AuthSession, type AuthUser } from '../lib/auth';

type AuthContextValue = {
  session: AuthSession | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setSession: (nextSession: AuthSession | null) => void;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const hydrateSession = async () => {
      try {
        const storedSession = await getStoredSession();

        if (mounted) {
          setSessionState(storedSession);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    void hydrateSession();

    return () => {
      mounted = false;
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    session,
    user: session?.user ?? null,
    isAuthenticated: !!session?.token,
    isLoading,
    setSession: (nextSession) => {
      setSessionState(nextSession);
      void persistSession(nextSession);
    },
    signOut: () => {
      setSessionState(null);
      void clearStoredSession();
    },
  }), [isLoading, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider.');
  }

  return context;
}

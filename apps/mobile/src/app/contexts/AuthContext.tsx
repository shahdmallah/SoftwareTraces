// Updated to hydrate auth state from secure storage and persist session changes so mobile API requests can reuse the token.
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  clearStoredSession,
  getStoredSession,
  hasCompletedFirstLoginSetup,
  markFirstLoginSetupComplete,
  persistSession,
  type AuthSession,
  type AuthUser,
} from '../lib/auth';

type AuthContextValue = {
  session: AuthSession | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  hasCompletedFirstLoginSetup: boolean;
  isFirstLoginSetupLoading: boolean;
  setSession: (nextSession: AuthSession | null) => void;
  completeFirstLoginSetup: () => Promise<void>;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasCompletedSetup, setHasCompletedSetup] = useState(true);
  const [isFirstLoginSetupLoading, setIsFirstLoginSetupLoading] = useState(false);

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

  useEffect(() => {
    let mounted = true;

    const hydrateFirstLoginSetup = async () => {
      if (!session?.user?.id) {
        if (mounted) {
          setHasCompletedSetup(true);
          setIsFirstLoginSetupLoading(false);
        }
        return;
      }

      setIsFirstLoginSetupLoading(true);

      try {
        const hasCompleted = await hasCompletedFirstLoginSetup(session.user.id);

        if (mounted) {
          setHasCompletedSetup(hasCompleted);
        }
      } catch {
        if (mounted) {
          setHasCompletedSetup(true);
        }
      } finally {
        if (mounted) {
          setIsFirstLoginSetupLoading(false);
        }
      }
    };

    void hydrateFirstLoginSetup();

    return () => {
      mounted = false;
    };
  }, [session?.user?.id]);

  const value = useMemo<AuthContextValue>(() => ({
    session,
    user: session?.user ?? null,
    isAuthenticated: !!session?.token,
    isLoading,
    hasCompletedFirstLoginSetup: hasCompletedSetup,
    isFirstLoginSetupLoading,
    setSession: (nextSession) => {
      setSessionState(nextSession);
      void persistSession(nextSession);
    },
    completeFirstLoginSetup: async () => {
      if (!session?.user?.id) {
        return;
      }

      await markFirstLoginSetupComplete(session.user.id);
      setHasCompletedSetup(true);
    },
    signOut: () => {
      setSessionState(null);
      setHasCompletedSetup(true);
      setIsFirstLoginSetupLoading(false);
      void clearStoredSession();
    },
  }), [hasCompletedSetup, isFirstLoginSetupLoading, isLoading, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider.');
  }

  return context;
}

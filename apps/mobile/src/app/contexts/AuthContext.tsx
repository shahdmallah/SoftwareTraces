import React, { createContext, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { AuthSession, AuthUser } from '../lib/auth';

type AuthContextValue = {
  session: AuthSession | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  setSession: (nextSession: AuthSession | null) => void;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<AuthSession | null>(null);

  const value = useMemo<AuthContextValue>(() => ({
    session,
    user: session?.user ?? null,
    isAuthenticated: !!session?.token,
    setSession: (nextSession) => {
      setSessionState(nextSession);
    },
    signOut: () => {
      setSessionState(null);
    },
  }), [session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider.');
  }

  return context;
}

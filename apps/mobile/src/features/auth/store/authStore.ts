import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import type { AuthSession } from "@traces/shared-types";

interface AuthStore {
  session: AuthSession | null;
  isHydrated: boolean;
  setSession: (session: AuthSession | null) => Promise<void>;
  hydrate: () => Promise<void>;
  logout: () => Promise<void>;
}

const SESSION_KEY = "traces.session";

export const useAuthStore = create<AuthStore>((set) => ({
  session: null,
  isHydrated: false,
  setSession: async (session) => {
    if (session) {
      await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
    } else {
      await SecureStore.deleteItemAsync(SESSION_KEY);
    }

    set({ session });
  },
  hydrate: async () => {
    const raw = await SecureStore.getItemAsync(SESSION_KEY);
    set({
      session: raw ? (JSON.parse(raw) as AuthSession) : null,
      isHydrated: true
    });
  },
  logout: async () => {
    await SecureStore.deleteItemAsync(SESSION_KEY);
    set({ session: null });
  }
}));

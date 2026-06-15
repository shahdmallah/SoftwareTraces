import React, { useEffect } from "react";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import AppNavigator from "./src/navigation/AppNavigator";
import { colors } from "@traces/ui";
import { useAuthStore } from "./src/features/auth/store/authStore";
import { useOfflineSync } from "./src/shared/hooks/useOfflineSync";
import { initializeOfflineStorage } from "./src/shared/services/offline/storage";
import { registerDeviceForFcmPush } from "./src/shared/services/notifications/pushRegistration";

const queryClient = new QueryClient();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.sand,
    card: colors.mist,
    primary: colors.pine,
    text: colors.ink,
    border: colors.gold
  }
};

export default function App(): JSX.Element {
  useOfflineSync();
  const session = useAuthStore((state) => state.session);

  useEffect(() => {
    async function bootstrapStorage(): Promise<void> {
      try {
        await initializeOfflineStorage();
      } catch (error) {
        console.warn("Failed to initialize offline storage", error);
      }
    }

    void bootstrapStorage();
  }, []);

  useEffect(() => {
    if (!session) {
      return;
    }

    void registerDeviceForFcmPush().catch((error) => {
      console.warn("Failed to register push token", error);
    });
  }, [session]);

  return (
    <QueryClientProvider client={queryClient}>
      <NavigationContainer theme={navTheme}>
        <StatusBar style="dark" />
        <AppNavigator />
      </NavigationContainer>
    </QueryClientProvider>
  );
}

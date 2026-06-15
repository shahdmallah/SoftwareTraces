import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { registerPushToken } from "../api/client";

const DEVICE_ID_KEY = "traces.push.device_id";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function getDeviceId(): Promise<string> {
  const existing = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (existing) {
    return existing;
  }

  const generated = `${Platform.OS}-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  await SecureStore.setItemAsync(DEVICE_ID_KEY, generated);
  return generated;
}

async function ensureNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) {
    return true;
  }

  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

export async function registerDeviceForFcmPush(): Promise<void> {
  if (Platform.OS !== "ios" && Platform.OS !== "android") {
    return;
  }

  if (!Device.isDevice) {
    console.warn("Push notifications require a physical device.");
    return;
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#2E6F55",
    });
  }

  const hasPermission = await ensureNotificationPermission();
  if (!hasPermission) {
    console.warn("Push notification permission was not granted.");
    return;
  }

  const nativeToken = await Notifications.getDevicePushTokenAsync();
  if (!nativeToken.data) {
    return;
  }

  await registerPushToken({
    token: nativeToken.data,
    provider: "fcm",
    platform: Platform.OS,
    device_id: await getDeviceId(),
    app_version: Constants.expoConfig?.version,
  });
}

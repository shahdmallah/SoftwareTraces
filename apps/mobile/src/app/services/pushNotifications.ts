import Constants from 'expo-constants';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';
import { registerPushToken, type PushPlatform } from '../api/notificationsApi';

export type PushNotificationData = Record<string, unknown>;

type DeviceModule = typeof import('expo-device');
type NotificationsModule = typeof import('expo-notifications');
type NotificationPermissionsStatus = import('expo-notifications').NotificationPermissionsStatus;
type NotificationResponse = import('expo-notifications').NotificationResponse;
type EventSubscription = import('expo-notifications').EventSubscription;

let deviceModulePromise: Promise<DeviceModule | null> | null = null;
let notificationsModulePromise: Promise<NotificationsModule | null> | null = null;
let notificationHandlerConfigured = false;

function nativeModuleAvailable(moduleName: string): boolean {
  return requireOptionalNativeModule(moduleName) != null;
}

function pushNativeModulesAvailable(): boolean {
  return (
    nativeModuleAvailable('ExpoDevice') &&
    nativeModuleAvailable('ExpoPushTokenManager') &&
    nativeModuleAvailable('ExpoNotificationPermissionsModule') &&
    nativeModuleAvailable('ExpoNotificationsEmitter') &&
    nativeModuleAvailable('ExpoNotificationsHandlerModule') &&
    (Platform.OS !== 'android' || nativeModuleAvailable('ExpoNotificationChannelManager'))
  );
}

async function getDeviceModule(): Promise<DeviceModule | null> {
  if (deviceModulePromise) {
    return deviceModulePromise;
  }

  if (!nativeModuleAvailable('ExpoDevice')) {
    return null;
  }

  deviceModulePromise = import('expo-device').catch((error) => {
    console.warn('[pushNotifications] expo-device module not available:', error?.message ?? error);
    return null;
  });

  return deviceModulePromise;
}

function configureNotificationHandler(Notifications: NotificationsModule): void {
  if (notificationHandlerConfigured) {
    return;
  }

  notificationHandlerConfigured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      priority: Notifications.AndroidNotificationPriority.HIGH,
    }),
  });
}

async function getNotificationsModule(): Promise<NotificationsModule | null> {
  if (notificationsModulePromise) {
    return notificationsModulePromise;
  }

  if (!pushNativeModulesAvailable()) {
    return null;
  }

  notificationsModulePromise = import('expo-notifications')
    .then((Notifications) => {
      configureNotificationHandler(Notifications);
      return Notifications;
    })
    .catch((error) => {
      console.warn('[pushNotifications] expo-notifications module not available:', error?.message ?? error);
      return null;
    });

  return notificationsModulePromise;
}

async function getPushModules(): Promise<{
  Device: DeviceModule | null;
  Notifications: NotificationsModule | null;
}> {
  const [Device, Notifications] = await Promise.all([getDeviceModule(), getNotificationsModule()]);

  return { Device, Notifications };
}

function getProjectId(): string | undefined {
  return Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
}

function getPlatform(): PushPlatform {
  if (Platform.OS === 'ios') {
    return 'ios';
  }

  if (Platform.OS === 'android') {
    return 'android';
  }

  return 'web';
}

async function ensureAndroidNotificationChannel(Notifications: NotificationsModule): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }

  await Notifications.setNotificationChannelAsync('default', {
    name: 'Default',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#630E13',
  });
}

function isNotificationPermissionGranted(permission: NotificationPermissionsStatus): boolean {
  const result = permission as NotificationPermissionsStatus & {
    granted?: boolean;
    status?: string;
  };

  return result.granted === true || result.status === 'granted';
}

async function requestNotificationPermission(Notifications: NotificationsModule): Promise<boolean> {
  const existingPermission = await Notifications.getPermissionsAsync();

  if (!isNotificationPermissionGranted(existingPermission)) {
    const requestedPermission = await Notifications.requestPermissionsAsync();
    return isNotificationPermissionGranted(requestedPermission);
  }

  return true;
}

export async function registerDeviceForPushNotifications(): Promise<string | null> {
  const { Device, Notifications } = await getPushModules();

  if (!Device || !Notifications) {
    console.log('[pushNotifications] Push notifications are disabled in this native build.');
    return null;
  }

  await ensureAndroidNotificationChannel(Notifications);

  if (!Device.isDevice) {
    console.log('[pushNotifications] Push notifications require a physical device.');
    return null;
  }

  const hasPermission = await requestNotificationPermission(Notifications);
  if (!hasPermission) {
    console.log('[pushNotifications] Notification permission was not granted.');
    return null;
  }

  const projectId = getProjectId();
  let resolvedToken = projectId
    ? (await Notifications.getExpoPushTokenAsync({ projectId })).data
    : (() => {
        console.warn('[pushNotifications] Missing EAS projectId; registering the native device push token instead.');
        return null;
      })();

  if (!resolvedToken) {
    const deviceToken = await Notifications.getDevicePushTokenAsync();
    resolvedToken = typeof deviceToken.data === 'string' ? deviceToken.data : JSON.stringify(deviceToken.data);
  }

  await registerPushToken({
    token: resolvedToken,
    platform: getPlatform(),
    deviceId: Device.modelId ?? Device.modelName ?? undefined,
  });

  return resolvedToken;
}

export function getNotificationData(response: NotificationResponse): PushNotificationData {
  return response.notification.request.content.data ?? {};
}

export function addNotificationResponseListener(
  listener: (data: PushNotificationData) => void,
): EventSubscription {
  let subscription: EventSubscription | null = null;
  let removed = false;

  void getNotificationsModule().then((Notifications) => {
    if (!Notifications || removed) {
      return;
    }

    subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      listener(getNotificationData(response));
    });
  });

  return {
    remove() {
      removed = true;
      subscription?.remove();
    },
  } as EventSubscription;
}

export async function getInitialNotificationData(): Promise<PushNotificationData | null> {
  const Notifications = await getNotificationsModule();
  if (!Notifications) {
    return null;
  }

  const response = await Notifications.getLastNotificationResponseAsync();
  return response ? getNotificationData(response) : null;
}

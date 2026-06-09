import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { registerPushToken, type PushPlatform } from '../api/notificationsApi';

export type PushNotificationData = Record<string, unknown>;
export type PushNotificationActivationStatus = 'enabled' | 'disabled' | 'unavailable';
export type NavigationAlertNotificationInput = {
  trailId: string;
  activityId?: string | null;
  navigationSessionId: string;
  title?: string;
  body: string;
  latitude: number;
  longitude: number;
  deviationMeters: number;
  progressPercent: number;
};

type DeviceModule = typeof import('expo-device');
type NotificationsModule = typeof import('expo-notifications');
type NotificationPermissionsStatus = import('expo-notifications').NotificationPermissionsStatus;
type NotificationResponse = import('expo-notifications').NotificationResponse;
type EventSubscription = import('expo-notifications').EventSubscription;

let deviceModulePromise: Promise<DeviceModule | null> | null = null;
let notificationsModulePromise: Promise<NotificationsModule | null> | null = null;
let notificationHandlerConfigured = false;

async function getDeviceModule(): Promise<DeviceModule | null> {
  if (deviceModulePromise) {
    return deviceModulePromise;
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

function getAppVersion(): string | undefined {
  return Constants.expoConfig?.version;
}

function isExpoPushToken(token: string): boolean {
  return /^(ExponentPushToken|ExpoPushToken)\[[^\]]+\]$/.test(token);
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

  await Promise.all([
    Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#630E13',
    }),
    Notifications.setNotificationChannelAsync('navigation', {
      name: 'Navigation alerts',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#8B1E1E',
    }),
  ]);
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

export async function getPushNotificationActivationStatus(): Promise<PushNotificationActivationStatus> {
  const { Device, Notifications } = await getPushModules();

  if (!Device || !Notifications || !Device.isDevice || !getProjectId()) {
    return 'unavailable';
  }

  await ensureAndroidNotificationChannel(Notifications);

  const permission = await Notifications.getPermissionsAsync();
  return isNotificationPermissionGranted(permission) ? 'enabled' : 'disabled';
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
  let resolvedToken: string | null = null;

  if (!projectId) {
    console.warn('[pushNotifications] Missing EAS projectId; Expo push token registration is unavailable.');
    return null;
  }

  if (projectId) {
    try {
      resolvedToken = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    } catch (error) {
      console.warn('[pushNotifications] Failed to get Expo push token:', error);
    }
  }

  if (!resolvedToken || !isExpoPushToken(resolvedToken)) {
    return null;
  }

  await registerPushToken({
    token: resolvedToken,
    platform: getPlatform(),
    provider: 'expo',
    deviceId: Device.modelId ?? Device.modelName ?? undefined,
    appVersion: getAppVersion(),
  });

  return resolvedToken;
}

export async function presentNavigationAlertNotification(input: NavigationAlertNotificationInput): Promise<string | null> {
  const { Device, Notifications } = await getPushModules();

  if (!Device || !Notifications) {
    return null;
  }

  await ensureAndroidNotificationChannel(Notifications);

  const hasPermission = await requestNotificationPermission(Notifications);
  if (!hasPermission) {
    return null;
  }

  return Notifications.scheduleNotificationAsync({
    content: {
      title: input.title ?? 'Navigation alert',
      body: input.body,
      data: {
        type: 'danger_alert',
        notification_kind: 'navigation_off_track',
        trail_id: input.trailId,
        activity_id: input.activityId ?? undefined,
        navigation_session_id: input.navigationSessionId,
        latitude: input.latitude,
        longitude: input.longitude,
        deviation_meters: input.deviationMeters,
        progress_percent: input.progressPercent,
      },
      sound: 'default',
      priority: Notifications.AndroidNotificationPriority.MAX,
    },
    trigger: Platform.OS === 'android' ? { channelId: 'navigation' } : null,
  });
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

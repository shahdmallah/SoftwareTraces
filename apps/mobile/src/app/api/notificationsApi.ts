import { apiRequest } from './client';

export type NotificationType =
  | 'follow'
  | 'message'
  | 'review_like'
  | 'review_comment'
  | 'activity_like'
  | 'activity_comment'
  | 'meetup_invite'
  | 'meetup_join'
  | 'meetup_update'
  | 'sos_alert'
  | 'emergency_contact_alert'
  | 'danger_alert'
  | 'achievement'
  | 'system';

export type NotificationEntityType = 'user' | 'trail' | 'review' | 'activity' | 'meetup' | 'achievement' | string;
export type PushPlatform = 'ios' | 'android' | 'web';
export type PushProvider = 'expo' | 'fcm' | 'apns' | 'webpush';

export type NotificationActor = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
};

export type NotificationEntity = {
  type: NotificationEntityType | null;
  id: string | null;
};

export type AppNotification = {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  actor: NotificationActor | null;
  entity: NotificationEntity | null;
  data: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
};

type RawNotification = Omit<AppNotification, 'entity' | 'data'> & {
  entity?: (NotificationEntity & { data?: Record<string, unknown> | null }) | null;
  data?: Record<string, unknown> | null;
};

type NotificationsResponse = {
  data: RawNotification[];
  unread_count: number;
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
};

type Envelope<T> = {
  data: T;
};

export type PushToken = {
  id: string;
  token: string;
  platform: PushPlatform;
  provider?: PushProvider | null;
  device_id?: string | null;
  app_version?: string | null;
  last_seen_at?: string | null;
  is_active?: boolean;
  created_at: string;
  updated_at?: string | null;
};

export function normalizeNotification(notification: RawNotification): AppNotification {
  return {
    ...notification,
    actor: notification.actor ?? null,
    entity: notification.entity
      ? {
          type: notification.entity.type,
          id: notification.entity.id,
        }
      : null,
    data: notification.data ?? notification.entity?.data ?? {},
    read_at: notification.read_at ?? null,
  };
}

export async function getNotifications(params: { page?: number; limit?: number; unreadOnly?: boolean } = {}) {
  const response = await apiRequest<NotificationsResponse>('/api/notifications', {}, {
    page: params.page,
    limit: params.limit,
    unreadOnly: params.unreadOnly,
  });

  return {
    ...response,
    data: response.data.map(normalizeNotification),
  };
}

export async function markNotificationAsRead(id: string) {
  const response = await apiRequest<Envelope<RawNotification>>(`/api/notifications/${id}/read`, {
    method: 'PATCH',
  });

  return normalizeNotification(response.data);
}

export async function markAllNotificationsAsRead() {
  return apiRequest<{ updated: number }>('/api/notifications/read-all', { method: 'PATCH' });
}

export async function deleteNotification(id: string) {
  return apiRequest<{ deleted?: boolean }>(`/api/notifications/${id}`, { method: 'DELETE' });
}

export async function registerPushToken(payload: {
  token: string;
  platform: PushPlatform;
  provider?: PushProvider;
  deviceId?: string;
  appVersion?: string;
}) {
  const response = await apiRequest<Envelope<PushToken>>('/api/notifications/push-token', {
    method: 'POST',
    body: JSON.stringify({
      token: payload.token,
      platform: payload.platform,
      provider: payload.provider,
      device_id: payload.deviceId,
      app_version: payload.appVersion,
    }),
  });

  return response.data;
}

export async function removePushToken(token: string) {
  return apiRequest<{ deleted?: boolean; removed?: boolean }>('/api/notifications/push-token', {
    method: 'DELETE',
    body: JSON.stringify({ token }),
  });
}

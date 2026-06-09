import { apiRequest } from './client';

type Envelope<T> = { data: T };

export type Notification = {
  id: string;
  type: string;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

export async function getNotifications(params: { page?: number; limit?: number; unread_only?: boolean } = {}) {
  const response = await apiRequest<{ data: Notification[]; pagination?: { total: number } }>(
    '/api/notifications',
    {},
    params,
  );
  return response;
}

export async function markNotificationRead(id: string) {
  return apiRequest(`/api/notifications/${id}/read`, { method: 'PATCH' });
}

export async function markAllNotificationsRead() {
  return apiRequest<{ updated: number }>('/api/notifications/read-all', { method: 'PATCH' });
}

export async function deleteNotification(id: string) {
  return apiRequest(`/api/notifications/${id}`, { method: 'DELETE' });
}

export async function registerPushToken(payload: { token: string; platform: 'web' | 'ios' | 'android'; device_id?: string }) {
  const response = await apiRequest<Envelope<unknown>>('/api/notifications/push-token', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return response.data;
}

export async function removePushToken(token: string) {
  return apiRequest('/api/notifications/push-token', {
    method: 'DELETE',
    body: JSON.stringify({ token }),
  });
}

import { apiRequest } from './client';

type Envelope<T> = { data: T; pagination?: unknown };

export type Activity = {
  id: string;
  trail_id?: string | null;
  title?: string | null;
  started_at: string;
  ended_at?: string | null;
  duration_sec?: number | null;
  distance_km?: number | null;
  distance_meters?: number | null;
  elevation_gain_m?: number | null;
  elevation_gain_meters?: number | null;
  avg_speed_kph?: number | null;
  avg_speed_mps?: number | null;
  max_speed_kph?: number | null;
  status?: string | null;
};

export async function getMyActivities() {
  const response = await apiRequest<Envelope<Activity[]>>('/api/activities/me');
  return response.data;
}

export async function startActivity(trailId?: string) {
  const response = await apiRequest<Envelope<Activity>>('/api/activities', {
    method: 'POST',
    body: JSON.stringify({ trail_id: trailId, started_at: new Date().toISOString() }),
  });
  return response.data;
}

export async function updateActivityStatus(id: string, status: string) {
  return apiRequest(`/api/activities/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, occurred_at: new Date().toISOString() }),
  });
}

export async function sendSosAlert(payload: { activityId?: string | null; location?: [number, number] | null; message?: string } = {}) {
  const [longitude, latitude] = payload.location ?? [];

  return apiRequest('/api/sos', {
    method: 'POST',
    body: JSON.stringify({
      activity_id: payload.activityId ?? undefined,
      latitude,
      longitude,
      message: payload.message,
      occurred_at: new Date().toISOString(),
    }),
  });
}

export async function completeActivity(id: string, payload: Record<string, unknown>) {
  return apiRequest<Envelope<Activity>>(`/api/activities/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function deleteActivity(id: string) {
  return apiRequest(`/api/activities/${id}`, { method: 'DELETE' });
}

export async function deleteActivityPost(postId: string) {
  return apiRequest<{ message: string }>(`/api/activities/posts/${postId}`, { method: 'DELETE' });
}

export async function getActivityJournal(params: { page?: number; limit?: number } = {}) {
  const response = await apiRequest<Envelope<Activity[]>>('/api/activities/journal', {}, params);
  return response.data;
}

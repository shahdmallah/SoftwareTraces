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

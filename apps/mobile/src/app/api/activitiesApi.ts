import { apiRequest, apiTextRequest } from './client';

type Envelope<T> = {
  data: T;
};

export type ActivityPointPayload = {
  lat: number;
  lng: number;
  elevation?: number;
  accuracy?: number;
  speedMps?: number;
  recordedAt: string;
};

export type Activity = {
  id: string;
  user_id: string;
  trail_id?: string | null;
  title: string;
  started_at: string;
  ended_at?: string | null;
  distance_km?: number | null;
  elevation_gain_m?: number | null;
  avg_speed_kph?: number | null;
  max_speed_kph?: number | null;
  status: string;
};

export async function getUserActivities(userId: string) {
  const response = await apiRequest<Envelope<Activity[]>>(`/api/activities/user/${userId}`);
  return response.data;
}

export async function getActivityById(activityId: string) {
  const response = await apiRequest<Envelope<Activity>>(`/api/activities/${activityId}`);
  return response.data;
}

export async function createActivity(payload: { title: string; startedAt: string; trailId?: string }) {
  const response = await apiRequest<Envelope<Activity>>('/api/activities', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return response.data;
}

export async function addActivityPoints(activityId: string, points: ActivityPointPayload[]) {
  await apiRequest<void>(`/api/activities/${activityId}/points`, {
    method: 'POST',
    body: JSON.stringify({ points }),
  });
}

export async function completeActivity(activityId: string, payload: {
  endedAt: string;
  distanceKm: number;
  elevationGainM: number;
  avgSpeedKph: number;
  maxSpeedKph: number;
}) {
  const response = await apiRequest<Envelope<Activity>>(`/api/activities/${activityId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  return response.data;
}

export async function deleteActivity(activityId: string) {
  await apiRequest<void>(`/api/activities/${activityId}`, { method: 'DELETE' });
}

export async function getActivityGpx(activityId: string) {
  return apiTextRequest(`/api/activities/${activityId}/gpx`);
}

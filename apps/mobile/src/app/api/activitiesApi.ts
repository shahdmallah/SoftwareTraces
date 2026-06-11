import { apiRequest, apiTextRequest } from './client';
import type { NatureSighting } from './natureSightingsApi';

type Envelope<T> = {
  data: T;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
};

/** Raw row shapes returned by `GET /api/activities/user/:userId` (database columns). */
export type ActivityRow = {
  id: string;
  user_id?: string;
  trail_id?: string | null;
  status: string;
  start_time?: string | null;
  end_time?: string | null;
  distance_meters?: number | string | null;
  elapsed_time_seconds?: number | null;
  elevation_gain_meters?: number | string | null;
  elevation_loss_meters?: number | string | null;
  max_elevation_meters?: number | string | null;
  min_elevation_meters?: number | string | null;
  max_speed_mps?: number | string | null;
  avg_speed_mps?: number | string | null;
  trail_name?: string | null;
};

/** Normalized for History, Profile, and list UIs. */
export type Activity = {
  id: string;
  user_id: string;
  trail_id?: string | null;
  trail_name?: string | null;
  status: string;
  started_at: string;
  ended_at?: string | null;
  distance_km?: number | null;
  elevation_gain_m?: number | null;
  avg_speed_kph?: number | null;
  max_speed_kph?: number | null;
  elapsed_time_seconds?: number | null;
};

export type ActivityPointPayload = {
  lat: number;
  lng: number;
  elevation?: number;
  accuracy?: number;
  speedMps?: number;
  recordedAt: string;
};

export type ActivityMediaFile = {
  uri: string;
  name: string;
  type: string;
};

export type ActivityMedia = {
  id: string;
  url: string;
  latitude: number | string | null;
  longitude: number | string | null;
  captured_at?: string | null;
  caption?: string | null;
  created_at?: string | null;
  source?: 'activity_media';
  nature_sighting?: NatureSighting | null;
};

export type ActivityDetailPoint = {
  latitude: number;
  longitude: number;
  elevation?: number | null;
  speed_mps?: number | null;
  recorded_at: string;
};

export type ActivityDetail = {
  id: string;
  trail_id?: string | null;
  user_id: string;
  full_name?: string | null;
  distance_meters?: number | null;
  elapsed_time_seconds?: number | null;
  elevation_gain_meters?: number | null;
  start_time?: string;
  end_time?: string | null;
  status: string;
  points: ActivityDetailPoint[];
};

export type ActivityJournalRow = {
  id: string;
  activity_id: string;
  visibility?: 'private' | string;
  caption?: string | null;
  created_at: string;
  trail_id?: string | null;
  trail_name?: string | null;
  trail_image?: string | null;
  distance_meters?: number | string | null;
  elapsed_time_seconds?: number | null;
  elevation_gain_meters?: number | string | null;
  start_time?: string | null;
  end_time?: string | null;
  photo_url?: string | null;
};

export type ActivityJournalEntry = {
  id: string;
  activityId: string;
  trailId?: string | null;
  trailName: string;
  note: string;
  createdAt: string;
  completedAt?: string | null;
  photoUris: string[];
  distanceKm?: number | null;
  elapsedTimeSeconds?: number | null;
  elevationGainM?: number | null;
};

function num(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : Number.parseFloat(String(value));
  return Number.isFinite(n) ? n : null;
}

export function normalizeActivityRow(row: ActivityRow): Activity {
  const start = row.start_time ?? '';
  const end = row.end_time ?? null;
  const dm = num(row.distance_meters);
  const avgMps = num(row.avg_speed_mps);
  const maxMps = num(row.max_speed_mps);

  return {
    id: row.id,
    user_id: row.user_id ?? '',
    trail_id: row.trail_id,
    trail_name: row.trail_name,
    status: row.status,
    started_at: start,
    ended_at: end,
    distance_km: dm != null ? dm / 1000 : null,
    elevation_gain_m: num(row.elevation_gain_meters),
    avg_speed_kph: avgMps != null ? avgMps * 3.6 : null,
    max_speed_kph: maxMps != null ? maxMps * 3.6 : null,
    elapsed_time_seconds: row.elapsed_time_seconds ?? undefined,
  };
}

export async function getUserActivities(_userId: string) {
  const response = await apiRequest<Envelope<ActivityRow[]>>(`/api/activities/user/${_userId}`);
  return response.data.map(normalizeActivityRow);
}

export async function getMyActivities(params: { page?: number; limit?: number; status?: string } = {}) {
  const response = await apiRequest<Envelope<ActivityRow[]>>('/api/activities/me', {}, params);
  return response.data.map(normalizeActivityRow);
}

export function normalizeActivityJournalRow(row: ActivityJournalRow): ActivityJournalEntry {
  const image = row.photo_url || row.trail_image || '';
  const distanceMeters = num(row.distance_meters);

  return {
    id: row.id,
    activityId: row.activity_id,
    trailId: row.trail_id,
    trailName: row.trail_name?.trim() || 'Private hike',
    note: row.caption?.trim() || 'Private hike post',
    createdAt: row.created_at,
    completedAt: row.end_time ?? row.start_time ?? null,
    photoUris: image ? [image] : [],
    distanceKm: distanceMeters != null ? distanceMeters / 1000 : null,
    elapsedTimeSeconds: row.elapsed_time_seconds ?? null,
    elevationGainM: num(row.elevation_gain_meters),
  };
}

export async function getMyActivityJournal(params: { page?: number; limit?: number } = {}) {
  const response = await apiRequest<Envelope<ActivityJournalRow[]>>('/api/activities/journal', {}, params);
  return response.data.map(normalizeActivityJournalRow);
}

export async function getActivityById(activityId: string) {
  const response = await apiRequest<Envelope<ActivityDetail>>(`/api/activities/${activityId}`);
  return response.data;
}

export async function getActivityMedia(activityId: string) {
  const response = await apiRequest<Envelope<ActivityMedia[]>>(`/api/activities/${activityId}/media`);
  return response.data;
}

/**
 * Starts a recording session. The server expects `started_at` (ISO-8601) and optional `trail_id`.
 * Some deployments also validate camelCase fields on the same route; callers may need to align with their API build.
 */
export async function createActivity(payload: { startedAt: string; trailId?: string; title?: string }) {
  const body: Record<string, string | undefined> = {
    started_at: payload.startedAt,
    trail_id: payload.trailId,
    title: payload.title?.trim() || 'Recording',
    startedAt: payload.startedAt,
    trailId: payload.trailId,
  };
  Object.keys(body).forEach((key) => {
    if (body[key] === undefined) {
      delete body[key];
    }
  });
  return apiRequest<ActivityRow>('/api/activities', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function addActivityPoints(activityId: string, points: ActivityPointPayload[]) {
  await apiRequest<void>(`/api/activities/${activityId}/points`, {
    method: 'POST',
    body: JSON.stringify({
      points: points.map((p) => ({
        latitude: p.lat,
        longitude: p.lng,
        elevation: p.elevation,
        accuracy: p.accuracy,
        speed_mps: p.speedMps,
        recorded_at: p.recordedAt,
      })),
    }),
  });
}

export async function completeActivity(
  activityId: string,
  payload: {
    endedAt: string;
    distanceMeters: number;
    elevationGainMeters: number;
    elevationLossMeters: number;
    maxElevationMeters: number;
    minElevationMeters: number;
    maxSpeedMps: number;
    avgSpeedMps: number;
  },
) {
  return apiRequest<ActivityRow>(`/api/activities/${activityId}`, {
    method: 'PUT',
    body: JSON.stringify({
      ended_at: payload.endedAt,
      distance_meters: payload.distanceMeters,
      elevation_gain_meters: payload.elevationGainMeters,
      elevation_loss_meters: payload.elevationLossMeters,
      max_elevation_meters: payload.maxElevationMeters,
      min_elevation_meters: payload.minElevationMeters,
      max_speed_mps: payload.maxSpeedMps,
      avg_speed_mps: payload.avgSpeedMps,
    }),
  });
}

export async function updateActivityStatus(activityId: string, status: 'paused' | 'recording') {
  return apiRequest<Envelope<{ id: string; status: string; paused_duration_sec?: number; updated_at?: string }>>(
    `/api/activities/${activityId}/status`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        status,
        occurred_at: new Date().toISOString(),
      }),
    },
  );
}

export async function shareActivityPost(
  activityId: string,
  payload: {
    visibility?: 'public' | 'friends' | 'private';
    caption?: string;
    reviewId?: string;
  } = {},
) {
  const body: Record<string, string | undefined> = {
    visibility: payload.visibility ?? 'public',
    caption: payload.caption?.trim() || undefined,
    review_id: payload.reviewId,
  };
  Object.keys(body).forEach((key) => {
    if (body[key] === undefined) {
      delete body[key];
    }
  });

  return apiRequest<Envelope<{ post_id: string; activity_id: string; visibility: string; created_at: string }>>(
    `/api/activities/${activityId}/share`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
  );
}

export async function uploadActivityMedia(
  activityId: string,
  payload: {
    photo: ActivityMediaFile;
    latitude: number;
    longitude: number;
    capturedAt: string;
    caption?: string;
  },
) {
  const formData = new FormData();
  formData.append('photo', payload.photo as unknown as Blob);
  formData.append('latitude', String(payload.latitude));
  formData.append('longitude', String(payload.longitude));
  formData.append('captured_at', payload.capturedAt);

  if (payload.caption?.trim()) {
    formData.append('caption', payload.caption.trim());
  }

  const response = await apiRequest<Envelope<{
    id: string;
    activity_id?: string;
    trail_id?: string | null;
    public_url: string;
    latitude: number;
    longitude: number;
    captured_at: string;
    caption?: string | null;
    source?: 'activity_media';
    nature_sighting?: NatureSighting | null;
  }>>(`/api/activities/${activityId}/media`, {
    method: 'POST',
    body: formData,
  });

  return response.data;
}

export async function deleteActivity(activityId: string) {
  await apiRequest<void>(`/api/activities/${activityId}`, { method: 'DELETE' });
}

export async function deleteActivityPost(postId: string) {
  return apiRequest<{ message: string }>(`/api/activities/posts/${postId}`, { method: 'DELETE' });
}

export async function getActivityGpx(activityId: string) {
  return apiTextRequest(`/api/activities/${activityId}/gpx`);
}

import { apiRequest, apiTextRequest } from './client';

type Envelope<T> = {
  data: T;
};

/** Raw row shapes returned by `GET /api/activities/user/:userId` (database columns). */
export type ActivityRow = {
  id: string;
  user_id: string;
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

export type ActivityDetailPoint = {
  latitude: number;
  longitude: number;
  elevation?: number | null;
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
    user_id: row.user_id,
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
  const response = await apiRequest<Envelope<ActivityRow[]>>('/api/activities');
  return response.data.map(normalizeActivityRow);
}

export async function getActivityById(activityId: string) {
  const response = await apiRequest<Envelope<ActivityDetail>>(`/api/activities/${activityId}`);
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

export async function deleteActivity(activityId: string) {
  await apiRequest<void>(`/api/activities/${activityId}`, { method: 'DELETE' });
}

export async function getActivityGpx(activityId: string) {
  return apiTextRequest(`/api/activities/${activityId}/gpx`);
}

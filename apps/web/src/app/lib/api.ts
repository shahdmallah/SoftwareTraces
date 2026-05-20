import type { Trail as LocalTrail } from '../data/trails';
import { getSession } from './auth';

const API_BASE_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000').replace(/\/$/, '');

export type ApiTrail = Partial<Omit<LocalTrail, 'difficulty'>> & {
  id: string;
  name?: string | null;
  difficulty?: string | null;
  routeCoordinates?: Array<[number, number]>;
  createdAt?: string;
  updatedAt?: string;
};

export type ActivityRow = {
  id: string;
  trail_id?: string | null;
  trail_name?: string | null;
  trail_image?: string | null;
  photo_url?: string | null;
  caption?: string | null;
  distance_meters?: number | string | null;
  elapsed_time_seconds?: number | string | null;
  elevation_gain_meters?: number | string | null;
  start_time?: string | null;
  started_at?: string | null;
  end_time?: string | null;
  ended_at?: string | null;
  created_at?: string | null;
  status?: string | null;
};

export type JournalResponse = {
  data: ActivityRow[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
};

export type TrailReview = {
  id: string;
  rating: number;
  title?: string | null;
  content?: string | null;
  created_at?: string | null;
};

export type ElevationProfile = {
  elevations: number[];
  distances: number[];
  total_gain: number;
  total_loss: number;
  min_elevation: number;
  max_elevation: number;
};

type ApiEnvelope<T> = { data: T };

function authHeader(): HeadersInit {
  const session = getSession();
  return session?.token ? { Authorization: `Bearer ${session.token}` } : {};
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...authHeader(),
      ...(init.headers ?? {}),
    },
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message = payload?.error ?? payload?.message ?? `Request failed (${response.status})`;
    throw new Error(message);
  }

  return payload as T;
}

function normalizeDifficulty(value: string | null | undefined): LocalTrail['difficulty'] {
  const lower = String(value ?? '').toLowerCase();
  if (lower === 'moderate') return 'Moderate';
  if (lower === 'hard') return 'Hard';
  if (lower === 'expert') return 'Expert';
  return 'Easy';
}

export function normalizeTrail(trail: ApiTrail): LocalTrail {
  const coordinates = trail.coordinates ?? [0, 0];
  const images = trail.images?.filter(Boolean) ?? [];
  const image = trail.image ?? images[0] ?? '';

  return {
    id: trail.id,
    name: trail.name ?? 'Untitled trail',
    nameAr: trail.nameAr ?? '',
    region: trail.region ?? '',
    regionAr: trail.regionAr ?? '',
    description: trail.description ?? '',
    descriptionAr: trail.descriptionAr ?? '',
    distance: Number(trail.distance ?? 0),
    duration: trail.duration ?? '',
    elevationGain: Number(trail.elevationGain ?? 0),
    elevationMin: Number(trail.elevationMin ?? 0),
    elevationMax: Number(trail.elevationMax ?? 0),
    difficulty: normalizeDifficulty(trail.difficulty),
    rating: Number(trail.rating ?? 0),
    reviews: Number(trail.reviews ?? 0),
    image,
    images: image && images.length === 0 ? [image] : images,
    features: trail.features ?? [],
    featuresAr: trail.featuresAr ?? [],
    hasCheckpoint: Boolean(trail.hasCheckpoint),
    checkpointNote: trail.checkpointNote ?? '',
    coordinates,
    mapX: Number(trail.mapX ?? 0),
    mapY: Number(trail.mapY ?? 0),
    tags: trail.tags ?? [],
  };
}

export async function fetchTrails(): Promise<LocalTrail[]> {
  const payload = await apiRequest<ApiEnvelope<ApiTrail[]>>('/api/trails');
  return payload.data.map(normalizeTrail);
}

export async function fetchTrail(id: string): Promise<LocalTrail> {
  const payload = await apiRequest<ApiEnvelope<ApiTrail>>(`/api/trails/${id}`);
  return normalizeTrail(payload.data);
}

export async function fetchTrailReviews(id: string): Promise<TrailReview[]> {
  const payload = await apiRequest<ApiEnvelope<TrailReview[]>>(`/api/trails/${id}/reviews`);
  return payload.data;
}

export async function fetchElevationProfile(id: string): Promise<ElevationProfile> {
  const payload = await apiRequest<ApiEnvelope<ElevationProfile>>(`/api/trails/${id}/elevation-profile`);
  return payload.data;
}

export async function saveTrail(id: string): Promise<void> {
  await apiRequest(`/api/trails/${id}/save`, { method: 'POST' });
}

export async function fetchNearbyTrails(lat: number, lng: number, radius = 25000): Promise<LocalTrail[]> {
  const payload = await apiRequest<ApiEnvelope<ApiTrail[]>>(`/api/trails/nearby?lat=${lat}&lng=${lng}&radius=${radius}`);
  return payload.data.map(normalizeTrail);
}

export async function fetchSavedTrails(): Promise<LocalTrail[]> {
  const payload = await apiRequest<ApiEnvelope<ApiTrail[]>>('/api/trails/saved');
  return payload.data.map(normalizeTrail);
}

export async function fetchMyTrails(): Promise<LocalTrail[]> {
  const payload = await apiRequest<ApiEnvelope<ApiTrail[]>>('/api/trails/mine');
  return payload.data.map(normalizeTrail);
}

export async function fetchMyActivities(status?: string): Promise<JournalResponse> {
  const suffix = status ? `?status=${encodeURIComponent(status)}` : '';
  return apiRequest<JournalResponse>(`/api/activities/me${suffix}`);
}

export async function fetchJournal(): Promise<JournalResponse> {
  return apiRequest<JournalResponse>('/api/activities/journal');
}

export async function startActivity(trailId?: string) {
  return apiRequest<ApiEnvelope<ActivityRow>>('/api/activities', {
    method: 'POST',
    body: JSON.stringify({
      ...(trailId ? { trail_id: trailId } : {}),
      started_at: new Date().toISOString(),
    }),
  });
}

export async function syncActivityPoints(activityId: string, points: Array<{ latitude: number; longitude: number; elevation?: number; accuracy?: number; speed_mps?: number; recorded_at: string }>) {
  return apiRequest<ApiEnvelope<unknown>>(`/api/activities/${activityId}/points`, {
    method: 'POST',
    body: JSON.stringify({ points }),
  });
}

export async function completeActivity(activityId: string, payload: {
  ended_at: string;
  distance_meters: number;
  elevation_gain_meters: number;
  elevation_loss_meters: number;
  max_elevation_meters: number;
  min_elevation_meters: number;
  max_speed_mps: number;
  avg_speed_mps: number;
}) {
  return apiRequest<ApiEnvelope<ActivityRow>>(`/api/activities/${activityId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function fetchSocialFeed(): Promise<{ data: unknown[] }> {
  return apiRequest<{ data: unknown[] }>('/api/social/feed');
}

export async function fetchPendingOfflineSync(): Promise<{ data: unknown[] }> {
  return apiRequest<{ data: unknown[] }>('/api/offline/sync');
}

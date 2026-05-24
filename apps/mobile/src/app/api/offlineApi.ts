import { apiRequest } from './client';
import { getAccessToken, getApiBaseUrl } from '../lib/auth';

type Envelope<T> = {
  data: T;
};

export type OfflineActivityPayload = {
  id?: string;
  title: string;
  startedAt: string;
  endedAt?: string;
  updatedAt?: string;
  trailId?: string;
  durationSec?: number;
  distanceKm?: number;
  elevationGainM?: number;
  avgSpeedKph?: number;
  maxSpeedKph?: number;
  status?: 'active' | 'paused' | 'completed' | 'cancelled' | 'draft' | 'recording' | 'synced';
  matchedTrailConfidence?: number;
  points?: Array<{
    lat: number;
    lng: number;
    elevation?: number;
    accuracy?: number;
    speedMps?: number;
    recordedAt: string;
  }>;
};

type OfflineRoutePayload = {
  trailId: string;
  trailName?: string;
  trailNameAr?: string;
  region?: string;
  regionAr?: string;
  coordinates?: [number, number];
  routeCoordinates?: [number, number][];
  route?: [number, number][];
  tileRegion: string;
  tileUrlTemplate: string;
};

export type OfflineMapRecord = {
  id: string;
  user_id: string;
  trail_id: string;
  trail_name?: string | null;
  downloaded_at?: string | null;
  expires_at?: string | null;
  created_at?: string | null;
  metadata?: {
    tile_count?: number;
    bytes?: number;
    has_tiles?: boolean;
  } | null;
};

export type OfflineSyncResult = {
  uploaded: string[];
  conflicts: string[];
};

function isLikelyWestBankLngLat(point: [number, number]) {
  const [lng, lat] = point;
  return lng >= 34 && lng <= 36.8 && lat >= 29 && lat <= 33.8;
}

function isLikelyWestBankLatLng(point: [number, number]) {
  const [lat, lng] = point;
  return lat >= 29 && lat <= 33.8 && lng >= 34 && lng <= 36.8;
}

function normalizeRoutePoint(point: [number, number]): [number, number] {
  if (isLikelyWestBankLatLng(point) && !isLikelyWestBankLngLat(point)) {
    return [point[1], point[0]];
  }

  return point;
}

function normalizeRouteCoordinates(routeCoordinates?: [number, number][]) {
  if (!Array.isArray(routeCoordinates)) {
    return undefined;
  }

  return routeCoordinates.map(normalizeRoutePoint);
}

async function requestOfflineArchive(trailId: string) {
  const token = await getAccessToken();
  const headers = new Headers();

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${getApiBaseUrl()}/api/offline/maps/${trailId}`, {
    method: 'POST',
    headers,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    let message = body || 'Unable to download offline map.';
    try {
      const payload = JSON.parse(body) as { error?: string; details?: string };
      message = payload.details || payload.error || message;
    } catch {
      // Keep the text response as the fallback message.
    }
    throw new Error(message);
  }

  await response.arrayBuffer().catch(() => undefined);
}

export async function getPendingSync(params: { since?: string } = {}) {
  const response = await apiRequest<Envelope<Record<string, unknown>[]>>('/api/offline/sync', {}, params);
  return response.data;
}

export async function syncOfflineActivities(activities: OfflineActivityPayload[]) {
  const response = await apiRequest<Envelope<OfflineSyncResult>>('/api/offline/sync', {
    method: 'POST',
    body: JSON.stringify({ activities }),
  });
  return response.data;
}

export async function getUserOfflineMaps() {
  const response = await apiRequest<Envelope<OfflineMapRecord[]>>('/api/offline/maps');
  return response.data;
}

export async function deleteOfflineMap(id: string) {
  await apiRequest<void>(`/api/offline/maps/${id}`, { method: 'DELETE' });
}

export async function downloadOfflineMap(trailId: string) {
  await requestOfflineArchive(trailId);

  return {
    trailId,
    trailName: undefined,
    trailNameAr: undefined,
    region: undefined,
    regionAr: undefined,
    coordinates: undefined,
    tileRegion: `trail-${trailId}`,
    tileUrlTemplate: '',
    routeCoordinates: normalizeRouteCoordinates(undefined),
  };
}

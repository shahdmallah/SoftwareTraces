import { apiRequest } from './client';

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
  status?: 'active' | 'paused' | 'completed' | 'cancelled';
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

export async function getPendingSync(params: { since?: string } = {}) {
  const response = await apiRequest<Envelope<Record<string, unknown>[]>>('/api/offline/sync', {}, params);
  return response.data;
}

export async function syncOfflineActivities(activities: OfflineActivityPayload[]) {
  const response = await apiRequest<Envelope<Record<string, unknown>>>('/api/offline/sync', {
    method: 'POST',
    body: JSON.stringify({ activities }),
  });
  return response.data;
}

export async function downloadOfflineMap(trailId: string) {
  const response = await apiRequest<Envelope<OfflineRoutePayload>>(`/api/offline/maps/${trailId}`);
  const routeCoordinates = response.data.routeCoordinates ?? response.data.route;

  return {
    ...response.data,
    routeCoordinates: normalizeRouteCoordinates(routeCoordinates),
  };
}

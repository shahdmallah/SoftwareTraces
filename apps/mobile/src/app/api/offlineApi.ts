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
  const response = await apiRequest<Envelope<{
    trailId: string;
    tileRegion: string;
    tileUrlTemplate: string;
  }>>(`/api/offline/maps/${trailId}`);
  return response.data;
}

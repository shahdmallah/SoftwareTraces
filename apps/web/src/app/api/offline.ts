import { apiRequest } from './client';

type Envelope<T> = { data: T };

export async function downloadOfflineMap(trailId: string) {
  const response = await apiRequest<Envelope<{
    trailId: string;
    trailName?: string;
    trailNameAr?: string;
    region?: string;
    tileRegion: string;
    tileUrlTemplate: string;
  }>>(`/api/offline/maps/${trailId}`);
  return response.data;
}

export async function getPendingSync() {
  const response = await apiRequest<Envelope<any[]>>('/api/offline/sync');
  return response.data;
}

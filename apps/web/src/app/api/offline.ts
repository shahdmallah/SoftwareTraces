import { apiRequest, getAccessToken, getApiBaseUrl } from './client';

type Envelope<T> = { data: T };

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

export async function downloadOfflineMap(trailId: string) {
  const headers = new Headers();
  const token = getAccessToken();

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${getApiBaseUrl()}/api/offline/maps/${trailId}`, {
    method: 'POST',
    headers,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(body || 'Unable to download offline map.');
  }

  await response.arrayBuffer().catch(() => undefined);
}

export async function getUserOfflineMaps() {
  const response = await apiRequest<Envelope<OfflineMapRecord[]>>('/api/offline/maps');
  return response.data;
}

export async function deleteOfflineMap(id: string) {
  await apiRequest<void>(`/api/offline/maps/${id}`, { method: 'DELETE' });
}

export async function getPendingSync() {
  const response = await apiRequest<Envelope<any[]>>('/api/offline/sync');
  return response.data;
}

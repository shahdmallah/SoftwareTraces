import * as SecureStore from 'expo-secure-store';

export type OfflineMapPack = {
  trailId: string;
  trailName: string;
  trailNameAr?: string;
  region?: string;
  regionAr?: string;
  coordinates?: [number, number];
  tileRegion: string;
  tileUrlTemplate: string;
  downloadedAt: string;
};

const OFFLINE_MAPS_KEY = 'traces.offline.maps';

function parseOfflineMaps(rawValue: string | null): OfflineMapPack[] {
  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue) as OfflineMapPack[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function getOfflineMapPacks() {
  return parseOfflineMaps(await SecureStore.getItemAsync(OFFLINE_MAPS_KEY));
}

export async function saveOfflineMapPack(pack: OfflineMapPack) {
  const current = await getOfflineMapPacks();
  const next = [pack, ...current.filter((item) => item.trailId !== pack.trailId)];
  await SecureStore.setItemAsync(OFFLINE_MAPS_KEY, JSON.stringify(next));
  return next;
}

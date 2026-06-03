import * as SecureStore from 'expo-secure-store';
import type { NearbySafetyAlert } from '../api/safetyApi';
import type { Trail } from '../api/trailsApi';

export type OfflineMapPack = {
  trailId: string;
  trailName: string;
  trailNameAr?: string;
  region?: string;
  regionAr?: string;
  coordinates?: [number, number];
  routeCoordinates?: [number, number][];
  tileRegion: string;
  tileUrlTemplate: string;
  downloadedAt: string;
  trail?: Trail;
  safetyAlerts?: NearbySafetyAlert[];
  safetyMarkers?: unknown[];
  checkpointReports?: unknown[];
  accessRoute?: unknown;
  elevationProfile?: unknown[];
  safetySnapshot?: unknown;
  generatedAt?: string;
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

export async function removeOfflineMapPack(trailId: string) {
  const current = await getOfflineMapPacks();
  const next = current.filter((item) => item.trailId !== trailId);
  await SecureStore.setItemAsync(OFFLINE_MAPS_KEY, JSON.stringify(next));
  return next;
}

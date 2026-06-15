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

const LEGACY_OFFLINE_MAPS_KEY = 'traces.offline.maps';
const OFFLINE_MAPS_INDEX_KEY = 'traces.offline.maps.v2.index';
const OFFLINE_MAP_PACK_KEY_PREFIX = 'traces.offline.maps.v2.pack';
const SECURE_STORE_CHUNK_SIZE = 1800;

type OfflineMapIndexEntry = {
  trailId: string;
  trailName: string;
  downloadedAt: string;
  storageKey: string;
};

type ChunkMetadata = {
  chunkCount: number;
};

function storageKeyForTrail(trailId: string) {
  const safeTrailId = trailId.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${OFFLINE_MAP_PACK_KEY_PREFIX}.${safeTrailId}`;
}

async function getChunkCount(key: string) {
  const rawMetadata = await SecureStore.getItemAsync(key);

  if (!rawMetadata) {
    return 0;
  }

  try {
    const metadata = JSON.parse(rawMetadata) as ChunkMetadata;
    return Number.isFinite(metadata.chunkCount) ? metadata.chunkCount : 0;
  } catch {
    return 0;
  }
}

async function removeChunkedValue(key: string) {
  const chunkCount = await getChunkCount(key).catch(() => 0);

  for (let index = 0; index < chunkCount; index += 1) {
    await SecureStore.deleteItemAsync(`${key}.${index}`).catch(() => undefined);
  }

  await SecureStore.deleteItemAsync(key).catch(() => undefined);
}

async function readChunkedValue(key: string) {
  const rawMetadata = await SecureStore.getItemAsync(key);

  if (!rawMetadata) {
    return null;
  }

  try {
    const metadata = JSON.parse(rawMetadata) as ChunkMetadata;

    if (!Number.isFinite(metadata.chunkCount) || metadata.chunkCount <= 0) {
      return null;
    }

    const chunks = await Promise.all(
      Array.from({ length: metadata.chunkCount }, (_, index) => SecureStore.getItemAsync(`${key}.${index}`)),
    );

    if (chunks.some((chunk) => chunk == null)) {
      return null;
    }

    return chunks.join('');
  } catch {
    return rawMetadata;
  }
}

async function writeChunkedValue(key: string, value: string) {
  await removeChunkedValue(key);
  const chunks = value.match(new RegExp(`.{1,${SECURE_STORE_CHUNK_SIZE}}`, 'g')) ?? [''];

  await Promise.all(
    chunks.map((chunk, index) => SecureStore.setItemAsync(`${key}.${index}`, chunk)),
  );
  await SecureStore.setItemAsync(key, JSON.stringify({ chunkCount: chunks.length }));
}

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

function parseOfflineMapIndex(rawValue: string | null): OfflineMapIndexEntry[] {
  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue) as OfflineMapIndexEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function getOfflineMapIndex() {
  return parseOfflineMapIndex(await readChunkedValue(OFFLINE_MAPS_INDEX_KEY));
}

async function saveOfflineMapIndex(entries: OfflineMapIndexEntry[]) {
  await writeChunkedValue(OFFLINE_MAPS_INDEX_KEY, JSON.stringify(entries));
}

async function migrateLegacyOfflineMaps() {
  const existingIndex = await getOfflineMapIndex();

  if (existingIndex.length) {
    return;
  }

  const legacyPacks = parseOfflineMaps(await SecureStore.getItemAsync(LEGACY_OFFLINE_MAPS_KEY));

  if (!legacyPacks.length) {
    return;
  }

  const indexEntries: OfflineMapIndexEntry[] = [];

  for (const pack of legacyPacks) {
    const storageKey = storageKeyForTrail(pack.trailId);
    await writeChunkedValue(storageKey, JSON.stringify(pack));
    indexEntries.push({
      trailId: pack.trailId,
      trailName: pack.trailName,
      downloadedAt: pack.downloadedAt,
      storageKey,
    });
  }

  await saveOfflineMapIndex(indexEntries);
  await SecureStore.deleteItemAsync(LEGACY_OFFLINE_MAPS_KEY).catch(() => undefined);
}

export async function getOfflineMapPacks() {
  await migrateLegacyOfflineMaps();

  const index = await getOfflineMapIndex();
  const packs = await Promise.all(
    index.map(async (entry) => {
      const rawPack = await readChunkedValue(entry.storageKey);

      if (!rawPack) {
        return null;
      }

      try {
        return JSON.parse(rawPack) as OfflineMapPack;
      } catch {
        return null;
      }
    }),
  );

  return packs.filter((pack): pack is OfflineMapPack => pack !== null);
}

export async function saveOfflineMapPack(pack: OfflineMapPack) {
  await migrateLegacyOfflineMaps();
  const current = await getOfflineMapPacks();
  const next = [pack, ...current.filter((item) => item.trailId !== pack.trailId)];
  const activeTrailIds = new Set(next.map((item) => item.trailId));

  await writeChunkedValue(storageKeyForTrail(pack.trailId), JSON.stringify(pack));
  await Promise.all(
    current
      .filter((item) => !activeTrailIds.has(item.trailId))
      .map((item) => removeChunkedValue(storageKeyForTrail(item.trailId))),
  );
  await saveOfflineMapIndex(
    next.map((item) => ({
      trailId: item.trailId,
      trailName: item.trailName,
      downloadedAt: item.downloadedAt,
      storageKey: storageKeyForTrail(item.trailId),
    })),
  );
  return next;
}

export async function removeOfflineMapPack(trailId: string) {
  await migrateLegacyOfflineMaps();
  const current = await getOfflineMapPacks();
  const next = current.filter((item) => item.trailId !== trailId);
  await removeChunkedValue(storageKeyForTrail(trailId));
  await saveOfflineMapIndex(
    next.map((item) => ({
      trailId: item.trailId,
      trailName: item.trailName,
      downloadedAt: item.downloadedAt,
      storageKey: storageKeyForTrail(item.trailId),
    })),
  );
  return next;
}

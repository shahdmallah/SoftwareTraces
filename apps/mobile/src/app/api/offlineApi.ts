import { apiRequest } from './client';
import { getAccessToken, getApiBaseUrl } from '../lib/auth';
import { normalizeTrail, type Trail } from './trailsApi';
import type { NearbySafetyAlert, SafetySeverity } from './safetyApi';

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

type OfflineSafetyMarker = {
  id: string;
  name?: string | null;
  name_ar?: string | null;
  location_type?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  danger_radius_meters?: number | null;
  distance_meters?: number | null;
  risk_level?: string | null;
};

export type OfflineTrailBundle = {
  trail: Trail;
  geometry?: string | null;
  elevation_profile?: unknown[];
  safety_markers?: OfflineSafetyMarker[];
  checkpoint_reports?: unknown[];
  access_route?: unknown;
  safety_snapshot?: unknown;
  safety_snapshot_generated_at?: string | null;
  generated_at?: string | null;
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
  trail?: Trail;
  safetyAlerts?: NearbySafetyAlert[];
  safetyMarkers?: OfflineSafetyMarker[];
  checkpointReports?: unknown[];
  accessRoute?: unknown;
  elevationProfile?: unknown[];
  safetySnapshot?: unknown;
  generatedAt?: string;
  archiveDownloaded?: boolean;
  archiveError?: string;
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

function normalizeSafetySeverity(value: unknown): SafetySeverity {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'critical' || normalized === 'high' || normalized === 'medium' || normalized === 'low') {
    return normalized;
  }

  if (normalized === 'dangerous' || normalized === 'avoid') {
    return 'high';
  }

  if (normalized === 'attention' || normalized === 'caution') {
    return 'medium';
  }

  return 'low';
}

function safetyMarkerToAlert(marker: OfflineSafetyMarker): NearbySafetyAlert | null {
  const latitude = Number(marker.latitude);
  const longitude = Number(marker.longitude);

  if (!marker.id || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return {
    id: marker.id,
    kind: 'location',
    name: marker.name ?? 'Safety marker',
    name_ar: marker.name_ar,
    location_type: marker.location_type ?? 'safety_marker',
    latitude,
    longitude,
    danger_radius_meters: Number(marker.danger_radius_meters ?? 0),
    distance_meters: Number(marker.distance_meters ?? 0),
    risk_level: normalizeSafetySeverity(marker.risk_level),
  };
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

function offlineBundleToRoutePayload(
  trailId: string,
  bundle: Awaited<ReturnType<typeof getOfflineTrailBundle>>,
  archive: { downloaded: boolean; error?: string },
): OfflineRoutePayload {
  const trail = bundle.trail;

  return {
    trailId,
    trailName: trail.name,
    trailNameAr: trail.nameAr,
    region: trail.region,
    regionAr: trail.regionAr,
    coordinates: trail.coordinates,
    tileRegion: `trail-${trailId}`,
    tileUrlTemplate: '',
    routeCoordinates: normalizeRouteCoordinates(trail.routeCoordinates),
    trail,
    safetyAlerts: bundle.safetyAlerts,
    safetyMarkers: bundle.safety_markers,
    checkpointReports: bundle.checkpoint_reports,
    accessRoute: bundle.access_route,
    elevationProfile: bundle.elevation_profile,
    safetySnapshot: bundle.safety_snapshot,
    generatedAt: bundle.generated_at ?? bundle.safety_snapshot_generated_at ?? undefined,
    archiveDownloaded: archive.downloaded,
    archiveError: archive.error,
  };
}

export async function getOfflineTrailBundle(trailId: string) {
  const response = await apiRequest<Envelope<OfflineTrailBundle>>(`/api/offline/trails/${trailId}/bundle`);
  const trail = normalizeTrail(response.data.trail);
  const safetyMarkers = Array.isArray(response.data.safety_markers) ? response.data.safety_markers : [];

  return {
    ...response.data,
    trail,
    safety_markers: safetyMarkers,
    checkpoint_reports: Array.isArray(response.data.checkpoint_reports) ? response.data.checkpoint_reports : [],
    elevation_profile: Array.isArray(response.data.elevation_profile) ? response.data.elevation_profile : [],
    safetyAlerts: safetyMarkers
      .map(safetyMarkerToAlert)
      .filter((alert): alert is NearbySafetyAlert => alert !== null),
  };
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

export async function downloadOfflineMap(trailId: string): Promise<OfflineRoutePayload> {
  const bundle = await getOfflineTrailBundle(trailId);

  try {
    await requestOfflineArchive(trailId);
    return offlineBundleToRoutePayload(trailId, bundle, { downloaded: true });
  } catch (error) {
    return offlineBundleToRoutePayload(trailId, bundle, {
      downloaded: false,
      error: error instanceof Error ? error.message : 'Unable to sync account archive.',
    });
  }
}

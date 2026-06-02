import SQLite from "react-native-sqlite-storage";
import type { Activity, Trail } from "@traces/shared-types";

SQLite.enablePromise(true);

const DB_NAME = "traces.db";

export type OfflineMapStatus = "downloading" | "downloaded" | "failed" | "updating";

export interface OfflineSafetyMarker {
  id: string;
  name: string;
  name_ar?: string | null;
  location_type: string;
  latitude: number;
  longitude: number;
  risk_level?: string | null;
  danger_radius_meters?: number;
  latest_report?: {
    status?: "open" | "slow" | "closed";
    wait_minutes?: number;
    notes?: string | null;
    created_at?: string | null;
    expires_at?: string | null;
  } | null;
  report_count?: number;
  latest_report_at?: string | null;
  dominant_status?: string | null;
  dominant_status_count?: number;
}

export interface OfflineSafetySnapshot {
  generated_at: string;
  confidence: "high" | "medium" | "low";
  freshness?: "fresh" | "recent" | "stale" | "unknown";
  report_count: number;
  latest_report_at?: string | null;
  average_agreement?: number;
  summary: string;
}

export interface OfflineMapBundle {
  trail: Trail & Record<string, any>;
  geometry?: unknown;
  elevation_profile?: unknown;
  safety_markers: OfflineSafetyMarker[];
  checkpoint_reports?: unknown[];
  access_route?: unknown;
  safety_snapshot?: OfflineSafetySnapshot;
  safety_snapshot_generated_at?: string;
  generated_at: string;
}

export interface OfflineMapRecord {
  trail_id: string;
  title: string;
  payload: OfflineMapBundle;
  status: OfflineMapStatus;
  downloaded_at: string;
  updated_at: string;
  last_error: string | null;
  has_map_pack: boolean;
}

async function openDb() {
  return SQLite.openDatabase({ name: DB_NAME, location: "default" });
}

/**
 * Initializes offline tables for trails and activities.
 */
export async function initializeOfflineStorage(): Promise<void> {
  const db = await openDb();
  await db.executeSql("CREATE TABLE IF NOT EXISTS trails (id TEXT PRIMARY KEY, payload TEXT NOT NULL, updated_at TEXT NOT NULL)");
  await db.executeSql("CREATE TABLE IF NOT EXISTS activities (id TEXT PRIMARY KEY, payload TEXT NOT NULL, updated_at TEXT NOT NULL, pending_sync INTEGER NOT NULL DEFAULT 1)");
  await db.executeSql(
    "CREATE TABLE IF NOT EXISTS offline_maps (trail_id TEXT PRIMARY KEY, title TEXT NOT NULL, payload TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'downloaded', downloaded_at TEXT NOT NULL, updated_at TEXT NOT NULL, last_error TEXT, has_map_pack INTEGER NOT NULL DEFAULT 0)"
  );
}

/**
 * Stores cached trails for offline use.
 */
export async function cacheTrails(trails: Trail[]): Promise<void> {
  const db = await openDb();
  for (const trail of trails) {
    await db.executeSql(
      "INSERT OR REPLACE INTO trails (id, payload, updated_at) VALUES (?, ?, ?)",
      [trail.id, JSON.stringify(trail), trail.updatedAt]
    );
  }
}

export async function getCachedTrails(): Promise<Trail[]> {
  const db = await openDb();
  const [result] = await db.executeSql("SELECT payload FROM trails ORDER BY updated_at DESC");
  const trails: Trail[] = [];

  for (let index = 0; index < result.rows.length; index += 1) {
    trails.push(JSON.parse(result.rows.item(index).payload) as Trail);
  }

  return trails;
}

export async function saveOfflineMap(bundle: OfflineMapBundle, status: OfflineMapStatus = "downloaded", lastError: string | null = null): Promise<void> {
  const db = await openDb();
  const now = new Date().toISOString();
  const trailId = String(bundle.trail.id);
  const title = String(bundle.trail.name ?? "Offline trail");

  await db.executeSql(
    `INSERT OR REPLACE INTO offline_maps
      (trail_id, title, payload, status, downloaded_at, updated_at, last_error, has_map_pack)
     VALUES (?, ?, ?, ?, COALESCE((SELECT downloaded_at FROM offline_maps WHERE trail_id = ?), ?), ?, ?, 0)`,
    [trailId, title, JSON.stringify(bundle), status, trailId, now, bundle.generated_at ?? now, lastError]
  );
}

export async function saveOfflineMapStatus(trailId: string, title: string, status: OfflineMapStatus, lastError: string | null = null): Promise<void> {
  const db = await openDb();
  const now = new Date().toISOString();
  const fallbackBundle: OfflineMapBundle = {
    trail: { id: trailId, name: title } as OfflineMapBundle["trail"],
    safety_markers: [],
    generated_at: now,
  };

  await db.executeSql(
    `INSERT OR REPLACE INTO offline_maps
      (trail_id, title, payload, status, downloaded_at, updated_at, last_error, has_map_pack)
     VALUES (?, ?, COALESCE((SELECT payload FROM offline_maps WHERE trail_id = ?), ?), ?, COALESCE((SELECT downloaded_at FROM offline_maps WHERE trail_id = ?), ?), ?, ?, 0)`,
    [trailId, title, trailId, JSON.stringify(fallbackBundle), status, trailId, now, now, lastError]
  );
}

export async function getOfflineMaps(): Promise<OfflineMapRecord[]> {
  const db = await openDb();
  const [result] = await db.executeSql("SELECT * FROM offline_maps ORDER BY updated_at DESC");
  const maps: OfflineMapRecord[] = [];

  for (let index = 0; index < result.rows.length; index += 1) {
    const row = result.rows.item(index);
    maps.push({
      trail_id: row.trail_id,
      title: row.title,
      payload: JSON.parse(row.payload) as OfflineMapBundle,
      status: row.status as OfflineMapStatus,
      downloaded_at: row.downloaded_at,
      updated_at: row.updated_at,
      last_error: row.last_error,
      has_map_pack: Boolean(row.has_map_pack),
    });
  }

  return maps;
}

export async function getOfflineMap(trailId: string): Promise<OfflineMapRecord | null> {
  const db = await openDb();
  const [result] = await db.executeSql("SELECT * FROM offline_maps WHERE trail_id = ? LIMIT 1", [trailId]);

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows.item(0);
  return {
    trail_id: row.trail_id,
    title: row.title,
    payload: JSON.parse(row.payload) as OfflineMapBundle,
    status: row.status as OfflineMapStatus,
    downloaded_at: row.downloaded_at,
    updated_at: row.updated_at,
    last_error: row.last_error,
    has_map_pack: Boolean(row.has_map_pack),
  };
}

export async function deleteOfflineMap(trailId: string): Promise<void> {
  const db = await openDb();
  await db.executeSql("DELETE FROM offline_maps WHERE trail_id = ?", [trailId]);
}

/**
 * Persists an activity locally for later sync.
 */
export async function saveOfflineActivity(activity: Activity): Promise<void> {
  const db = await openDb();
  await db.executeSql(
    "INSERT OR REPLACE INTO activities (id, payload, updated_at, pending_sync) VALUES (?, ?, ?, 1)",
    [activity.id, JSON.stringify(activity), activity.updatedAt]
  );
}

/**
 * Reads pending offline activities.
 */
export async function getPendingActivities(): Promise<Activity[]> {
  const db = await openDb();
  const [result] = await db.executeSql("SELECT payload FROM activities WHERE pending_sync = 1 ORDER BY updated_at ASC");
  const items: Activity[] = [];

  for (let index = 0; index < result.rows.length; index += 1) {
    items.push(JSON.parse(result.rows.item(index).payload) as Activity);
  }

  return items;
}

/**
 * Marks an activity as synced.
 */
export async function markActivitySynced(activityId: string): Promise<void> {
  const db = await openDb();
  await db.executeSql("UPDATE activities SET pending_sync = 0 WHERE id = ?", [activityId]);
}

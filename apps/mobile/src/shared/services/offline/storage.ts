import SQLite from "react-native-sqlite-storage";
import type { Activity, Trail } from "@traces/shared-types";

SQLite.enablePromise(true);

const DB_NAME = "traces.db";

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

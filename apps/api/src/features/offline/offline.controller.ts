import type { Request, Response } from "express";
import type { OfflineSyncPayload } from "@traces/shared-types";
import { pool } from "../../db/pool";
import { env } from "../../config/env";
import { HttpError } from "../../lib/httpError";
import { requireAuth } from "../../middleware/auth";

interface ZipEntry {
  name: string;
  data: Buffer;
}

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n += 1) {
  let c = n;
  for (let k = 0; k < 8; k += 1) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c >>> 0;
}

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createZip(entries: ZipEntry[]): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const checksum = crc32(entry.data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(entry.data.length, 18);
    local.writeUInt32LE(entry.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, name, entry.data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(entry.data.length, 20);
    central.writeUInt32LE(entry.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, name);

    offset += local.length + name.length + entry.data.length;
  }

  const centralOffset = offset;
  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(centralOffset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDirectory, end]);
}

function lonToTileX(lon: number, zoom: number): number {
  return Math.floor(((lon + 180) / 360) * 2 ** zoom);
}

function latToTileY(lat: number, zoom: number): number {
  const rad = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** zoom);
}

async function fetchTile(url: string): Promise<Buffer | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.log("[offline.downloadOfflineMap] tile fetch failed", { url, status: response.status });
      return null;
    }
    return Buffer.from(await response.arrayBuffer());
  } catch (error) {
    console.log("[offline.downloadOfflineMap] tile fetch error", { url, error });
    return null;
  }
}

function sendOfflineError(action: string, res: Response, error: unknown): void {
  console.log(`[offline.${action}] error`, error);
  if (error instanceof HttpError) {
    res.status(error.statusCode).json({ error: error.message });
    return;
  }
  res.status(500).json({ error: "Internal server error", details: error instanceof Error ? error.message : String(error) });
}

export async function getPendingSync(req: Request, res: Response): Promise<void> {
  const auth = requireAuth(req);
  const since = req.query.since ?? "1970-01-01T00:00:00.000Z";
  const result = await pool.query("SELECT * FROM activities WHERE user_id = $1 AND updated_at > $2 ORDER BY updated_at ASC", [
    auth.sub,
    since
  ]);
  res.json({ data: result.rows });
}

export async function syncOfflineActivities(req: Request, res: Response): Promise<void> {
  const auth = requireAuth(req);
  const payload = req.body as OfflineSyncPayload;
  const uploaded: string[] = [];
  const conflicts: string[] = [];

  for (const activity of payload.activities) {
    const existing = await pool.query("SELECT updated_at FROM activities WHERE id = $1", [activity.id]);

    if (
      (existing.rowCount ?? 0) > 0 &&
      new Date(existing.rows[0].updated_at).getTime() > new Date(String(activity.updatedAt)).getTime()
    ) {
      conflicts.push(String(activity.id));
      continue;
    }

    await pool.query(
      `
      INSERT INTO activities (
        id, user_id, trail_id, title, started_at, ended_at, duration_sec, distance_km,
        elevation_gain_m, avg_speed_kph, max_speed_kph, status, matched_trail_confidence, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      ON CONFLICT (id) DO UPDATE
      SET title = EXCLUDED.title,
        ended_at = EXCLUDED.ended_at,
        duration_sec = EXCLUDED.duration_sec,
        distance_km = EXCLUDED.distance_km,
        elevation_gain_m = EXCLUDED.elevation_gain_m,
        avg_speed_kph = EXCLUDED.avg_speed_kph,
        max_speed_kph = EXCLUDED.max_speed_kph,
        status = EXCLUDED.status,
        matched_trail_confidence = EXCLUDED.matched_trail_confidence,
        updated_at = EXCLUDED.updated_at
      `,
      [
        activity.id,
        auth.sub,
        activity.trailId ?? null,
        activity.title,
        activity.startedAt,
        activity.endedAt ?? null,
        activity.durationSec ?? 0,
        activity.distanceKm ?? 0,
        activity.elevationGainM ?? 0,
        activity.avgSpeedKph ?? 0,
        activity.maxSpeedKph ?? 0,
        activity.status ?? "completed",
        activity.matchedTrailConfidence ?? null,
        activity.updatedAt ?? new Date().toISOString()
      ]
    );

    uploaded.push(String(activity.id));
  }

  res.json({ data: { uploaded, conflicts } });
}

export async function downloadOfflineMap(req: Request, res: Response): Promise<void> {
  try {
    console.log("[offline.downloadOfflineMap] requiring auth");
    const auth = requireAuth(req);
    const { trailId } = req.params;

    console.log("[offline.downloadOfflineMap] fetching trail geometry", { trailId });
    const trailResult = await pool.query(
      `
      SELECT
        id,
        name,
        ST_AsGeoJSON(geometry::geometry)::json AS geojson,
        ST_XMin(Box2D(geometry::geometry)) AS min_lng,
        ST_YMin(Box2D(geometry::geometry)) AS min_lat,
        ST_XMax(Box2D(geometry::geometry)) AS max_lng,
        ST_YMax(Box2D(geometry::geometry)) AS max_lat
      FROM trails
      WHERE id = $1::uuid AND deleted_at IS NULL
      `,
      [trailId]
    );

    const trail = trailResult.rows[0];
    if (!trail) {
      throw new HttpError(404, "Trail not found");
    }

    console.log("[offline.downloadOfflineMap] generating elevation profile", { trailId });
    const elevationResult = await pool.query(
      `
      WITH samples AS (
        SELECT generate_series(0, 49) AS idx
      )
      SELECT
        idx,
        ST_Length(ST_LineSubstring(t.geometry::geometry, 0, idx / 49.0)::geography) AS distance_meters,
        ST_Y(ST_LineInterpolatePoint(t.geometry::geometry, idx / 49.0)) AS latitude,
        ST_X(ST_LineInterpolatePoint(t.geometry::geometry, idx / 49.0)) AS longitude
      FROM trails t
      CROSS JOIN samples
      WHERE t.id = $1::uuid
      ORDER BY idx ASC
      `,
      [trailId]
    );

    const entries: ZipEntry[] = [
      {
        name: "trail.geojson",
        data: Buffer.from(
          JSON.stringify({
            type: "Feature",
            properties: { id: trail.id, name: trail.name },
            geometry: trail.geojson
          }),
          "utf8"
        )
      },
      {
        name: "elevation-profile.json",
        data: Buffer.from(JSON.stringify({ data: elevationResult.rows }), "utf8")
      }
    ];

    const tileManifest: Array<{ z: number; x: number; y: number; url: string; path: string }> = [];
    const token = env.MAPBOX_TOKEN;

    console.log("[offline.downloadOfflineMap] generating tile list", { hasMapboxToken: Boolean(token) });
    for (let z = 10; z <= 14; z += 1) {
      const minX = lonToTileX(Number(trail.min_lng), z);
      const maxX = lonToTileX(Number(trail.max_lng), z);
      const minY = latToTileY(Number(trail.max_lat), z);
      const maxY = latToTileY(Number(trail.min_lat), z);

      for (let x = minX; x <= maxX; x += 1) {
        for (let y = minY; y <= maxY; y += 1) {
          const url = `https://api.mapbox.com/v4/mapbox.satellite/${z}/${x}/${y}.png?access_token=${token ?? "{MAPBOX_TOKEN}"}`;
          const path = `tiles/${z}/${x}/${y}.png`;
          tileManifest.push({ z, x, y, url, path });

          if (token) {
            const tile = await fetchTile(url);
            if (tile) {
              entries.push({ name: path, data: tile });
            }
          }
        }
      }
    }

    entries.push({ name: "tiles-manifest.json", data: Buffer.from(JSON.stringify({ tiles: tileManifest }), "utf8") });
    const zip = createZip(entries);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    console.log("[offline.downloadOfflineMap] saving offline map record", { entries: entries.length, expiresAt });
    await pool.query(
      `
      INSERT INTO offline_maps (user_id, trail_id, downloaded_at, expires_at, metadata)
      VALUES ($1::uuid, $2::uuid, NOW(), $3::timestamptz, $4::jsonb)
      `,
      [auth.sub, trailId, expiresAt, JSON.stringify({ tile_count: tileManifest.length, bytes: zip.length, has_tiles: Boolean(token) })]
    );

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="trail_${trailId}_offline.zip"`);
    res.send(zip);
  } catch (error) {
    sendOfflineError("downloadOfflineMap", res, error);
  }
}

export async function getUserOfflineMaps(req: Request, res: Response): Promise<void> {
  try {
    console.log("[offline.getUserOfflineMaps] requiring auth");
    const auth = requireAuth(req);
    const result = await pool.query(
      `
      SELECT om.*, t.name AS trail_name
      FROM offline_maps om
      LEFT JOIN trails t ON t.id = om.trail_id
      WHERE om.user_id = $1::uuid
      ORDER BY om.downloaded_at DESC NULLS LAST
      `,
      [auth.sub]
    );
    console.log("[offline.getUserOfflineMaps] result count", result.rows.length);
    res.json({ data: result.rows });
  } catch (error) {
    sendOfflineError("getUserOfflineMaps", res, error);
  }
}

export async function deleteOfflineMap(req: Request, res: Response): Promise<void> {
  try {
    console.log("[offline.deleteOfflineMap] requiring auth");
    const auth = requireAuth(req);
    const result = await pool.query("DELETE FROM offline_maps WHERE id = $1::uuid AND user_id = $2::uuid RETURNING id", [
      req.params.id,
      auth.sub
    ]);

    if (!result.rows[0]) {
      throw new HttpError(404, "Offline map not found");
    }

    console.log("[offline.deleteOfflineMap] deleted", { id: req.params.id });
    res.status(204).send();
  } catch (error) {
    sendOfflineError("deleteOfflineMap", res, error);
  }
}

import type { Request, Response } from "express";
import type { OfflineSyncPayload } from "@traces/shared-types";
import { pool } from "../../db/pool";
import { env } from "../../config/env";
import { HttpError } from "../../lib/httpError";
import { requireAuth } from "../../middleware/auth";
import { formatTrailForApp } from "../../utils/formatTrail";

interface ZipEntry {
  name: string;
  data: Buffer;
}

type QueryResultRow = Record<string, unknown>;

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

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toFiniteNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isValidCoordinate(lat: number, lng: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return false;
  }

  if (lat === 0 && lng === 0) {
    return false;
  }

  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

function parseCoordinatePair(value: unknown, preferredOrder: "latlng" | "lnglat" = "latlng"): { lat: number; lng: number } | null {
  if (!Array.isArray(value) || value.length < 2) {
    return null;
  }

  const first = toFiniteNumber(value[0]);
  const second = toFiniteNumber(value[1]);
  if (first === null || second === null) {
    return null;
  }

  const primary = preferredOrder === "lnglat"
    ? { lng: first, lat: second }
    : { lat: first, lng: second };
  if (isValidCoordinate(primary.lat, primary.lng)) {
    return primary;
  }

  const swapped = preferredOrder === "lnglat"
    ? { lat: first, lng: second }
    : { lng: first, lat: second };
  return isValidCoordinate(swapped.lat, swapped.lng) ? swapped : null;
}

function getFirstValidCoordinate(value: unknown, preferredOrder: "latlng" | "lnglat" = "latlng"): { lat: number; lng: number } | null {
  const direct = parseCoordinatePair(value, preferredOrder);
  if (direct) {
    return direct;
  }

  if (value && typeof value === "object" && "coordinates" in value) {
    return getFirstValidCoordinate((value as { coordinates?: unknown }).coordinates, "lnglat");
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const coordinate = getFirstValidCoordinate(item, preferredOrder);
      if (coordinate) {
        return coordinate;
      }
    }
  }

  return null;
}

function getValidLatLng(latValue: unknown, lngValue: unknown): { lat: number; lng: number } | null {
  const lat = toFiniteNumber(latValue);
  const lng = toFiniteNumber(lngValue);
  return lat !== null && lng !== null && isValidCoordinate(lat, lng) ? { lat, lng } : null;
}

function toIsoString(value: unknown): string | null {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function hoursSince(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) {
    return null;
  }

  return (Date.now() - timestamp) / (60 * 60 * 1000);
}

async function optionalQuery<T extends QueryResultRow>(query: string, params: unknown[] = []): Promise<T[]> {
  try {
    const result = await pool.query<T>(query, params);
    return result.rows;
  } catch (error) {
    console.warn("[offline.bundle] Optional query failed:", error instanceof Error ? error.message : String(error));
    return [];
  }
}

function getTrailSelectFields(): string {
  return `
    id,
    slug,
    name,
    name_ar,
    description,
    description_ar,
    region,
    region_ar,
    length_meters,
    elevation_gain_meters,
    elevation_min,
    elevation_max,
    estimated_duration_minutes,
    difficulty,
    average_rating,
    total_reviews,
    rating,
    reviews,
    image,
    images,
    features,
    features_ar,
    has_checkpoint,
    checkpoint_note,
    tags,
    created_at,
    updated_at,
    ST_AsText(start_point::geometry) AS start_point_text,
    ST_X(ST_StartPoint(geometry::geometry)) AS start_lng,
    ST_Y(ST_StartPoint(geometry::geometry)) AS start_lat,
    ST_AsText(geometry::geometry) AS geometry_text,
    ST_AsGeoJSON(geometry::geometry)::json AS geometry_geojson
  `;
}

async function getOfflineTrailAccess(trailId: string, trail: QueryResultRow) {
  const accessRows = await optionalQuery(
    `SELECT id, trail_id, trailhead_latitude, trailhead_longitude, trailhead_name, trailhead_name_ar,
            trailhead_parking_notes, trailhead_parking_notes_ar, trailhead_access_notes,
            trailhead_access_notes_ar, updated_at
     FROM access_routes
     WHERE trail_id = $1::uuid
     LIMIT 1`,
    [trailId]
  );
  const access = accessRows[0];

  if (access) {
    const configuredCoordinate = getValidLatLng(access.trailhead_latitude, access.trailhead_longitude);
    if (!configuredCoordinate) {
      console.warn("[offline.getOfflineTrailAccess] Ignoring invalid configured access coordinates", {
        trailId,
        latitude: access.trailhead_latitude,
        longitude: access.trailhead_longitude,
      });
    } else {
      return {
        available: true,
        trailhead: {
          latitude: configuredCoordinate.lat,
          longitude: configuredCoordinate.lng,
          name: access.trailhead_name,
          name_ar: access.trailhead_name_ar,
          parking_notes: access.trailhead_parking_notes,
          parking_notes_ar: access.trailhead_parking_notes_ar,
          access_notes: access.trailhead_access_notes,
          access_notes_ar: access.trailhead_access_notes_ar,
        },
        driving_route: null,
        source: "access_routes",
        updated_at: toIsoString(access.updated_at),
      };
    }
  }

  const fallbackCoordinate = getFirstValidCoordinate(trail.geometry_geojson, "lnglat")
    ?? getValidLatLng(trail.start_lat, trail.start_lng);

  if (!fallbackCoordinate) {
    return {
      available: false,
      warning: "No valid trail access coordinates available.",
      trailhead: null,
      driving_route: null,
      source: "unavailable",
      updated_at: toIsoString(trail.updated_at),
    };
  }

  return {
    available: true,
    trailhead: {
      latitude: fallbackCoordinate.lat,
      longitude: fallbackCoordinate.lng,
      name: trail.name ? `${String(trail.name)} trailhead` : "Trailhead",
      name_ar: trail.name_ar ?? trail.name ?? "Trailhead",
      parking_notes: null,
      parking_notes_ar: null,
      access_notes: "Using the trail start point because no access route has been configured yet.",
      access_notes_ar: null,
    },
    driving_route: null,
    source: "trails.start_point",
    updated_at: toIsoString(trail.updated_at),
  };
}

async function getOfflineSafetyMarkers(trailId: string) {
  const rows = await optionalQuery(
    `WITH trail AS (
       SELECT geometry::geography AS geog
       FROM trails
       WHERE id = $1::uuid
       LIMIT 1
     )
     SELECT dl.id, dl.name, dl.name_ar, dl.location_type, dl.latitude, dl.longitude,
            dl.danger_radius_meters, dl.risk_level, dl.description, dl.is_active,
            ST_Distance(ST_SetSRID(ST_MakePoint(dl.longitude, dl.latitude), 4326)::geography, trail.geog) AS distance_meters,
            latest.status AS checkpoint_status,
            latest.wait_minutes,
            latest.notes AS report_notes,
            latest.created_at AS report_created_at,
            latest.expires_at AS report_expires_at,
            COALESCE(report_stats.report_count, 0) AS report_count,
            report_stats.latest_report_at,
            dominant_status.status AS dominant_status,
            COALESCE(dominant_status.status_count, 0) AS dominant_status_count
     FROM dangerous_locations dl
     CROSS JOIN trail
     LEFT JOIN LATERAL (
       SELECT status, wait_minutes, notes, created_at, expires_at
       FROM checkpoint_reports cr
       WHERE cr.checkpoint_id = dl.id
         AND cr.expires_at > NOW()
       ORDER BY cr.created_at DESC
       LIMIT 1
     ) latest ON TRUE
     LEFT JOIN LATERAL (
       SELECT COUNT(*)::int AS report_count, MAX(created_at) AS latest_report_at
       FROM checkpoint_reports cr
       WHERE cr.checkpoint_id = dl.id
         AND cr.created_at > NOW() - INTERVAL '24 hours'
     ) report_stats ON TRUE
     LEFT JOIN LATERAL (
       SELECT status, COUNT(*)::int AS status_count
       FROM checkpoint_reports cr
       WHERE cr.checkpoint_id = dl.id
         AND cr.created_at > NOW() - INTERVAL '24 hours'
       GROUP BY status
       ORDER BY COUNT(*) DESC, MAX(created_at) DESC
       LIMIT 1
     ) dominant_status ON TRUE
     WHERE dl.is_active = true
       AND ST_DWithin(
         ST_SetSRID(ST_MakePoint(dl.longitude, dl.latitude), 4326)::geography,
         trail.geog,
         GREATEST(1000, COALESCE(dl.danger_radius_meters, 0))
       )
     ORDER BY distance_meters ASC
     LIMIT 40`,
    [trailId]
  );

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    name_ar: row.name_ar,
    location_type: row.location_type,
    latitude: toNumber(row.latitude),
    longitude: toNumber(row.longitude),
    danger_radius_meters: toNumber(row.danger_radius_meters),
    risk_level: row.risk_level,
    description: row.description,
    distance_meters: Math.round(toNumber(row.distance_meters)),
    latest_report: row.checkpoint_status
      ? {
          status: row.checkpoint_status,
          wait_minutes: toNumber(row.wait_minutes),
          notes: row.report_notes,
          created_at: toIsoString(row.report_created_at),
          expires_at: toIsoString(row.report_expires_at),
        }
      : null,
    report_count: toNumber(row.report_count),
    latest_report_at: toIsoString(row.latest_report_at),
    dominant_status: row.dominant_status,
    dominant_status_count: toNumber(row.dominant_status_count),
  }));
}

function buildSafetySnapshot(safetyMarkers: Array<Record<string, any>>) {
  const generatedAt = new Date().toISOString();
  const reportCount = safetyMarkers.reduce((total, marker) => total + toNumber(marker.report_count), 0);
  const latestReportAt = safetyMarkers
    .map((marker) => marker.latest_report_at)
    .filter((value): value is string => typeof value === "string")
    .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0] ?? null;
  const latestReportAgeHours = hoursSince(latestReportAt);
  const markersWithAgreement = safetyMarkers.filter((marker) => toNumber(marker.report_count) > 0);
  const agreementRatios = markersWithAgreement.map((marker) => {
    const count = toNumber(marker.report_count);
    return count > 0 ? toNumber(marker.dominant_status_count) / count : 0;
  });
  const averageAgreement = agreementRatios.length > 0
    ? agreementRatios.reduce((total, ratio) => total + ratio, 0) / agreementRatios.length
    : 0;

  let freshness: "fresh" | "recent" | "stale" | "unknown" = "unknown";
  if (latestReportAgeHours !== null && latestReportAgeHours <= 6) {
    freshness = "fresh";
  } else if (latestReportAgeHours !== null && latestReportAgeHours <= 24) {
    freshness = "recent";
  } else if (latestReportAgeHours !== null) {
    freshness = "stale";
  }

  let confidence: "high" | "medium" | "low" = "low";
  if (reportCount >= 5 && latestReportAgeHours !== null && latestReportAgeHours <= 6 && averageAgreement >= 0.6) {
    confidence = "high";
  } else if (reportCount >= 2 && latestReportAgeHours !== null && latestReportAgeHours <= 24) {
    confidence = "medium";
  }

  const latestCheckpoint = safetyMarkers.find((marker) => marker.latest_report)?.latest_report;
  const summary = latestCheckpoint
    ? `Checkpoint recently reported as ${latestCheckpoint.status}`
    : reportCount > 0
      ? "Recent safety reports are available for this trail"
      : "No recent checkpoint reports in the last 24h";

  return {
    generated_at: generatedAt,
    confidence,
    freshness,
    report_count: reportCount,
    latest_report_at: latestReportAt,
    average_agreement: Number(averageAgreement.toFixed(2)),
    summary,
  };
}

async function getOfflineElevationProfile(trailId: string) {
  const rows = await optionalQuery(
    `WITH samples AS (
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
     ORDER BY idx ASC`,
    [trailId]
  );

  return rows.map((row) => ({
    distance_meters: Math.round(toNumber(row.distance_meters)),
    latitude: toNumber(row.latitude),
    longitude: toNumber(row.longitude),
  }));
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

export async function getOfflineTrailBundle(req: Request, res: Response): Promise<void> {
  try {
    requireAuth(req);
    const trailId = Array.isArray(req.params.trailId) ? req.params.trailId[0] : req.params.trailId;
    if (!trailId) {
      throw new HttpError(400, "Trail id is required");
    }
    const trailResult = await pool.query(
      `SELECT ${getTrailSelectFields()}
       FROM trails
       WHERE id = $1::uuid
         AND deleted_at IS NULL
       LIMIT 1`,
      [trailId]
    );
    const trail = trailResult.rows[0];

    if (!trail) {
      throw new HttpError(404, "Trail not found");
    }

    const [elevationProfile, safetyMarkers, accessRoute] = await Promise.all([
      getOfflineElevationProfile(trailId),
      getOfflineSafetyMarkers(trailId),
      getOfflineTrailAccess(trailId, trail),
    ]);
    const checkpointReports = safetyMarkers
      .filter((marker) => marker.latest_report)
      .map((marker) => ({ checkpoint_id: marker.id, ...marker.latest_report }));
    const safetySnapshot = buildSafetySnapshot(safetyMarkers);

    res.json({
      data: {
        trail: formatTrailForApp(trail),
        geometry: trail.geometry_text,
        elevation_profile: elevationProfile,
        safety_markers: safetyMarkers,
        checkpoint_reports: checkpointReports,
        access_route: accessRoute,
        safety_snapshot: safetySnapshot,
        safety_snapshot_generated_at: safetySnapshot.generated_at,
        generated_at: safetySnapshot.generated_at,
      },
    });
  } catch (error) {
    sendOfflineError("getOfflineTrailBundle", res, error);
  }
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
      ORDER BY om.downloaded_at DESC NULLS LAST, om.created_at DESC NULLS LAST
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

import type { Request, Response } from "express";
import { randomUUID } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { env } from "../../config/env";
import { pool } from "../../db/pool";
import { HttpError } from "../../lib/httpError";
import { requireAuth } from "../../middleware/auth";

const mediaBucket = "media";
const validMediaMimeTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
const mediaExtensionByMimeType: Record<(typeof validMediaMimeTypes)[number], string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp"
};
const maxMediaSizeBytes = 10 * 1024 * 1024;

function parseRequiredNumber(value: unknown, fieldName: string): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new HttpError(400, `${fieldName} must be a number`);
  }

  return parsed;
}

function parseLimit(value: unknown): number {
  const parsed = Number(value ?? 100);

  if (!Number.isFinite(parsed)) {
    throw new HttpError(400, "limit must be a number");
  }

  return Math.min(Math.max(Math.floor(parsed), 1), 500);
}

function getGridSize(zoom: number): number | null {
  if (zoom >= 17) {
    return null;
  }

  if (zoom >= 13) {
    return 0.002;
  }

  if (zoom >= 9) {
    return 0.01;
  }

  return 0.05;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function getSupabaseStorageClient() {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase configuration missing");
  }

  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

function parseOptionalCoordinate(value: unknown, fieldName: string, min: number, max: number): number | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new HttpError(400, `${fieldName} must be between ${min} and ${max}`);
  }

  return parsed;
}

function parseBoolean(value: unknown, defaultValue: boolean): boolean {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }

  if (typeof value === "boolean") {
    return value;
  }

  const normalized = String(value).trim().toLowerCase();

  if (["true", "1", "yes"].includes(normalized)) {
    return true;
  }

  if (["false", "0", "no"].includes(normalized)) {
    return false;
  }

  throw new HttpError(400, "is_public must be a boolean");
}

function sendMediaError(functionName: string, res: Response, error: unknown): void {
  console.log(`[media.${functionName}] error`, error);

  if (error instanceof HttpError) {
    res.status(error.statusCode).json({ error: error.message });
    return;
  }

  res.status(500).json({
    error: "Database failure",
    details: error instanceof Error ? error.message : String(error)
  });
}

export async function uploadMedia(req: Request, res: Response): Promise<void> {
  try {
    console.log("[media.uploadMedia] requiring auth");
    const auth = requireAuth(req);

    console.log("[media.uploadMedia] received upload fields", {
      has_file: Boolean(req.file),
      caption: req.body.caption,
      latitude: req.body.latitude,
      longitude: req.body.longitude,
      location_name: req.body.location_name,
      is_public: req.body.is_public,
      trip_id: req.body.trip_id
    });

    if (!isUuid(auth.sub)) {
      throw new HttpError(401, "Authentication required");
    }

    const file = req.file;

    if (!file) {
      throw new HttpError(400, "file is required");
    }

    console.log("[media.uploadMedia] validating file", { mimetype: file.mimetype, size: file.size });
    if (!validMediaMimeTypes.includes(file.mimetype as (typeof validMediaMimeTypes)[number])) {
      throw new HttpError(400, "Invalid media MIME type");
    }

    if (file.size > maxMediaSizeBytes) {
      throw new HttpError(400, "Media file must be 10MB or smaller");
    }

    const latitude = parseOptionalCoordinate(req.body.latitude, "latitude", -90, 90);
    const longitude = parseOptionalCoordinate(req.body.longitude, "longitude", -180, 180);
    const isPublic = parseBoolean(req.body.is_public, true);
    const caption = typeof req.body.caption === "string" && req.body.caption.trim() !== "" ? req.body.caption.trim() : null;
    const locationName =
      typeof req.body.location_name === "string" && req.body.location_name.trim() !== "" ? req.body.location_name.trim() : null;
    const tripId = typeof req.body.trip_id === "string" && req.body.trip_id.trim() !== "" ? req.body.trip_id.trim() : null;

    if (tripId && !isUuid(tripId)) {
      throw new HttpError(400, "trip_id must be a valid UUID");
    }

    const extension = mediaExtensionByMimeType[file.mimetype as (typeof validMediaMimeTypes)[number]];
    const storagePath = `${auth.sub}/${randomUUID()}.${extension}`;

    console.log("[media.uploadMedia] uploading to Supabase Storage", { bucket: mediaBucket, storagePath });
    const supabase = getSupabaseStorageClient();
    const { error: uploadError } = await supabase.storage.from(mediaBucket).upload(storagePath, file.buffer, {
      contentType: file.mimetype
    });

    if (uploadError) {
      console.log("[media.uploadMedia] upload failed", uploadError);
      throw new Error(`Failed to upload media: ${uploadError.message}`);
    }

    const { data: urlData } = supabase.storage.from(mediaBucket).getPublicUrl(storagePath);
    const publicUrl = urlData?.publicUrl ?? "";
    const thumbnailUrl = publicUrl;

    console.log("[media.uploadMedia] inserting media row");
    const insertResult = await pool.query(
      `
      INSERT INTO media (uploader_id, url, thumbnail_url, caption, latitude, longitude, location_name, is_public, trip_id, created_at)
      VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9::uuid, NOW())
      RETURNING id, uploader_id, url, thumbnail_url, caption, latitude, longitude, location_name, is_public, trip_id, created_at
      `,
      [auth.sub, publicUrl, thumbnailUrl, caption, latitude, longitude, locationName, isPublic, tripId]
    );

    const media = insertResult.rows[0];
    console.log("[media.uploadMedia] media row created", { media_id: media.id });

    res.status(201).json({
      data: {
        ...media,
        location: {
          name: locationName,
          latitude: media.latitude,
          longitude: media.longitude
        },
        trip_id: tripId
      }
    });
  } catch (error) {
    sendMediaError("uploadMedia", res, error);
  }
}

export async function getMapBubbles(req: Request, res: Response): Promise<void> {
  try {
    console.log("[media.getMapBubbles] received params", req.query);

    const neLat = parseRequiredNumber(req.query.ne_lat, "ne_lat");
    const neLng = parseRequiredNumber(req.query.ne_lng, "ne_lng");
    const swLat = parseRequiredNumber(req.query.sw_lat, "sw_lat");
    const swLng = parseRequiredNumber(req.query.sw_lng, "sw_lng");
    const zoom = parseRequiredNumber(req.query.zoom, "zoom");
    const limit = parseLimit(req.query.limit);

    if (swLat > neLat || swLng > neLng) {
      throw new HttpError(400, "Invalid viewport bounds");
    }

    if (zoom < 1 || zoom > 22) {
      throw new HttpError(400, "zoom must be between 1 and 22");
    }

    const gridSize = getGridSize(zoom);
    console.log("[media.getMapBubbles] querying bubbles", { neLat, neLng, swLat, swLng, zoom, limit, gridSize });

    const result =
      gridSize === null
        ? await pool.query(
            `
            WITH map_media AS (
              SELECT
                latitude,
                longitude,
                thumbnail_url AS preview_image,
                id,
                'media' AS source,
                created_at
              FROM media
              WHERE is_public = true
                AND latitude IS NOT NULL
                AND longitude IS NOT NULL
                AND latitude BETWEEN $1 AND $2
                AND longitude BETWEEN $3 AND $4

              UNION ALL

              SELECT
                latitude,
                longitude,
                public_url AS preview_image,
                id,
                'activity_media' AS source,
                created_at
              FROM activity_media
              WHERE is_public = true
                AND latitude IS NOT NULL
                AND longitude IS NOT NULL
                AND latitude BETWEEN $1 AND $2
                AND longitude BETWEEN $3 AND $4
            )
            SELECT
              latitude AS cluster_lat,
              longitude AS cluster_lng,
              1 AS count,
              ARRAY[preview_image] AS preview_images,
              ARRAY[id::text] AS media_ids
            FROM map_media
            ORDER BY created_at DESC
            LIMIT $5
            `,
            [swLat, neLat, swLng, neLng, limit]
          )
        : await pool.query(
            `
            WITH map_media AS (
              SELECT
                latitude,
                longitude,
                thumbnail_url AS preview_image,
                id,
                'media' AS source,
                created_at
              FROM media
              WHERE is_public = true
                AND latitude IS NOT NULL
                AND longitude IS NOT NULL
                AND latitude BETWEEN $3 AND $4
                AND longitude BETWEEN $5 AND $6

              UNION ALL

              SELECT
                latitude,
                longitude,
                public_url AS preview_image,
                id,
                'activity_media' AS source,
                created_at
              FROM activity_media
              WHERE is_public = true
                AND latitude IS NOT NULL
                AND longitude IS NOT NULL
                AND latitude BETWEEN $3 AND $4
                AND longitude BETWEEN $5 AND $6
            ),
            clustered_media AS (
              SELECT
                FLOOR(latitude / $1) * $1 AS cluster_lat,
                FLOOR(longitude / $2) * $2 AS cluster_lng,
                id,
                preview_image,
                created_at
              FROM map_media
            )
            SELECT
              cluster_lat,
              cluster_lng,
              COUNT(*)::int AS count,
              (ARRAY_AGG(preview_image ORDER BY created_at DESC) FILTER (WHERE preview_image IS NOT NULL))[1:3] AS preview_images,
              ARRAY_AGG(id::text) AS media_ids
            FROM clustered_media
            GROUP BY cluster_lat, cluster_lng
            ORDER BY count DESC
            LIMIT $7
            `,
            [gridSize, gridSize, swLat, neLat, swLng, neLng, limit]
          );

    console.log("[media.getMapBubbles] query result count", result.rows.length);
    res.json({
      data: result.rows.map((row) => ({
        lat: Number(row.cluster_lat),
        lng: Number(row.cluster_lng),
        count: Number(row.count),
        preview_images: row.preview_images ?? [],
        media_ids: row.media_ids ?? []
      })),
      pagination: {
        limit,
        total: result.rows.length
      }
    });
  } catch (error) {
    sendMediaError("getMapBubbles", res, error);
  }
}

export async function getBubblePhotos(req: Request, res: Response): Promise<void> {
  try {
    console.log("[media.getBubblePhotos] received params", req.query);

    if (typeof req.query.ids !== "string" || req.query.ids.trim() === "") {
      throw new HttpError(400, "ids query parameter is required");
    }

    const ids = req.query.ids
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);

    if (ids.length === 0) {
      throw new HttpError(400, "ids query parameter is required");
    }

    const invalidId = ids.find((id) => !isUuid(id));
    if (invalidId) {
      throw new HttpError(400, `Invalid media id: ${invalidId}`);
    }

    console.log("[media.getBubblePhotos] querying photos", { count: ids.length });
    const result = await pool.query(
      `
      WITH bubble_photos AS (
        SELECT
          m.id,
          m.url,
          m.thumbnail_url,
          m.caption,
          m.latitude,
          m.longitude,
          m.created_at,
          m.uploader_id AS user_id,
          'media' AS source,
          p.full_name,
          p.avatar_url
        FROM media m
        JOIN profiles p ON p.id = m.uploader_id
        WHERE m.id = ANY($1::uuid[])
          AND m.is_public = true

        UNION ALL

        SELECT
          am.id,
          am.public_url AS url,
          am.public_url AS thumbnail_url,
          am.caption,
          am.latitude,
          am.longitude,
          am.created_at,
          am.user_id,
          'activity_media' AS source,
          p.full_name,
          p.avatar_url
        FROM activity_media am
        JOIN profiles p ON p.id = am.user_id
        WHERE am.id = ANY($1::uuid[])
          AND am.is_public = true
      )
      SELECT
        id,
        url,
        thumbnail_url,
        caption,
        latitude,
        longitude,
        created_at,
        user_id,
        source,
        full_name,
        avatar_url
      FROM bubble_photos
      ORDER BY created_at DESC
      `,
      [ids]
    );

    console.log("[media.getBubblePhotos] query result count", result.rows.length);
    res.json({
      data: result.rows.map((row) => ({
        id: row.id,
        url: row.url,
        thumbnail_url: row.thumbnail_url,
        caption: row.caption,
        latitude: row.latitude,
        longitude: row.longitude,
        created_at: row.created_at,
        user: {
          id: row.user_id,
          full_name: row.full_name,
          avatar_url: row.avatar_url
        }
      }))
    });
  } catch (error) {
    sendMediaError("getBubblePhotos", res, error);
  }
}

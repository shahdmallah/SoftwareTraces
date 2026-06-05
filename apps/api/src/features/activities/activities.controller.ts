import type { Request, Response } from "express";
import { randomUUID } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { env } from "../../config/env";
import { pool } from "../../db/pool";
import { HttpError } from "../../lib/httpError";
import { requireAuth } from "../../middleware/auth";
import { verifyPhoto } from "../../services/photoVerificationService";
import { updateUserStats } from "../achievements/achievements.service";
import { createSosEvent } from "../sos/sos.service";

interface StartActivityBody {
  trail_id?: string;
  started_at?: string;
}

interface ActivityPointBody {
  latitude?: number;
  longitude?: number;
  elevation?: number;
  accuracy?: number;
  speed_mps?: number;
  recorded_at?: string;
}

interface SyncPointsBody {
  points?: ActivityPointBody[];
}

interface CompleteActivityBody {
  ended_at?: string;
  distance_meters?: number;
  elevation_gain_meters?: number;
  elevation_loss_meters?: number;
  max_elevation_meters?: number;
  min_elevation_meters?: number;
  max_speed_mps?: number;
  avg_speed_mps?: number;
}

interface ShareActivityBody {
  visibility?: string;
  caption?: string;
  review_id?: string;
}

interface SosAlertBody {
  activity_id?: string;
  latitude?: number;
  longitude?: number;
  message?: string;
  occurred_at?: string;
}

interface UpdateActivityStatusBody {
  status?: string;
  occurred_at?: string;
}

const activityMediaBucket = "activity-media";
const validActivityMediaMimeTypes = ["image/jpeg", "image/png", "image/gif", "image/webp", "video/mp4"] as const;
const activityMediaExtensionByMimeType: Record<(typeof validActivityMediaMimeTypes)[number], string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "video/mp4": "mp4"
};
const maxImageSizeBytes = 10 * 1024 * 1024;
const maxVideoSizeBytes = 50 * 1024 * 1024;

function isValidIsoTimestamp(value: unknown): value is string {
  if (typeof value !== "string" || value.trim() === "") {
    return false;
  }

  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
    return false;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp);
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function assertUuid(value: unknown, fieldName: string, statusCode = 400): asserts value is string {
  if (!isUuid(value)) {
    throw new HttpError(statusCode, `${fieldName} must be a valid UUID`);
  }
}

function assertNumber(value: unknown, fieldName: string): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new HttpError(400, `${fieldName} must be a number`);
  }
}

function getSupabaseStorageClient() {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase configuration missing");
  }

  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

function parseCoordinate(value: unknown, fieldName: string, min: number, max: number): number {
  const coordinate = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));

  if (!Number.isFinite(coordinate) || coordinate < min || coordinate > max) {
    throw new HttpError(400, `${fieldName} must be between ${min} and ${max}`);
  }

  return coordinate;
}

function escapeXml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatGpxTime(value: unknown): string {
  return new Date(value as string | number | Date).toISOString();
}

function handleActivityError(action: string, error: unknown): never {
  console.log(`[activities.${action}] failed`, error);

  if (error instanceof HttpError) {
    throw error;
  }

  throw new HttpError(500, "Internal server error");
}

export async function addActivityMedia(req: Request, res: Response): Promise<void> {
  try {
    console.log("[activities.addActivityMedia] requiring auth");
    const auth = requireAuth(req);

    console.log("[activities.addActivityMedia] validating UUIDs");
    assertUuid(auth.sub, "Authenticated user", 401);
    assertUuid(req.params.id, "Activity id");

    console.log("[activities.addActivityMedia] verifying activity ownership", { activity_id: req.params.id });
    const activityResult = await pool.query("SELECT user_id, user_id = $2::uuid AS is_owner FROM activities WHERE id = $1::uuid", [req.params.id, auth.sub]);
    const activity = activityResult.rows[0];

    if (!activity) {
      throw new HttpError(404, "Activity not found");
    }

    if (!activity.is_owner) {
      throw new HttpError(403, "Forbidden");
    }

    console.log("[activities.addActivityMedia] validating uploaded file");
    const file = req.file;

    if (!file) {
      throw new HttpError(400, "photo file is required");
    }

    if (!validActivityMediaMimeTypes.includes(file.mimetype as (typeof validActivityMediaMimeTypes)[number])) {
      throw new HttpError(400, "Invalid media MIME type");
    }

    const isVideo = file.mimetype === "video/mp4";
    const maxSize = isVideo ? maxVideoSizeBytes : maxImageSizeBytes;

    if (file.size > maxSize) {
      throw new HttpError(400, isVideo ? "Video file must be 50MB or smaller" : "Image file must be 10MB or smaller");
    }

    console.log("[activities.addActivityMedia] validating media metadata");
    const latitude = parseCoordinate(req.body.latitude, "latitude", -90, 90);
    const longitude = parseCoordinate(req.body.longitude, "longitude", -180, 180);
    const capturedAt = req.body.captured_at;

    if (!isValidIsoTimestamp(capturedAt)) {
      throw new HttpError(400, "captured_at must be a valid ISO timestamp");
    }

    const caption = typeof req.body.caption === "string" && req.body.caption.trim() !== "" ? req.body.caption.trim() : null;
    const extension = activityMediaExtensionByMimeType[file.mimetype as (typeof validActivityMediaMimeTypes)[number]];
    const storagePath = `${req.params.id}/${randomUUID()}.${extension}`;

    console.log("[activities.addActivityMedia] uploading to Supabase Storage", { storage_path: storagePath });
    const supabase = getSupabaseStorageClient();
    const { error: uploadError } = await supabase.storage.from(activityMediaBucket).upload(storagePath, file.buffer, {
      contentType: file.mimetype
    });

    if (uploadError) {
      console.log("[activities.addActivityMedia] upload failed", uploadError);
      throw new HttpError(500, "Failed to upload activity media");
    }

    const { data: urlData } = supabase.storage.from(activityMediaBucket).getPublicUrl(storagePath);
    const publicUrl = urlData?.publicUrl ?? "";

    console.log("[activities.addActivityMedia] inserting media row");
    const insertResult = await pool.query(
      `
      INSERT INTO activity_media (activity_id, user_id, media_type, storage_path, public_url, caption, latitude, longitude, captured_at, created_at)
      VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9::timestamptz, NOW())
      RETURNING id, public_url, latitude, longitude, captured_at, caption
      `,
      [req.params.id, auth.sub, isVideo ? "video" : "photo", storagePath, publicUrl, caption, latitude, longitude, capturedAt]
    );

    const mediaId = insertResult.rows[0]?.id;
    if (!isVideo && mediaId) {
      try {
        console.log("[activities.addActivityMedia] verifying uploaded activity photo", { media_id: mediaId });
        await verifyPhoto(mediaId, "activity_media", file.buffer);
        console.log("[activities.addActivityMedia] activity photo verification complete", { media_id: mediaId });
      } catch (verificationError) {
        console.error("[activities.addActivityMedia] activity photo verification failed but upload will continue", {
          media_id: mediaId,
          error: verificationError instanceof Error ? verificationError.message : String(verificationError),
        });
      }
    } else if (isVideo) {
      console.log("[activities.addActivityMedia] skipping AI photo verification for video media");
    }

    console.log("[activities.addActivityMedia] returning created media", { media_id: insertResult.rows[0]?.id });
    res.status(201).json({ data: insertResult.rows[0] });
  } catch (error) {
    handleActivityError("addActivityMedia", error);
  }
}

export async function getActivityMedia(req: Request, res: Response): Promise<void> {
  try {
    const auth = req.auth;

    console.log("[activities.getActivityMedia] validating UUIDs");
    if (auth) {
      assertUuid(auth.sub, "Authenticated user", 401);
    }
    assertUuid(req.params.id, "Activity id");

    console.log("[activities.getActivityMedia] verifying activity access", { activity_id: req.params.id });
    const activityResult = await pool.query("SELECT is_public, user_id = $2::uuid AS is_owner FROM activities WHERE id = $1::uuid", [
      req.params.id,
      auth?.sub ?? null
    ]);
    const activity = activityResult.rows[0];

    if (!activity) {
      throw new HttpError(404, "Activity not found");
    }

    if (!activity.is_public && !auth) {
      throw new HttpError(401, "Authentication required");
    }

    if (!activity.is_public && !activity.is_owner) {
      throw new HttpError(403, "Forbidden");
    }

    console.log("[activities.getActivityMedia] fetching media", { activity_id: req.params.id });
    const mediaResult = await pool.query(
      `
      SELECT id, public_url AS url, latitude, longitude, captured_at, caption, created_at
      FROM activity_media
      WHERE activity_id = $1::uuid
      ORDER BY captured_at ASC
      `,
      [req.params.id]
    );

    console.log("[activities.getActivityMedia] returning media", { count: mediaResult.rowCount });
    res.json({ data: mediaResult.rows });
  } catch (error) {
    handleActivityError("getActivityMedia", error);
  }
}

export async function shareActivity(req: Request, res: Response): Promise<void> {
  try {
    console.log("[activities.shareActivity] requiring auth");
    const auth = requireAuth(req);
    const { visibility = "public", caption, review_id } = req.body as ShareActivityBody;

    console.log("[activities.shareActivity] validating UUIDs");
    assertUuid(auth.sub, "Authenticated user", 401);
    assertUuid(req.params.id, "Activity id");

    console.log("[activities.shareActivity] validating visibility");
    if (!["public", "friends", "private"].includes(visibility)) {
      throw new HttpError(400, "visibility must be public, friends, or private");
    }

    console.log("[activities.shareActivity] verifying activity", { activity_id: req.params.id });
    const activityResult = await pool.query(
      "SELECT status, user_id = $2::uuid AS is_owner FROM activities WHERE id = $1::uuid",
      [req.params.id, auth.sub]
    );
    const activity = activityResult.rows[0];

    if (!activity) {
      throw new HttpError(404, "Activity not found");
    }

    if (!activity.is_owner) {
      throw new HttpError(403, "Forbidden");
    }

    if (activity.status !== "completed") {
      throw new HttpError(400, "Activity must be completed before sharing");
    }

    if (review_id) {
      console.log("[activities.shareActivity] validating review_id");
      assertUuid(review_id, "review_id");

      console.log("[activities.shareActivity] verifying review ownership", { review_id });
      const reviewResult = await pool.query("SELECT id FROM trail_reviews WHERE id = $1::uuid AND user_id = $2::uuid", [review_id, auth.sub]);

      if (!reviewResult.rows[0]) {
        throw new HttpError(404, "Review not found");
      }
    }

    console.log("[activities.shareActivity] inserting activity post");
    const postResult = await pool.query(
      `
      INSERT INTO activity_posts (activity_id, user_id, visibility, caption, review_id, created_at)
      VALUES ($1::uuid, $2::uuid, $3, $4, $5::uuid, NOW())
      RETURNING id AS post_id, activity_id, visibility, created_at
      `,
      [req.params.id, auth.sub, visibility, typeof caption === "string" && caption.trim() !== "" ? caption.trim() : null, review_id ?? null]
    );

    console.log("[activities.shareActivity] returning created post", { post_id: postResult.rows[0]?.post_id });
    res.status(201).json({ data: postResult.rows[0] });
  } catch (error) {
    handleActivityError("shareActivity", error);
  }
}

export async function getUserActivities(req: Request, res: Response): Promise<void> {
  const result = await pool.query("SELECT * FROM activities WHERE user_id = $1 ORDER BY started_at DESC", [req.params.userId]);
  res.json({ data: result.rows });
}

export async function getMyActivities(req: Request, res: Response): Promise<void> {
  try {
    console.log("[activities.getMyActivities] requiring auth");
    const auth = requireAuth(req);

    console.log("[activities.getMyActivities] validating auth subject");
    assertUuid(auth.sub, "Authenticated user", 401);

    const page = Math.max(Number.parseInt(String(req.query.page ?? "1"), 10) || 1, 1);
    const requestedLimit = Number.parseInt(String(req.query.limit ?? "20"), 10) || 20;
    const limit = Math.min(Math.max(requestedLimit, 1), 100);
    const offset = (page - 1) * limit;
    const status = typeof req.query.status === "string" && req.query.status.trim() !== "" ? req.query.status.trim() : undefined;

    console.log("[activities.getMyActivities] querying activities", { page, limit, status });
    const params: unknown[] = [auth.sub, limit, offset];
    const statusFilter = status ? "AND a.status = $4" : "";
    const countParams: unknown[] = [auth.sub];
    const countStatusFilter = status ? "AND a.status = $2" : "";

    if (status) {
      params.push(status);
      countParams.push(status);
    }

    const [activitiesResult, countResult] = await Promise.all([
      pool.query(
        `
        SELECT
          a.id,
          a.trail_id,
          t.name AS trail_name,
          a.distance_meters,
          a.elapsed_time_seconds,
          a.elevation_gain_meters,
          a.start_time,
          a.end_time,
          a.status
        FROM activities a
        LEFT JOIN trails t ON t.id = a.trail_id
        WHERE a.user_id = $1::uuid
        ${statusFilter}
        ORDER BY a.start_time DESC
        LIMIT $2 OFFSET $3
        `,
        params
      ),
      pool.query(
        `
        SELECT COUNT(*)::int AS total
        FROM activities a
        WHERE a.user_id = $1::uuid
        ${countStatusFilter}
        `,
        countParams
      )
    ]);

    const total = Number(countResult.rows[0]?.total ?? 0);
    const pages = Math.ceil(total / limit);

    console.log("[activities.getMyActivities] returning paginated response", { total, pages });
    res.json({
      data: activitiesResult.rows,
      pagination: {
        page,
        limit,
        total,
        pages
      }
    });
  } catch (error) {
    handleActivityError("getMyActivities", error);
  }
}

export async function getActivityById(req: Request, res: Response): Promise<void> {
  try {
    const auth = req.auth;

    console.log("[activities.getActivityById] validating UUIDs");
    if (auth) {
      assertUuid(auth.sub, "Authenticated user", 401);
    }
    assertUuid(req.params.id, "Activity id");

    console.log("[activities.getActivityById] fetching activity", { activity_id: req.params.id });
    const activityResult = await pool.query(
      `
      SELECT
        a.id,
        a.trail_id,
        a.user_id,
        p.full_name,
        a.distance_meters,
        a.elapsed_time_seconds,
        a.elevation_gain_meters,
        a.start_time,
        a.end_time,
        a.status,
        a.is_public,
        a.user_id = $2::uuid AS is_owner
      FROM activities a
      LEFT JOIN profiles p ON p.user_id = a.user_id
      WHERE a.id = $1::uuid
      `,
      [req.params.id, auth?.sub ?? null]
    );
    const activity = activityResult.rows[0];

    if (!activity) {
      throw new HttpError(404, "Activity not found");
    }

    if (!activity.is_public && !auth) {
      throw new HttpError(401, "Authentication required");
    }

    if (!activity.is_public && !activity.is_owner) {
      throw new HttpError(403, "Forbidden");
    }

    console.log("[activities.getActivityById] fetching points", { activity_id: req.params.id });
    const pointsResult = await pool.query(
      `
      SELECT latitude, longitude, elevation_meters AS elevation, timestamp AS recorded_at
      FROM activity_points
      WHERE activity_id = $1::uuid
      ORDER BY sequence ASC
      `,
      [req.params.id]
    );

    delete activity.is_public;
    delete activity.is_owner;

    console.log("[activities.getActivityById] returning activity with points", { point_count: pointsResult.rowCount });
    res.json({
      data: {
        ...activity,
        points: pointsResult.rows
      }
    });
  } catch (error) {
    handleActivityError("getActivityById", error);
  }
}

export async function startActivity(req: Request, res: Response): Promise<void> {
  try {
    console.log("[activities.startActivity] requiring auth");
    const auth = requireAuth(req);
    const { trail_id, started_at } = req.body as StartActivityBody;

    console.log("[activities.startActivity] validating auth subject");
    assertUuid(auth.sub, "Authenticated user", 401);

    console.log("[activities.startActivity] validating started_at");
    if (!isValidIsoTimestamp(started_at)) {
      throw new HttpError(400, "started_at must be a valid ISO timestamp");
    }

    if (trail_id) {
      console.log("[activities.startActivity] validating trail_id");
      assertUuid(trail_id, "trail_id");

      console.log("[activities.startActivity] verifying trail exists", { trail_id });
      const trailResult = await pool.query("SELECT id FROM trails WHERE id = $1::uuid AND deleted_at IS NULL", [trail_id]);

      if (!trailResult.rows[0]) {
        throw new HttpError(404, "Trail not found");
      }
    }

    console.log("[activities.startActivity] inserting activity");
    const activityResult = await pool.query(
      `
      INSERT INTO activities (user_id, trail_id, start_time, status, created_at, updated_at)
      VALUES ($1::uuid, $2::uuid, $3, 'recording', NOW(), NOW())
      RETURNING id, user_id, trail_id, start_time, status
      `,
      [auth.sub, trail_id ?? null, started_at]
    );

    const activity = activityResult.rows[0];

    console.log("[activities.startActivity] inserting started event", { activity_id: activity.id });
    await pool.query(
      `
      INSERT INTO activity_events (activity_id, event_type, occurred_at)
      VALUES ($1::uuid, 'started', $2)
      `,
      [activity.id, started_at]
    );

    console.log("[activities.startActivity] returning created activity", { activity_id: activity.id });
    res.status(201).json(activity);
  } catch (error) {
    handleActivityError("startActivity", error);
  }
}

export async function syncPoints(req: Request, res: Response): Promise<void> {
  try {
    console.log("[activities.syncPoints] requiring auth");
    const auth = requireAuth(req);
    const { points } = req.body as SyncPointsBody;

    console.log("[activities.syncPoints] validating UUIDs");
    assertUuid(auth.sub, "Authenticated user", 401);
    assertUuid(req.params.id, "Activity id");

    console.log("[activities.syncPoints] verifying activity", { activity_id: req.params.id });
    const activityResult = await pool.query("SELECT user_id, status, user_id = $2::uuid AS is_owner FROM activities WHERE id = $1::uuid", [
      req.params.id,
      auth.sub
    ]);
    const activity = activityResult.rows[0];

    if (!activity) {
      throw new HttpError(404, "Activity not found");
    }

    if (!activity.is_owner) {
      throw new HttpError(403, "Forbidden");
    }

    if (activity.status !== "recording") {
      throw new HttpError(400, "Activity is not recording");
    }

    console.log("[activities.syncPoints] validating points");
    if (!Array.isArray(points)) {
      throw new HttpError(400, "points must be an array");
    }

    if (!points || points.length === 0) {
      res.status(400).json({ error: "Points array cannot be empty" });
      return;
    }

    for (const [index, point] of points.entries()) {
      if (!point || point.latitude === undefined || point.longitude === undefined || point.recorded_at === undefined) {
        throw new HttpError(400, `Point at index ${index} must include latitude, longitude, and recorded_at`);
      }

      if (
        typeof point.latitude !== "number" ||
        typeof point.longitude !== "number" ||
        !isValidIsoTimestamp(point.recorded_at)
      ) {
        throw new HttpError(400, `Invalid point at index ${index}`);
      }
    }

    console.log("[activities.syncPoints] reading next sequence");
    const sequenceResult = await pool.query("SELECT COALESCE(MAX(sequence), 0) AS max_sequence FROM activity_points WHERE activity_id = $1::uuid", [
      req.params.id
    ]);
    const firstSequence = Number(sequenceResult.rows[0]?.max_sequence ?? 0) + 1;

    console.log("[activities.syncPoints] inserting points", { count: points.length });
    for (const [index, point] of points.entries()) {
      await pool.query(
        `
        INSERT INTO activity_points (activity_id, sequence, latitude, longitude, elevation_meters, accuracy_meters, speed_mps, timestamp)
        VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8)
        `,
        [
          req.params.id,
          firstSequence + index,
          point.latitude,
          point.longitude,
          point.elevation ?? null,
          point.accuracy ?? null,
          point.speed_mps ?? null,
          point.recorded_at
        ]
      );
    }

    console.log("[activities.syncPoints] updating activity timestamp", { activity_id: req.params.id });
    await pool.query("UPDATE activities SET updated_at = NOW() WHERE id = $1::uuid", [req.params.id]);

    console.log("[activities.syncPoints] returning no content");
    res.status(204).send();
  } catch (error) {
    handleActivityError("syncPoints", error);
  }
}

export async function completeActivity(req: Request, res: Response): Promise<void> {
  try {
    console.log("[activities.completeActivity] requiring auth");
    const auth = requireAuth(req);
    const {
      ended_at,
      distance_meters,
      elevation_gain_meters,
      elevation_loss_meters,
      max_elevation_meters,
      min_elevation_meters,
      max_speed_mps,
      avg_speed_mps
    } = req.body as CompleteActivityBody;

    console.log("[activities.completeActivity] validating UUIDs");
    assertUuid(auth.sub, "Authenticated user", 401);
    assertUuid(req.params.id, "Activity id");

    console.log("[activities.completeActivity] verifying activity", { activity_id: req.params.id });
    const activityResult = await pool.query("SELECT user_id, status, start_time, user_id = $2::uuid AS is_owner FROM activities WHERE id = $1::uuid", [
      req.params.id,
      auth.sub
    ]);
    const activity = activityResult.rows[0];

    if (!activity) {
      throw new HttpError(404, "Activity not found");
    }

    if (!activity.is_owner) {
      throw new HttpError(403, "Forbidden");
    }

    if (activity.status !== "recording") {
      throw new HttpError(400, "Activity is not recording");
    }

    console.log("[activities.completeActivity] validating ended_at");
    if (!isValidIsoTimestamp(ended_at)) {
      throw new HttpError(400, "ended_at must be a valid ISO timestamp");
    }

    const startTime = new Date(activity.start_time).getTime();
    const endTime = new Date(ended_at).getTime();

    if (!Number.isFinite(startTime) || endTime <= startTime) {
      throw new HttpError(400, "ended_at must be after start_time");
    }

    console.log("[activities.completeActivity] validating stats");
    assertNumber(distance_meters, "distance_meters");
    assertNumber(elevation_gain_meters, "elevation_gain_meters");
    assertNumber(elevation_loss_meters, "elevation_loss_meters");
    assertNumber(max_elevation_meters, "max_elevation_meters");
    assertNumber(min_elevation_meters, "min_elevation_meters");
    assertNumber(max_speed_mps, "max_speed_mps");
    assertNumber(avg_speed_mps, "avg_speed_mps");

    const elapsedTimeSeconds = Math.floor((endTime - startTime) / 1000);

    console.log("[activities.completeActivity] updating activity", { elapsed_time_seconds: elapsedTimeSeconds });
    const updateResult = await pool.query(
      `
      UPDATE activities
      SET end_time = $3::timestamptz, distance_meters = $4,
          elevation_gain_meters = $5, elevation_loss_meters = $6,
          max_elevation_meters = $7, min_elevation_meters = $8,
          max_speed_mps = $9, avg_speed_mps = $10,
          elapsed_time_seconds = $11, status = 'completed', updated_at = NOW()
      WHERE id = $1::uuid AND user_id = $2::uuid
      RETURNING *
      `,
      [
        req.params.id,
        auth.sub,
        ended_at,
        distance_meters ?? null,
        elevation_gain_meters ?? null,
        elevation_loss_meters ?? null,
        max_elevation_meters ?? null,
        min_elevation_meters ?? null,
        max_speed_mps ?? null,
        avg_speed_mps ?? null,
        elapsedTimeSeconds
      ]
    );

    const updatedActivity = updateResult.rows[0];

    if (!updatedActivity) {
      throw new HttpError(404, "Activity not found");
    }

    console.log("[activities.completeActivity] inserting completed event", { activity_id: req.params.id });
    await pool.query(
      `
      INSERT INTO activity_events (activity_id, event_type, occurred_at)
      VALUES ($1::uuid, 'completed', $2)
      `,
      [req.params.id, ended_at]
    );

    console.log("[activities.completeActivity] updating achievement stats");
    const achievementStats: Parameters<typeof updateUserStats>[1] = {
      distance: distance_meters / 1000,
      trails: updatedActivity.trail_id ? 1 : 0,
      summit: 1
    };

    if (updatedActivity.trail_id) {
      const trailResult = await pool.query<{ region: string | null }>(
        "SELECT region FROM trails WHERE id = $1::uuid",
        [updatedActivity.trail_id]
      );
      const region = trailResult.rows[0]?.region;

      if (region) {
        achievementStats.regionTrail = { region };
        achievementStats.regionVisited = region;
      }
    }

    await updateUserStats(auth.sub, {
      ...achievementStats
    });

    console.log("[activities.completeActivity] returning updated activity", { activity_id: req.params.id });
    res.status(200).json(updatedActivity);
  } catch (error) {
    handleActivityError("completeActivity", error);
  }
}

export async function cancelActivity(req: Request, res: Response): Promise<void> {
  try {
    console.log("[activities.cancelActivity] requiring auth");
    const auth = requireAuth(req);

    console.log("[activities.cancelActivity] validating UUIDs");
    assertUuid(auth.sub, "Authenticated user", 401);
    assertUuid(req.params.id, "Activity id");

    console.log("[activities.cancelActivity] verifying activity", { activity_id: req.params.id });
    const activityResult = await pool.query("SELECT user_id, user_id = $2::uuid AS is_owner FROM activities WHERE id = $1::uuid", [req.params.id, auth.sub]);
    const activity = activityResult.rows[0];

    if (!activity) {
      throw new HttpError(404, "Activity not found");
    }

    if (!activity.is_owner) {
      throw new HttpError(403, "Forbidden");
    }

    console.log("[activities.cancelActivity] soft-deleting activity", { activity_id: req.params.id });
    await pool.query("UPDATE activities SET status = 'cancelled', updated_at = NOW() WHERE id = $1::uuid AND user_id = $2::uuid", [
      req.params.id,
      auth.sub
    ]);

    console.log("[activities.cancelActivity] inserting cancelled event", { activity_id: req.params.id });
    await pool.query(
      `
      INSERT INTO activity_events (activity_id, event_type, occurred_at)
      VALUES ($1::uuid, 'cancelled', NOW())
      `,
      [req.params.id]
    );

    console.log("[activities.cancelActivity] returning no content");
    res.status(204).send();
  } catch (error) {
    handleActivityError("cancelActivity", error);
  }
}

export async function updateActivityStatus(req: Request, res: Response): Promise<void> {
  console.log("[activities.updateActivityStatus] START", { activity_id: req.params.id, body: req.body });
  const client = await pool.connect();

  try {
    console.log("[activities.updateActivityStatus] requiring auth");
    let auth;
    try {
      auth = requireAuth(req);
    } catch (error) {
      if (error instanceof HttpError && error.statusCode === 401) {
        throw new HttpError(401, "Unauthorized");
      }

      throw error;
    }

    const { status, occurred_at } = req.body as UpdateActivityStatusBody;

    console.log("[activities.updateActivityStatus] validating request");
    assertUuid(auth.sub, "Authenticated user", 401);
    assertUuid(req.params.id, "Activity id");

    if (status !== "paused" && status !== "recording") {
      throw new HttpError(400, "Status must be 'paused' or 'recording'");
    }

    if (!isValidIsoTimestamp(occurred_at)) {
      throw new HttpError(400, "occurred_at must be a valid ISO timestamp");
    }

    console.log("[activities.updateActivityStatus] beginning transaction");
    await client.query("BEGIN");

    console.log("[activities.updateActivityStatus] locking activity row", { activity_id: req.params.id });
    const activityResult = await client.query(
      `
      SELECT id, user_id, status, COALESCE(paused_duration_sec, 0) AS paused_duration_sec
      FROM activities
      WHERE id = $1::uuid
      FOR UPDATE
      `,
      [req.params.id]
    );
    const activity = activityResult.rows[0];

    if (!activity) {
      throw new HttpError(404, "Activity not found");
    }

    if (activity.user_id !== auth.sub) {
      throw new HttpError(403, "Not authorized");
    }

    console.log("[activities.updateActivityStatus] validating transition", { current_status: activity.status, next_status: status });
    if (activity.status === "completed" || activity.status === "cancelled") {
      throw new HttpError(400, `Cannot ${status === "paused" ? "pause" : "resume"} a ${activity.status} activity`);
    }

    if (status === "paused" && activity.status !== "recording") {
      throw new HttpError(400, "Cannot pause an activity that is not recording");
    }

    if (status === "recording" && activity.status !== "paused") {
      throw new HttpError(400, "Cannot resume an activity that is not paused");
    }

    let pauseDurationSec = 0;
    let pauseStartedAt: string | null = null;

    if (status === "recording") {
      console.log("[activities.updateActivityStatus] fetching latest pause event", { activity_id: req.params.id });
      const pauseResult = await client.query(
        `
        SELECT occurred_at
        FROM activity_events
        WHERE activity_id = $1::uuid AND event_type = 'paused'
        ORDER BY occurred_at DESC
        LIMIT 1
        `,
        [req.params.id]
      );
      const pauseEvent = pauseResult.rows[0];

      if (!pauseEvent) {
        throw new HttpError(400, "Cannot resume an activity that is not paused");
      }

      pauseStartedAt = pauseEvent.occurred_at instanceof Date ? pauseEvent.occurred_at.toISOString() : String(pauseEvent.occurred_at);
      const pauseStartedMs = new Date(pauseEvent.occurred_at).getTime();
      const resumedMs = new Date(occurred_at).getTime();

      if (!Number.isFinite(pauseStartedMs) || resumedMs < pauseStartedMs) {
        throw new HttpError(400, "occurred_at must be after the pause start time");
      }

      pauseDurationSec = Math.floor((resumedMs - pauseStartedMs) / 1000);
    }

    const eventType = status === "paused" ? "paused" : "resumed";
    const metadata =
      status === "paused"
        ? { pause_started_at: occurred_at }
        : { pause_started_at: pauseStartedAt, pause_duration_sec: pauseDurationSec };

    console.log("[activities.updateActivityStatus] updating activity", {
      next_status: status,
      pause_duration_sec: pauseDurationSec
    });
    const updateResult = await client.query(
      `
      UPDATE activities
      SET status = $3,
          paused_duration_sec = COALESCE(paused_duration_sec, 0) + $4,
          updated_at = $5::timestamptz
      WHERE id = $1::uuid AND user_id = $2::uuid
      RETURNING id, status, paused_duration_sec, updated_at
      `,
      [req.params.id, auth.sub, status, pauseDurationSec, occurred_at]
    );
    const updatedActivity = updateResult.rows[0];

    console.log("[activities.updateActivityStatus] inserting activity event", { event_type: eventType, metadata });
    await client.query(
      `
      INSERT INTO activity_events (activity_id, event_type, occurred_at, metadata)
      VALUES ($1::uuid, $2, $3::timestamptz, $4::jsonb)
      `,
      [req.params.id, eventType, occurred_at, JSON.stringify(metadata)]
    );

    console.log("[activities.updateActivityStatus] committing transaction");
    await client.query("COMMIT");

    console.log("[activities.updateActivityStatus] returning updated activity", { activity_id: updatedActivity.id });
    res.json({ data: updatedActivity });
  } catch (error) {
    console.log("[activities.updateActivityStatus] rolling back transaction");
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.log("[activities.updateActivityStatus] rollback failed", rollbackError);
    }

    handleActivityError("updateActivityStatus", error);
  } finally {
    console.log("[activities.updateActivityStatus] releasing database client");
    client.release();
  }
}

export async function exportGPX(req: Request, res: Response): Promise<void> {
  try {
    const auth = req.auth;

    console.log("[activities.exportGPX] validating UUIDs");
    if (auth) {
      assertUuid(auth.sub, "Authenticated user", 401);
    }
    assertUuid(req.params.id, "Activity id");

    console.log("[activities.exportGPX] fetching activity", { activity_id: req.params.id });
    const activityResult = await pool.query(
      `
      SELECT
        a.start_time,
        a.is_public,
        a.user_id = $2::uuid AS is_owner,
        COALESCE('Hike on ' || t.name, 'Activity ' || a.id::text) AS activity_name
      FROM activities a
      LEFT JOIN trails t ON t.id = a.trail_id
      WHERE a.id = $1::uuid
      `,
      [req.params.id, auth?.sub ?? null]
    );
    const activity = activityResult.rows[0];

    if (!activity) {
      throw new HttpError(404, "Activity not found");
    }

    if (!activity.is_public && !auth) {
      throw new HttpError(401, "Authentication required");
    }

    if (!activity.is_public && !activity.is_owner) {
      throw new HttpError(403, "Forbidden");
    }

    console.log("[activities.exportGPX] fetching points", { activity_id: req.params.id });
    const pointsResult = await pool.query(
      `
      SELECT latitude, longitude, elevation_meters AS elevation, timestamp AS recorded_at
      FROM activity_points
      WHERE activity_id = $1::uuid
      ORDER BY sequence ASC
      `,
      [req.params.id]
    );

    console.log("[activities.exportGPX] building GPX", { point_count: pointsResult.rowCount, start_time: activity.start_time });
    const trackPoints = pointsResult.rows
      .map((point) => {
        const elevation = point.elevation === null || point.elevation === undefined ? "" : `\n        <ele>${escapeXml(point.elevation)}</ele>`;
        return `      <trkpt lat="${escapeXml(point.latitude)}" lon="${escapeXml(point.longitude)}">${elevation}
        <time>${escapeXml(formatGpxTime(point.recorded_at))}</time>
      </trkpt>`;
      })
      .join("\n");

    const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Traces" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>${escapeXml(activity.activity_name)}</name>
    <trkseg>
${trackPoints}
    </trkseg>
  </trk>
</gpx>`;

    console.log("[activities.exportGPX] sending GPX response");
    res.setHeader("Content-Type", "application/gpx+xml");
    res.setHeader("Content-Disposition", `attachment; filename="activity_${req.params.id}.gpx"`);
    res.send(gpx);
  } catch (error) {
    handleActivityError("exportGPX", error);
  }
}

export async function sosAlert(req: Request, res: Response): Promise<void> {
  try {
    console.log("[activities.sosAlert] requiring auth");
    const auth = requireAuth(req);
    const { activity_id, message, occurred_at } = req.body as SosAlertBody;

    console.log("[activities.sosAlert] validating auth subject");
    assertUuid(auth.sub, "Authenticated user", 401);

    console.log("[activities.sosAlert] validating coordinates and timestamp");
    const latitude = parseCoordinate(req.body.latitude, "latitude", -90, 90);
    const longitude = parseCoordinate(req.body.longitude, "longitude", -180, 180);

    if (!isValidIsoTimestamp(occurred_at)) {
      throw new HttpError(400, "occurred_at must be a valid ISO timestamp");
    }

    if (activity_id) {
      console.log("[activities.sosAlert] validating activity_id");
      assertUuid(activity_id, "activity_id");

      console.log("[activities.sosAlert] verifying activity ownership", { activity_id });
      const activityResult = await pool.query("SELECT id FROM activities WHERE id = $1::uuid AND user_id = $2::uuid", [activity_id, auth.sub]);

      if (!activityResult.rows[0]) {
        throw new HttpError(404, "Activity not found");
      }
    }

    console.log("[activities.sosAlert] creating SOS lifecycle event");
    const result = await createSosEvent({
      userId: auth.sub,
      activityId: activity_id ?? null,
      latitude,
      longitude,
      message: typeof message === "string" ? message : null,
      occurredAt: occurred_at,
    });

    console.log("[activities.sosAlert] returning SOS event", { sos_id: result.id });
    res.status(201).json({ data: result });
  } catch (error) {
    handleActivityError("sosAlert", error);
  }
}

export const createActivity = startActivity;
export const addActivityPoints = syncPoints;
export const deleteActivity = cancelActivity;
export const exportActivityGpx = exportGPX;

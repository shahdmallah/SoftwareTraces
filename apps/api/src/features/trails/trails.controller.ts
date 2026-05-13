import type { Request, Response } from "express";
import { randomUUID } from "crypto";
import { ZodError, z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { pool } from "../../db/pool";
import { env } from "../../config/env";
import * as trailStatsService from "./trails.service";
import { requireAuth } from "../../middleware/auth";
import { HttpError } from "../../lib/httpError";
import { formatTrailForApp } from "../../utils/formatTrail";
import { getElevationForPoint } from "../../services/elevationService";

const calculateTrailStatsBodySchema = z.object({
  coordinates: z.array(z.tuple([z.number(), z.number()])).min(2),
});

const createTrailBodySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  coordinates: z.array(z.tuple([z.number(), z.number()])).min(2),
  stats: z.object({
    length_meters: z.number().nonnegative(),
    elevation_gain_meters: z.number().nonnegative(),
    estimated_duration_minutes: z.number().nonnegative(),
    difficulty: z.enum(["easy", "moderate", "hard", "expert"]),
  }),
});

const createTrailReviewBodySchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  title: z.string().trim().optional(),
  content: z.string().trim().min(2),
});

const elevationProfileQuerySchema = z.object({
  points: z.coerce.number().int().min(10).max(200).optional().default(50),
  simplify: z
    .union([
      z.boolean(),
      z
        .string()
        .transform((value) => value.trim().toLowerCase())
        .refine((value) => ["true", "false", "1", "0"].includes(value), {
          message: "simplify must be a boolean",
        })
        .transform((value) => value === "true" || value === "1"),
    ])
    .optional()
    .default(true),
});

interface TrailSamplePoint {
  lng: number;
  lat: number;
  distance_meters: number;
}

export interface ElevationProfileData {
  elevations: number[];
  distances: number[];
  total_gain: number;
  total_loss: number;
  min_elevation: number;
  max_elevation: number;
  start_elevation: number;
  end_elevation: number;
  warnings?: string[];
}

export interface ElevationProfileResponse {
  data: ElevationProfileData;
}

interface ElevationProfileCacheEntry {
  profile: ElevationProfileData;
  timestamp: number;
}

const elevationProfileCache = new Map<string, ElevationProfileCacheEntry>();
const ELEVATION_PROFILE_CACHE_TTL = 60 * 60 * 1000;
const DEFAULT_SMOOTHING_WINDOW = 3;
function getTrailSelectFields(alias?: string): string {
  const prefix = alias ? `${alias}.` : "";
  return `
    ${prefix}id,
    ${prefix}slug,
    ${prefix}name,
    ${prefix}name_ar,
    ${prefix}description,
    ${prefix}description_ar,
    ${prefix}region,
    ${prefix}region_ar,
    ${prefix}length_meters,
    ${prefix}elevation_gain_meters,
    ${prefix}elevation_min,
    ${prefix}elevation_max,
    ${prefix}estimated_duration_minutes,
    ${prefix}difficulty,
    ${prefix}average_rating,
    ${prefix}total_reviews,
    ${prefix}rating,
    ${prefix}reviews,
    ${prefix}image,
    ${prefix}images,
    ${prefix}features,
    ${prefix}features_ar,
    ${prefix}has_checkpoint,
    ${prefix}checkpoint_note,
    ${prefix}tags,
    ${prefix}user_id,
    ${prefix}is_active,
    ${prefix}status,
    ${prefix}published_at,
    ${prefix}deleted_at,
    ${prefix}created_at,
    ${prefix}updated_at,
    ST_AsText(${prefix}start_point::geometry) AS start_point_text,
    ST_X(ST_StartPoint(${prefix}geometry::geometry)) AS start_lng,
    ST_Y(ST_StartPoint(${prefix}geometry::geometry)) AS start_lat,
    ST_AsText(${prefix}geometry::geometry) AS geometry_text
  `;
}

function getElevationProfileCacheKey(trailId: string, points: number, simplify: boolean): string {
  return `${trailId}:${points}:${simplify ? "smooth" : "raw"}`;
}

function getCachedElevationProfile(key: string): ElevationProfileData | null {
  const cached = elevationProfileCache.get(key);
  if (!cached) {
    return null;
  }

  if (Date.now() - cached.timestamp >= ELEVATION_PROFILE_CACHE_TTL) {
    elevationProfileCache.delete(key);
    return null;
  }

  return cached.profile;
}

function setCachedElevationProfile(key: string, profile: ElevationProfileData): void {
  elevationProfileCache.set(key, {
    profile,
    timestamp: Date.now(),
  });
}

function smoothElevationSeries(elevations: number[], windowSize: number = DEFAULT_SMOOTHING_WINDOW): number[] {
  if (elevations.length <= 2 || windowSize <= 1) {
    return [...elevations];
  }

  const halfWindow = Math.floor(windowSize / 2);
  return elevations.map((_, index) => {
    let sum = 0;
    let count = 0;

    for (let cursor = index - halfWindow; cursor <= index + halfWindow; cursor += 1) {
      if (cursor < 0 || cursor >= elevations.length) {
        continue;
      }

      sum += elevations[cursor];
      count += 1;
    }

    return count > 0 ? Number((sum / count).toFixed(2)) : elevations[index];
  });
}

function calculateElevationProfileStats(elevations: number[]) {
  let totalGain = 0;
  let totalLoss = 0;

  for (let index = 1; index < elevations.length; index += 1) {
    const delta = elevations[index] - elevations[index - 1];
    if (delta > 0) {
      totalGain += delta;
      continue;
    }

    totalLoss += Math.abs(delta);
  }

  return {
    total_gain: Math.round(totalGain),
    total_loss: Math.round(totalLoss),
    min_elevation: Math.min(...elevations),
    max_elevation: Math.max(...elevations),
    start_elevation: elevations[0] ?? 0,
    end_elevation: elevations[elevations.length - 1] ?? 0,
  };
}

async function getTrailSamplePoints(trailId: string, points: number): Promise<TrailSamplePoint[]> {
  const query = `
    WITH steps AS (
      SELECT generate_series(0, $2 - 1) AS step_index
    ),
    fractions AS (
      SELECT
        step_index,
        CASE
          WHEN $2 = 1 THEN 0::float
          ELSE step_index::float / ($2 - 1)::float
        END AS fraction
      FROM steps
    )
    SELECT
      ST_X(ST_LineInterpolatePoint(t.geometry::geometry, fractions.fraction)) AS lng,
      ST_Y(ST_LineInterpolatePoint(t.geometry::geometry, fractions.fraction)) AS lat,
      ST_Length(ST_LineSubstring(t.geometry::geometry, 0, fractions.fraction)::geography) AS distance_meters
    FROM trails t
    CROSS JOIN fractions
    WHERE t.id = $1
      AND t.deleted_at IS NULL
      AND t.is_active = true
    ORDER BY fractions.step_index ASC
  `;

  const result = await pool.query<TrailSamplePoint>(query, [trailId, points]);
  return result.rows;
}

async function resolveElevationsForSamples(
  trailId: string,
  samplePoints: TrailSamplePoint[],
): Promise<{ elevations: number[]; warnings: string[]; completeFailure: boolean }> {
  const warnings: string[] = [];
  let successCount = 0;

  const elevations = await Promise.all(
    samplePoints.map(async ({ lng, lat }, index) => {
      try {
        const elevation = await getElevationForPoint(lng, lat);
        successCount += 1;
        return Math.round(elevation);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        warnings.push(`Failed to fetch elevation for point ${index + 1}/${samplePoints.length}: ${message}`);
        console.warn(`[getElevationProfile] Elevation lookup failed for trail ${trailId} at sample ${index + 1}:`, error);
        return 0;
      }
    }),
  );

  return {
    elevations,
    warnings,
    completeFailure: successCount === 0,
  };
}

const validReviewPhotoMimeTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
const reviewPhotoExtensionByMimeType: Record<(typeof validReviewPhotoMimeTypes)[number], string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
};
const maxReviewPhotoSizeBytes = 5 * 1024 * 1024;

interface ReviewPhotoRow {
  id: string;
  user_id: string;
  photo_url: string;
  photo_storage_path: string;
  created_at?: string;
}

interface ReviewPhotoResponse {
  id: string;
  url: string;
  created_at?: string;
}

interface TrailReviewWithPhotosRow {
  id: string;
  trail_id: string;
  user_id: string;
  rating: number;
  title: string | null;
  content: string;
  created_at: string;
  photos: ReviewPhotoResponse[] | null;
}

// Helper: Get Supabase storage client
function getSupabaseStorageClient() {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase configuration missing");
  }
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

function createTrailSlug(name: string): string {
  const baseSlug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  const slugPrefix = baseSlug.length > 0 ? baseSlug : "trail";
  return `${slugPrefix}-${randomUUID().slice(0, 8)}`;
}

function getRequestId(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] : (value ?? "");
}

export async function getNearbyTrails(req: Request, res: Response): Promise<void> {
  console.log("[getNearbyTrails] ========== FUNCTION STARTED ==========");

  try {
    console.log("[getNearbyTrails] Step 1: Building query...");
    const { lat, lng, radius = 10000 } = req.query;
    const query = `
      SELECT
        ${getTrailSelectFields()},
        ST_Distance(
          geometry,
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
        ) AS distance_meters
      FROM trails
      WHERE is_active = true
        AND deleted_at IS NULL
        AND ST_DWithin(
          geometry,
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
          $3
        )
      ORDER BY distance_meters ASC
    `;

    console.log("[getNearbyTrails] Step 2: Executing query...");
    const result = await pool.query(query, [Number(lng), Number(lat), Number(radius)]);
    console.log("[getNearbyTrails] Step 3: Query succeeded, rows:", result.rows.length);

    console.log("[getNearbyTrails] Step 4: Formatting results...");
    const formattedTrails = result.rows.map(formatTrailForApp);

    console.log("[getNearbyTrails] Step 5: Sending response...");
    res.json({ data: formattedTrails });
  } catch (error) {
    console.error("[getNearbyTrails] CATCH BLOCK ERROR:", error);
    console.error("[getNearbyTrails] Error message:", error instanceof Error ? error.message : String(error));
    console.error("[getNearbyTrails] Error stack:", error instanceof Error ? error.stack : "No stack");
    res.status(500).json({ error: "Internal server error", details: error instanceof Error ? error.message : String(error) });
  }
}

export async function searchTrails(req: Request, res: Response): Promise<void> {
  console.log("[searchTrails] ========== FUNCTION STARTED ==========");

  try {
    console.log("[searchTrails] Step 1: Building query...");
    const q = String(req.query.q ?? "").trim();
    const difficulty = req.query.difficulty ? String(req.query.difficulty) : null;
    const minLength = req.query.minLength != null ? Number(req.query.minLength) : null;
    const maxLength = req.query.maxLength != null ? Number(req.query.maxLength) : null;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const query = `
      SELECT
        ${getTrailSelectFields()}
      FROM trails
      WHERE is_active = true
        AND deleted_at IS NULL
        AND (
          name ILIKE $1
          OR description ILIKE $1
          OR region ILIKE $1
          OR tags::text ILIKE $1
        )
        AND ($2::TEXT IS NULL OR difficulty = $2)
        AND ($3::numeric IS NULL OR length_meters / 1000.0 >= $3)
        AND ($4::numeric IS NULL OR length_meters / 1000.0 <= $4)
      ORDER BY created_at DESC
      LIMIT $5 OFFSET $6
    `;

    console.log("[searchTrails] Step 2: Executing query...");
    const searchTerm = `%${q}%`;
    const result = await pool.query(query, [searchTerm, difficulty, minLength, maxLength, limit, offset]);
    console.log("[searchTrails] Step 3: Query succeeded, rows:", result.rows.length);

    console.log("[searchTrails] Step 4: Formatting results...");
    const formattedTrails = result.rows.map(formatTrailForApp);

    console.log("[searchTrails] Step 5: Sending response...");
    res.json({
      data: formattedTrails,
      pagination: {
        page,
        limit,
        count: formattedTrails.length,
      },
    });
  } catch (error) {
    console.error("[searchTrails] CATCH BLOCK ERROR:", error);
    console.error("[searchTrails] Error message:", error instanceof Error ? error.message : String(error));
    console.error("[searchTrails] Error stack:", error instanceof Error ? error.stack : "No stack");
    res.status(500).json({ error: "Internal server error", details: error instanceof Error ? error.message : String(error) });
  }
}

export async function getAllTrails(req: Request, res: Response): Promise<void> {
  console.log("[getAllTrails] ========== FUNCTION STARTED ==========");

  try {
    console.log("[getAllTrails] Step 1: Building query...");
    const query = `
      SELECT 
        ${getTrailSelectFields()}
      FROM trails
      WHERE is_active = true
        AND deleted_at IS NULL
      ORDER BY created_at DESC
    `;

    console.log("[getAllTrails] Step 2: Executing query...");
    const result = await pool.query(query);
    console.log("[getAllTrails] Step 3: Query succeeded, rows:", result.rows.length);

    console.log("[getAllTrails] Step 4: Formatting results...");
    const formattedTrails = result.rows.map(formatTrailForApp);

    console.log("[getAllTrails] Step 5: Sending response...");
    res.json({ data: formattedTrails });
  } catch (error) {
    console.error("[getAllTrails] CATCH BLOCK ERROR:", error);
    console.error("[getAllTrails] Error message:", error instanceof Error ? error.message : String(error));
    console.error("[getAllTrails] Error stack:", error instanceof Error ? error.stack : "No stack");
    res.status(500).json({ error: "Internal server error", details: error instanceof Error ? error.message : String(error) });
  }
}

export async function getTrailById(req: Request, res: Response): Promise<void> {
  console.log("[getTrailById] ========== FUNCTION STARTED ==========");

  try {
    console.log("[getTrailById] Step 1: Building query...");
    const query = `
      SELECT
        ${getTrailSelectFields()}
      FROM trails
      WHERE id = $1
        AND deleted_at IS NULL
    `;

    console.log("[getTrailById] Step 2: Executing query...");
    const trailId = getRequestId(req.params.id);
    const trailResult = await pool.query(query, [trailId]);
    console.log("[getTrailById] Step 3: Query succeeded, rows:", trailResult.rows.length);

    if (trailResult.rows.length === 0) {
      console.log("[getTrailById] No trail found for id:", trailId);
      res.status(404).json({ error: "Trail not found" });
      return;
    }

    console.log("[getTrailById] Step 4: Formatting result...");
    const formattedTrail = formatTrailForApp(trailResult.rows[0]);

    console.log("[getTrailById] Step 5: Sending response...");
    res.json({ data: formattedTrail });
  } catch (error) {
    console.error("[getTrailById] CATCH BLOCK ERROR:", error);
    console.error("[getTrailById] Error message:", error instanceof Error ? error.message : String(error));
    console.error("[getTrailById] Error stack:", error instanceof Error ? error.stack : "No stack");
    res.status(500).json({ error: "Internal server error", details: error instanceof Error ? error.message : String(error) });
  }
}

export async function getElevationProfile(req: Request, res: Response): Promise<void> {
  try {
    const trailId = getRequestId(req.params.id);
    const query = elevationProfileQuerySchema.safeParse(req.query);

    if (!query.success) {
      res.status(400).json({ error: "Validation failed", details: query.error.flatten() });
      return;
    }

    const { points, simplify } = query.data;
    const cacheKey = getElevationProfileCacheKey(trailId, points, simplify);
    const cachedProfile = getCachedElevationProfile(cacheKey);

    if (cachedProfile) {
      const cachedResponse: ElevationProfileResponse = { data: cachedProfile };
      res.json(cachedResponse);
      return;
    }

    const samplePoints = await getTrailSamplePoints(trailId, points);
    if (samplePoints.length === 0) {
      res.status(404).json({ error: "Trail not found" });
      return;
    }

    const { elevations: rawElevations, warnings, completeFailure } = await resolveElevationsForSamples(trailId, samplePoints);
    if (completeFailure) {
      res.status(500).json({
        error: "Elevation API failed completely",
        details: "No elevation samples could be resolved for this trail",
      });
      return;
    }

    const elevations = simplify ? smoothElevationSeries(rawElevations) : rawElevations;
    const distances = samplePoints.map((point) => Math.round(Number(point.distance_meters)));
    const profile: ElevationProfileData = {
      elevations,
      distances,
      ...calculateElevationProfileStats(elevations),
      ...(warnings.length > 0 ? { warnings } : {}),
    };

    setCachedElevationProfile(cacheKey, profile);

    const response: ElevationProfileResponse = { data: profile };
    res.json(response);
  } catch (error) {
    console.error("[getElevationProfile] Error:", error);
    res.status(500).json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function calculateTrailStats(req: Request, res: Response): Promise<void> {
  const { coordinates } = calculateTrailStatsBodySchema.parse(req.body);
  const stats = await trailStatsService.calculateTrailStats(coordinates);

  res.json({ data: stats });
}

export async function createTrail(req: Request, res: Response): Promise<void> {
  try {
    const auth = requireAuth(req);
    const userId = auth.sub;

    console.error("[createTrail] auth.userId:", userId);
    console.error("[createTrail] request body:", JSON.stringify(req.body, null, 2));

    const { name, description, coordinates, stats } = createTrailBodySchema.parse(req.body);

    if (!Array.isArray(coordinates) || coordinates.length < 2) {
      throw new Error("Coordinates must contain at least 2 points");
    }

    coordinates.forEach((coordinate, index) => {
      if (
        !Array.isArray(coordinate) ||
        coordinate.length !== 2 ||
        typeof coordinate[0] !== "number" ||
        typeof coordinate[1] !== "number" ||
        Number.isNaN(coordinate[0]) ||
        Number.isNaN(coordinate[1])
      ) {
        throw new Error(`Invalid coordinate at index ${index}: ${JSON.stringify(coordinate)}`);
      }
    });

    if (!stats || typeof stats !== "object") {
      throw new Error("Stats object is required");
    }

    const requiredStats = [
      "length_meters",
      "elevation_gain_meters",
      "estimated_duration_minutes",
      "difficulty",
    ] as const;

    requiredStats.forEach((field) => {
      if (stats[field] === undefined || stats[field] === null) {
        throw new Error(`Missing stats field: ${field}`);
      }
    });

    const slug = createTrailSlug(name);
    const region = "Unknown";
    const linestring = `LINESTRING(${coordinates.map(([lng, lat]) => `${lng} ${lat}`).join(", ")})`;
    const [startLng, startLat] = coordinates[0];

    const insertQuery = `INSERT INTO trails (
      slug,
      name,
      description,
      region,
      difficulty,
      length_meters,
      elevation_gain_meters,
      estimated_duration_minutes,
      start_point,
      geometry,
      user_id,
      is_active
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8,
      ST_GeomFromText($9, 4326),
      ST_GeogFromText($10),
      $11,
      $12
    ) RETURNING id`;

    const queryValues = [
      slug,
      name,
      description ?? "",
      region,
      stats.difficulty,
      Math.round(stats.length_meters),
      stats.elevation_gain_meters,
      Math.round(stats.estimated_duration_minutes),
      `POINT(${startLng} ${startLat})`,
      linestring,
      userId,
      true,
    ];

    console.error("[createTrail] insert query:", insertQuery);
    console.error("[createTrail] query values:", JSON.stringify(queryValues, null, 2));

    const result = await pool.query(insertQuery, queryValues);
    const createdTrail = await pool.query(
      `SELECT
         ${getTrailSelectFields()}
       FROM trails
       WHERE id = $1`,
      [result.rows[0].id]
    );
    const formattedTrail = formatTrailForApp(createdTrail.rows[0]);

    res.status(201).json({ data: formattedTrail });
  } catch (error) {
    console.error("[createTrail] error message:", error instanceof Error ? error.message : error);
    console.error("[createTrail] error stack:", error instanceof Error ? error.stack : undefined);

    if (error instanceof HttpError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }

    if (error instanceof ZodError) {
      res.status(400).json({ error: "Validation failed", details: error.flatten() });
      return;
    }

    res.status(500).json({ error: "Internal server error" });
  }
}

export async function getTrailReviews(req: Request, res: Response): Promise<void> {
  const trailId = getRequestId(req.params.id);
  const result = await pool.query<TrailReviewWithPhotosRow>(
    `SELECT
       tr.*,
       COALESCE(
         json_agg(
           json_build_object(
             'id', rp.id,
             'url', rp.photo_url,
             'created_at', rp.created_at
           )
           ORDER BY rp.created_at ASC
         ) FILTER (WHERE rp.id IS NOT NULL),
         '[]'::json
       ) AS photos
     FROM trail_reviews tr
     LEFT JOIN review_photos rp ON rp.review_id = tr.id
     WHERE tr.trail_id = $1
     GROUP BY tr.id
     ORDER BY tr.created_at DESC`,
    [trailId]
  );

  res.json({
    data: result.rows.map((row) => ({
      id: row.id,
      trail_id: row.trail_id,
      user_id: row.user_id,
      rating: row.rating,
      title: row.title,
      content: row.content,
      created_at: row.created_at,
      photos: Array.isArray(row.photos) ? row.photos : [],
    })),
  });
}

export async function createTrailReview(req: Request, res: Response): Promise<void> {
  console.log("[createTrailReview] ========== START ==========");
  console.log("[createTrailReview] 1. Trail ID:", req.params.id);
  console.log("[createTrailReview] 2. Request body:", JSON.stringify(req.body, null, 2));
  console.log("[createTrailReview] 3. Auth user:", (req as any).auth?.sub);
  console.log("[createTrailReview] 4. Content-Type:", req.get("content-type"));
  console.log("[createTrailReview] 5. Multipart request:", req.is("multipart/form-data"));
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  console.log("[createTrailReview] Number of files:", files.length);
  console.log("[createTrailReview] Step 1: Files received:", files.length);
  console.log("[createTrailReview] Photo files:", files.map((file) => file.originalname));

  try {
    const auth = requireAuth(req);
    console.log("[createTrailReview] Auth passed, userId:", auth.sub);

    const trailId = getRequestId(req.params.id);
    const isMultipart = Boolean(req.is("multipart/form-data"));
    const parsedBody = createTrailReviewBodySchema.parse(req.body);
    const rating = parsedBody.rating;
    const title = parsedBody.title && parsedBody.title.length > 0 ? parsedBody.title : null;
    const content = parsedBody.content;
    console.log("[createTrailReview] Parsed values:", { rating, title, content, isMultipart });

    console.log("[createTrailReview] Step 2: Validating files...");
    for (const [index, file] of files.entries()) {
      if (!validReviewPhotoMimeTypes.includes(file.mimetype as (typeof validReviewPhotoMimeTypes)[number])) {
        console.warn("[createTrailReview] Invalid review photo MIME type:", {
          index,
          originalname: file.originalname,
          mimetype: file.mimetype,
        });
        res.status(400).json({
          error: "Invalid file type",
          details: `Only JPEG, PNG, GIF, and WebP images are allowed. Invalid file: ${file.originalname}`,
        });
        return;
      }

      if (file.size > maxReviewPhotoSizeBytes) {
        console.warn("[createTrailReview] Review photo too large:", {
          index,
          originalname: file.originalname,
          size: file.size,
        });
        res.status(400).json({
          error: "File too large",
          details: `Maximum file size is 5MB. ${file.originalname} is ${(file.size / 1024 / 1024).toFixed(2)}MB`,
        });
        return;
      }
    }

    const client = await pool.connect();
    const uploadedStoragePaths: string[] = [];

    try {
      console.log("[createTrailReview] Starting database transaction...");
      await client.query("BEGIN");

      console.log("[createTrailReview] Step 3: Inserting or updating review...");
      const result = await client.query<{
        id: string;
        trail_id: string;
        user_id: string;
        rating: number;
        title: string | null;
        content: string;
        created_at: string;
        updated_at: string;
      }>(
        `INSERT INTO trail_reviews (
           trail_id,
           user_id,
           rating,
           title,
           content,
           created_at,
           updated_at
         )
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
         ON CONFLICT (trail_id, user_id)
         DO UPDATE SET
           rating = EXCLUDED.rating,
           title = EXCLUDED.title,
           content = EXCLUDED.content,
           updated_at = NOW()
         RETURNING id, trail_id, user_id, rating, title, content, created_at, updated_at`,
        [trailId, auth.sub, rating, title, content]
      );

      const review = result.rows[0];
      const reviewId = review.id;
      const uploadedPhotos: ReviewPhotoResponse[] = [];
      console.log("[createTrailReview] Step 4: Review upserted with ID:", reviewId);

      if (files.length > 0) {
        const supabase = getSupabaseStorageClient();

        for (const [index, file] of files.entries()) {
          const fileExtension = reviewPhotoExtensionByMimeType[file.mimetype as keyof typeof reviewPhotoExtensionByMimeType];
          const storagePath = `${trailId}/${reviewId}/${Date.now()}-${index}.${fileExtension}`;

          console.log("[createTrailReview] Step 5: Uploading photo", index + 1, "of", files.length, "to:", storagePath);
          const { error: uploadError } = await supabase.storage
            .from("review-photos")
            .upload(storagePath, file.buffer, {
              contentType: file.mimetype,
              upsert: false,
            });

          if (uploadError) {
            console.error("[createTrailReview] Photo upload failed:", uploadError);
            throw new Error(`Failed to upload review photo ${file.originalname}: ${uploadError.message}`);
          }

          uploadedStoragePaths.push(storagePath);
          console.log("[createTrailReview] Step 6: Photo uploaded successfully:", storagePath);

          const { data: urlData } = supabase.storage.from("review-photos").getPublicUrl(storagePath);
          const photoResult = await client.query<ReviewPhotoRow>(
            `INSERT INTO review_photos (
               review_id,
               user_id,
               photo_url,
               photo_storage_path
             )
             VALUES ($1, $2, $3, $4)
             RETURNING id, user_id, photo_url, photo_storage_path, created_at`,
            [reviewId, auth.sub, urlData?.publicUrl ?? "", storagePath]
          );

          const photo = photoResult.rows[0];
          uploadedPhotos.push({
            id: photo.id,
            url: photo.photo_url,
            created_at: photo.created_at,
          });
          console.log("[createTrailReview] Photo record inserted with ID:", photo.id);
        }
      }

      console.log("[createTrailReview] Step 7: All photos uploaded, committing transaction");
      await client.query("COMMIT");
      console.log("[createTrailReview] Transaction committed successfully");

      res.status(201).json({
        data: {
          ...review,
          photos: uploadedPhotos,
        },
      });
    } catch (transactionError) {
      console.error("[createTrailReview] Transaction failed, rolling back:", transactionError);
      await client.query("ROLLBACK");
      console.log("[createTrailReview] Transaction rolled back");

      if (uploadedStoragePaths.length > 0) {
        console.log("[createTrailReview] Deleting uploaded storage objects after rollback:", uploadedStoragePaths);
        const supabase = getSupabaseStorageClient();
        const { error: cleanupError } = await supabase.storage
          .from("review-photos")
          .remove(uploadedStoragePaths);

        if (cleanupError) {
          console.error("[createTrailReview] Failed to clean up uploaded photos:", cleanupError);
        } else {
          console.log("[createTrailReview] Uploaded storage objects deleted after rollback");
        }
      }

      throw transactionError;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("[createTrailReview] ❌ ERROR CAUGHT:");
    console.error("[createTrailReview] Error object:", error);
    console.error("[createTrailReview] Error message:", error instanceof Error ? error.message : String(error));
    console.error("[createTrailReview] Error stack:", error instanceof Error ? error.stack : "No stack");

    if (error instanceof HttpError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }

    if (error instanceof ZodError) {
      res.status(400).json({ error: "Validation failed", details: error.flatten() });
      return;
    }

    res.status(500).json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : String(error)
    });
  }
}

export async function deleteReviewPhoto(req: Request, res: Response): Promise<void> {
  console.log("[deleteReviewPhoto] ========== START ==========");
  console.log("[deleteReviewPhoto] Photo ID:", req.params.id);

  try {
    const auth = requireAuth(req);
    const photoId = getRequestId(req.params.id);
    const authenticatedUserId = String(auth.sub).trim().toLowerCase();
    console.log("[deleteReviewPhoto] Authenticated user ID:", authenticatedUserId);
    console.log("[deleteReviewPhoto] Normalized photo ID:", photoId);

    const photoResult = await pool.query<{
      id: string;
      photo_storage_path: string;
      photo_user_id: string | null;
      review_user_id: string;
      trail_user_id: string | null;
    }>(
      `SELECT
         rp.id,
         rp.user_id AS photo_user_id,
         rp.photo_storage_path,
         tr.user_id AS review_user_id,
         t.user_id AS trail_user_id
       FROM review_photos rp
       JOIN trail_reviews tr ON tr.id = rp.review_id
       JOIN trails t ON t.id = tr.trail_id
       WHERE rp.id = $1`,
      [photoId]
    );
    console.log("[deleteReviewPhoto] Photo query row count:", photoResult.rows.length);

    if (photoResult.rows.length === 0) {
      console.warn("[deleteReviewPhoto] Review photo not found:", photoId);
      res.status(404).json({ error: "Review photo not found" });
      return;
    }

    const photo = photoResult.rows[0];
    const photoUserId = photo.photo_user_id ? String(photo.photo_user_id).trim().toLowerCase() : null;
    const reviewUserId = String(photo.review_user_id).trim().toLowerCase();
    const trailUserId = photo.trail_user_id ? String(photo.trail_user_id).trim().toLowerCase() : null;

    console.log("[deleteReviewPhoto] Authorization IDs:", {
      authenticatedUserId,
      photoUserId,
      reviewUserId,
      trailUserId,
      rawPhotoUserId: photo.photo_user_id,
      rawReviewUserId: photo.review_user_id,
      rawTrailUserId: photo.trail_user_id,
    });

    const isPhotoOwner = photoUserId === authenticatedUserId;
    const isReviewOwner = reviewUserId === authenticatedUserId;
    const isTrailOwner = trailUserId === authenticatedUserId;
    console.log("[deleteReviewPhoto] Authorization checks:", {
      isPhotoOwner,
      isReviewOwner,
      isTrailOwner,
    });

    if (!isPhotoOwner && !isReviewOwner && !isTrailOwner) {
      console.warn("[deleteReviewPhoto] Unauthorized delete attempt:", {
        authenticatedUserId,
        photoId,
        photoUserId,
        reviewUserId,
        trailUserId,
      });
      res.status(403).json({ error: "Not authorized to delete this review photo" });
      return;
    }

    console.log("[deleteReviewPhoto] Authorization passed. Deleting storage path:", photo.photo_storage_path);
    const supabase = getSupabaseStorageClient();
    const { error: storageError } = await supabase.storage
      .from("review-photos")
      .remove([photo.photo_storage_path]);

    if (storageError) {
      console.error("[deleteReviewPhoto] Storage deletion failed:", storageError);
      res.status(500).json({ error: "Failed to delete review photo from storage", details: storageError.message });
      return;
    }

    console.log("[deleteReviewPhoto] Storage object deleted. Deleting database row...");
    await pool.query("DELETE FROM review_photos WHERE id = $1", [photoId]);

    console.log("[deleteReviewPhoto] Review photo deleted successfully:", photoId);
    res.json({ message: "Review photo deleted successfully" });
  } catch (error) {
    console.error("[deleteReviewPhoto] ERROR CAUGHT:", error);
    console.error("[deleteReviewPhoto] Error message:", error instanceof Error ? error.message : String(error));
    console.error("[deleteReviewPhoto] Error stack:", error instanceof Error ? error.stack : "No stack");
    res.status(500).json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function getTrailConditions(req: Request, res: Response): Promise<void> {
  console.log("[getTrailConditions] ========== START ==========");
  console.log("[getTrailConditions] Trail ID:", req.params.id);

  try {
    console.log("[getTrailConditions] Executing SELECT query...");
    const result = await pool.query(
      `SELECT id, trail_id, user_id, condition_type, severity, description, reported_at, is_resolved, resolved_at, created_at
       FROM trail_conditions
       WHERE trail_id = $1
       ORDER BY reported_at DESC
       LIMIT 20`,
      [req.params.id]
    );

    console.log("[getTrailConditions] Query succeeded, rows:", result.rows.length);
    res.json({ data: result.rows });
  } catch (error) {
    console.error("[getTrailConditions] ❌ ERROR CAUGHT:");
    console.error("[getTrailConditions] Error message:", error instanceof Error ? error.message : String(error));
    console.error("[getTrailConditions] Error stack:", error instanceof Error ? error.stack : "No stack");

    res.status(500).json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : String(error)
    });
  }
}

export async function createTrailCondition(req: Request, res: Response): Promise<void> {
  console.log("[createTrailCondition] ========== START ==========");
  console.log("[createTrailCondition] 1. Trail ID:", req.params.id);
  console.log("[createTrailCondition] 2. Request body:", JSON.stringify(req.body, null, 2));
  console.log("[createTrailCondition] 3. Auth user:", (req as any).auth?.sub);

  try {
    const auth = requireAuth(req);
    console.log("[createTrailCondition] 4. Auth passed, userId:", auth.sub);

    const trailId = req.params.id;
    const { condition_type, severity, description } = req.body;
    console.log("[createTrailCondition] 5. Destructured values:", { condition_type, severity, description });

    // Validate condition_type
    const validConditionTypes = ['snow', 'ice', 'mud', 'flood', 'fallen_trees', 'wildfire', 'closure', 'good', 'fair'];
    if (!validConditionTypes.includes(condition_type)) {
      console.warn("[createTrailCondition] Invalid condition_type:", condition_type);
      res.status(400).json({
        error: "Invalid condition_type",
        details: `condition_type must be one of: ${validConditionTypes.join(', ')}`
      });
      return;
    }

    // Validate severity if provided
    if (severity) {
      const validSeverities = ['low', 'medium', 'high', 'extreme'];
      if (!validSeverities.includes(severity)) {
        console.warn("[createTrailCondition] Invalid severity:", severity);
        res.status(400).json({
          error: "Invalid severity",
          details: `severity must be one of: ${validSeverities.join(', ')}`
        });
        return;
      }
    }

    console.log("[createTrailCondition] 6. Validation passed");
    console.log("[createTrailCondition] 7. About to execute INSERT...");

    const result = await pool.query(
      `INSERT INTO trail_conditions (trail_id, user_id, condition_type, severity, description, reported_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING id, trail_id, user_id, condition_type, severity, description, reported_at, is_resolved, resolved_at, created_at`,
      [trailId, auth.sub, condition_type, severity || null, description || null]
    );

    console.log("[createTrailCondition] 8. INSERT successful, condition ID:", result.rows[0].id);

    res.status(201).json({ data: result.rows[0] });
  } catch (error) {
    console.error("[createTrailCondition] ❌ ERROR CAUGHT:");
    console.error("[createTrailCondition] Error object:", error);
    console.error("[createTrailCondition] Error message:", error instanceof Error ? error.message : String(error));
    console.error("[createTrailCondition] Error stack:", error instanceof Error ? error.stack : "No stack");

    res.status(500).json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : String(error)
    });
  }
}

export async function updateTrail(req: Request, res: Response): Promise<void> {
  console.log("[updateTrail] ========== START ==========");
  console.log("[updateTrail] Trail ID:", req.params.id);
  console.log("[updateTrail] Update data:", JSON.stringify(req.body, null, 2));

  try {
    const auth = requireAuth(req);
    const trailId = req.params.id;
    const updates = req.body;

    console.log("[updateTrail] 1. Auth passed, userId:", auth.sub);

    // Check if trail exists and is not deleted
    console.log("[updateTrail] 2. Checking trail ownership and status...");
    const trailCheck = await pool.query(
      "SELECT user_id, status FROM trails WHERE id = $1 AND deleted_at IS NULL",
      [trailId]
    );

    if (trailCheck.rows.length === 0) {
      console.log("[updateTrail] Trail not found or deleted:", trailId);
      res.status(404).json({ error: "Trail not found" });
      return;
    }

    // Check ownership
    if (trailCheck.rows[0].user_id !== auth.sub) {
      console.warn("[updateTrail] Unauthorized: user", auth.sub, "tried to update trail of user", trailCheck.rows[0].user_id);
      res.status(403).json({ error: "Not authorized to update this trail" });
      return;
    }

    // Don't allow editing published trails
    if (trailCheck.rows[0].status === 'published') {
      console.warn("[updateTrail] Cannot edit published trail:", trailId);
      res.status(400).json({ error: "Cannot edit published trail. Unpublish first." });
      return;
    }

    const allowedFields = ["name", "description", "region", "difficulty", "features", "tags"];
    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    console.log("[updateTrail] 3. Building update clauses for fields:", Object.keys(updates));

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        setClauses.push(`${field} = $${paramIndex}`);
        values.push(updates[field]);
        paramIndex++;
      }
    }

    if (setClauses.length === 0) {
      console.warn("[updateTrail] No valid fields to update");
      res.status(400).json({ error: "No valid fields to update" });
      return;
    }

    values.push(trailId);
    const query = `
      UPDATE trails 
      SET ${setClauses.join(", ")}, updated_at = NOW()
      WHERE id = $${paramIndex}
      RETURNING id, name, description, region, difficulty, status, updated_at
    `;

    console.log("[updateTrail] 4. Executing update query...");
    const result = await pool.query(query, values);

    console.log("[updateTrail] 5. Update successful");
    res.json({ data: result.rows[0] });
  } catch (error) {
    console.error("[updateTrail] ❌ ERROR CAUGHT:");
    console.error("[updateTrail] Error message:", error instanceof Error ? error.message : String(error));
    console.error("[updateTrail] Error stack:", error instanceof Error ? error.stack : "No stack");
    res.status(500).json({ error: "Internal server error", details: error instanceof Error ? error.message : String(error) });
  }
}

export async function deleteTrail(req: Request, res: Response): Promise<void> {
  console.log("[deleteTrail] ========== START ==========");
  console.log("[deleteTrail] Trail ID:", req.params.id);

  try {
    const auth = requireAuth(req);
    const trailId = req.params.id;

    console.log("[deleteTrail] 1. Auth passed, userId:", auth.sub);
    console.log("[deleteTrail] 2. Checking trail ownership...");

    const trailCheck = await pool.query(
      "SELECT user_id FROM trails WHERE id = $1 AND deleted_at IS NULL",
      [trailId]
    );

    if (trailCheck.rows.length === 0) {
      console.log("[deleteTrail] Trail not found or already deleted:", trailId);
      res.status(404).json({ error: "Trail not found" });
      return;
    }

    if (trailCheck.rows[0].user_id !== auth.sub) {
      console.warn("[deleteTrail] Unauthorized: user", auth.sub, "tried to delete trail of user", trailCheck.rows[0].user_id);
      res.status(403).json({ error: "Not authorized to delete this trail" });
      return;
    }

    console.log("[deleteTrail] 3. Ownership verified. Performing soft delete...");
    await pool.query(
      "UPDATE trails SET deleted_at = NOW(), is_active = false WHERE id = $1",
      [trailId]
    );

    console.log("[deleteTrail] 4. Soft delete successful");
    res.json({ message: "Trail deleted successfully" });
  } catch (error) {
    console.error("[deleteTrail] ❌ ERROR CAUGHT:");
    console.error("[deleteTrail] Error message:", error instanceof Error ? error.message : String(error));
    console.error("[deleteTrail] Error stack:", error instanceof Error ? error.stack : "No stack");
    res.status(500).json({ error: "Internal server error", details: error instanceof Error ? error.message : String(error) });
  }
}

export async function publishTrail(req: Request, res: Response): Promise<void> {
  console.log("[publishTrail] ========== START ==========");
  console.log("[publishTrail] Trail ID:", req.params.id);

  try {
    const auth = requireAuth(req);
    const trailId = req.params.id;

    console.log("[publishTrail] 1. Auth passed, userId:", auth.sub);
    console.log("[publishTrail] 2. Checking trail ownership and status...");

    const trailCheck = await pool.query(
      "SELECT user_id, status, name, description FROM trails WHERE id = $1 AND deleted_at IS NULL",
      [trailId]
    );

    if (trailCheck.rows.length === 0) {
      console.log("[publishTrail] Trail not found or deleted:", trailId);
      res.status(404).json({ error: "Trail not found" });
      return;
    }

    if (trailCheck.rows[0].user_id !== auth.sub) {
      console.warn("[publishTrail] Unauthorized: user", auth.sub, "tried to publish trail of user", trailCheck.rows[0].user_id);
      res.status(403).json({ error: "Only the trail owner can publish" });
      return;
    }

    if (trailCheck.rows[0].status === 'published') {
      console.warn("[publishTrail] Trail already published:", trailId);
      res.status(400).json({ error: "Trail is already published" });
      return;
    }

    const trail = trailCheck.rows[0];
    const missingFields: string[] = [];

    console.log("[publishTrail] 3. Validating required fields...");
    if (!trail.name) missingFields.push("name");
    if (!trail.description) missingFields.push("description");

    if (missingFields.length > 0) {
      console.warn("[publishTrail] Missing required fields:", missingFields);
      res.status(400).json({
        error: "Cannot publish trail. Missing required fields",
        missing: missingFields
      });
      return;
    }

    console.log("[publishTrail] 4. All validations passed. Publishing trail...");
    const result = await pool.query(
      "UPDATE trails SET status = 'published', published_at = NOW() WHERE id = $1 RETURNING id, status, published_at",
      [trailId]
    );

    console.log("[publishTrail] 5. Publish successful");
    res.json({ data: result.rows[0], message: "Trail published successfully" });
  } catch (error) {
    console.error("[publishTrail] ❌ ERROR CAUGHT:");
    console.error("[publishTrail] Error message:", error instanceof Error ? error.message : String(error));
    console.error("[publishTrail] Error stack:", error instanceof Error ? error.stack : "No stack");
    res.status(500).json({ error: "Internal server error", details: error instanceof Error ? error.message : String(error) });
  }
}

export async function saveTrail(req: Request, res: Response): Promise<void> {
  console.log("[saveTrail] ========== START ==========");
  console.log("[saveTrail] Trail ID:", req.params.id);
  console.log("[saveTrail] Request body:", JSON.stringify(req.body, null, 2));

  try {
    const auth = requireAuth(req);
    const trailId = req.params.id;
    const { list_type = "favorites", notes } = req.body;

    console.log("[saveTrail] 1. Auth passed, userId:", auth.sub);
    console.log("[saveTrail] 2. List type:", list_type);

    // Validate list_type
    const validListTypes = ["favorites", "want_to_do", "completed"];
    if (!validListTypes.includes(list_type)) {
      console.warn("[saveTrail] Invalid list_type:", list_type);
      res.status(400).json({
        error: "Invalid list_type",
        details: `list_type must be one of: ${validListTypes.join(", ")}`
      });
      return;
    }

    // Check trail exists and is not soft-deleted
    console.log("[saveTrail] 3. Checking trail exists...");
    const trailCheck = await pool.query(
      "SELECT id FROM trails WHERE id = $1 AND deleted_at IS NULL",
      [trailId]
    );

    if (trailCheck.rows.length === 0) {
      console.warn("[saveTrail] Trail not found or deleted:", trailId);
      res.status(404).json({ error: "Trail not found" });
      return;
    }

    // Upsert into saved_trails
    console.log("[saveTrail] 4. Upserting saved trail...");
    const result = await pool.query(
      `INSERT INTO saved_trails (user_id, trail_id, list_type, notes)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, trail_id, list_type) DO UPDATE
       SET notes = EXCLUDED.notes, created_at = NOW()
       RETURNING id`,
      [auth.sub, trailId, list_type, notes || null]
    );

    console.log("[saveTrail] 5. Upsert successful, saved_trail ID:", result.rows[0].id);
    res.status(201).json({ data: { id: result.rows[0].id }, message: "Trail saved successfully" });
  } catch (error) {
    console.error("[saveTrail] ❌ ERROR CAUGHT:");
    console.error("[saveTrail] Error message:", error instanceof Error ? error.message : String(error));
    console.error("[saveTrail] Error stack:", error instanceof Error ? error.stack : "No stack");
    res.status(500).json({ error: "Internal server error", details: error instanceof Error ? error.message : String(error) });
  }
}

export async function unsaveTrail(req: Request, res: Response): Promise<void> {
  console.log("[unsaveTrail] ========== START ==========");
  console.log("[unsaveTrail] Trail ID:", req.params.id);
  console.log("[unsaveTrail] Query params:", JSON.stringify(req.query, null, 2));
  console.log("[unsaveTrail] Body:", JSON.stringify(req.body, null, 2));

  try {
    const auth = requireAuth(req);
    const trailId = req.params.id;
    // Accept list_type from body or query
    const list_type = req.body?.list_type || req.query?.list_type || "favorites";

    console.log("[unsaveTrail] 1. Auth passed, userId:", auth.sub);
    console.log("[unsaveTrail] 2. List type:", list_type);

    // Validate list_type
    const validListTypes = ["favorites", "want_to_do", "completed"];
    if (!validListTypes.includes(list_type as string)) {
      console.warn("[unsaveTrail] Invalid list_type:", list_type);
      res.status(400).json({
        error: "Invalid list_type",
        details: `list_type must be one of: ${validListTypes.join(", ")}`
      });
      return;
    }

    // Check if saved record exists
    console.log("[unsaveTrail] 3. Checking saved record exists...");
    const checkResult = await pool.query(
      "SELECT id FROM saved_trails WHERE user_id = $1 AND trail_id = $2 AND list_type = $3",
      [auth.sub, trailId, list_type]
    );

    if (checkResult.rows.length === 0) {
      console.log("[unsaveTrail] Saved record not found");
      res.status(404).json({ error: "Trail is not in this list" });
      return;
    }

    // Delete the saved record
    console.log("[unsaveTrail] 4. Deleting saved record...");
    await pool.query(
      "DELETE FROM saved_trails WHERE user_id = $1 AND trail_id = $2 AND list_type = $3",
      [auth.sub, trailId, list_type]
    );

    console.log("[unsaveTrail] 5. Delete successful");
    res.json({ message: "Trail removed from list successfully" });
  } catch (error) {
    console.error("[unsaveTrail] ❌ ERROR CAUGHT:");
    console.error("[unsaveTrail] Error message:", error instanceof Error ? error.message : String(error));
    console.error("[unsaveTrail] Error stack:", error instanceof Error ? error.stack : "No stack");
    res.status(500).json({ error: "Internal server error", details: error instanceof Error ? error.message : String(error) });
  }
}

export async function getSavedTrails(req: Request, res: Response): Promise<void> {
  console.log("[getSavedTrails] ========== START ==========");
  console.log("[getSavedTrails] Query params:", JSON.stringify(req.query, null, 2));

  try {
    const auth = requireAuth(req);
    const list_type = (req.query.list_type as string) || "favorites";
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    console.log("[getSavedTrails] 1. Auth passed, userId:", auth.sub);
    console.log("[getSavedTrails] 2. Params - list_type:", list_type, "page:", page, "limit:", limit);

    // Validate list_type
    const validListTypes = ["favorites", "want_to_do", "completed"];
    if (!validListTypes.includes(list_type)) {
      console.warn("[getSavedTrails] Invalid list_type:", list_type);
      res.status(400).json({
        error: "Invalid list_type",
        details: `list_type must be one of: ${validListTypes.join(", ")}`
      });
      return;
    }

    // Get total count
    console.log("[getSavedTrails] 3. Querying total count...");
    const countResult = await pool.query(
      "SELECT COUNT(*) as count FROM saved_trails WHERE user_id = $1 AND list_type = $2",
      [auth.sub, list_type]
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Get paginated saved trails with trail details
    console.log("[getSavedTrails] 4. Querying saved trails with pagination...");
    const result = await pool.query(
      `SELECT 
        st.id as saved_id,
        st.notes,
        st.created_at as saved_at,
        ${getTrailSelectFields("t")}
       FROM saved_trails st
       JOIN trails t ON st.trail_id = t.id
       WHERE st.user_id = $1
         AND st.list_type = $2
         AND t.deleted_at IS NULL
       ORDER BY st.created_at DESC
       LIMIT $3 OFFSET $4`,
      [auth.sub, list_type, limit, offset]
    );

    const pages = total === 0 ? 0 : Math.ceil(total / limit);
    console.log("[getSavedTrails] 5. Query successful, returned", result.rows.length, "trails");
    const formattedResults = result.rows.map((row) => ({
      ...formatTrailForApp(row),
      saved_id: row.saved_id,
      notes: row.notes,
      saved_at: row.saved_at,
    }));

    res.json({
      data: formattedResults,
      pagination: {
        page,
        limit,
        total,
        pages
      }
    });
  } catch (error) {
    console.error("[getSavedTrails] ❌ ERROR CAUGHT:");
    console.error("[getSavedTrails] Error message:", error instanceof Error ? error.message : String(error));
    console.error("[getSavedTrails] Error stack:", error instanceof Error ? error.stack : "No stack");
    res.status(500).json({ error: "Internal server error", details: error instanceof Error ? error.message : String(error) });
  }
}

export async function checkSavedStatus(req: Request, res: Response): Promise<void> {
  console.log("[checkSavedStatus] ========== START ==========");
  console.log("[checkSavedStatus] Trail ID:", req.params.id);
  console.log("[checkSavedStatus] Query params:", JSON.stringify(req.query, null, 2));

  try {
    const auth = requireAuth(req);
    const trailId = req.params.id;
    const list_type = (req.query.list_type as string) || "favorites";

    console.log("[checkSavedStatus] 1. Auth passed, userId:", auth.sub);
    console.log("[checkSavedStatus] 2. List type:", list_type);

    // Validate list_type
    const validListTypes = ["favorites", "want_to_do", "completed"];
    if (!validListTypes.includes(list_type)) {
      console.warn("[checkSavedStatus] Invalid list_type:", list_type);
      res.status(400).json({
        error: "Invalid list_type",
        details: `list_type must be one of: ${validListTypes.join(", ")}`
      });
      return;
    }

    // Query for saved status
    console.log("[checkSavedStatus] 3. Querying saved status...");
    const result = await pool.query(
      "SELECT id, notes FROM saved_trails WHERE user_id = $1 AND trail_id = $2 AND list_type = $3",
      [auth.sub, trailId, list_type]
    );

    const is_saved = result.rows.length > 0;
    console.log("[checkSavedStatus] 4. Query successful, is_saved:", is_saved);

    res.json({
      is_saved,
      saved_id: is_saved ? result.rows[0].id : null,
      list_type,
      notes: is_saved ? result.rows[0].notes : null
    });
  } catch (error) {
    console.error("[checkSavedStatus] ❌ ERROR CAUGHT:");
    console.error("[checkSavedStatus] Error message:", error instanceof Error ? error.message : String(error));
    console.error("[checkSavedStatus] Error stack:", error instanceof Error ? error.stack : "No stack");
    res.status(500).json({ error: "Internal server error", details: error instanceof Error ? error.message : String(error) });
  }
}

export async function uploadTrailPhoto(req: Request & { file?: Express.Multer.File }, res: Response): Promise<void> {
  console.log("[uploadTrailPhoto] ========== START ==========");
  console.log("[uploadTrailPhoto] Trail ID:", req.params.id);
  console.log("[uploadTrailPhoto] File:", req.file?.originalname, "Size:", req.file?.size);

  try {
    const auth = requireAuth(req);
    const trailId = req.params.id;
    const { caption } = req.body;

    console.log("[uploadTrailPhoto] 1. Auth passed, userId:", auth.sub);

    if (!req.file) {
      res.status(400).json({ error: "Photo file is required" });
      return;
    }

    // Validate MIME type
    const validMimeTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!validMimeTypes.includes(req.file.mimetype)) {
      console.warn("[uploadTrailPhoto] Invalid MIME type:", req.file.mimetype);
      res.status(400).json({
        error: "Invalid file type",
        details: `Only JPEG, PNG, GIF, and WebP images are allowed`
      });
      return;
    }

    // Validate file size (5MB max)
    const maxSizeBytes = 5 * 1024 * 1024;
    if (req.file.size > maxSizeBytes) {
      console.warn("[uploadTrailPhoto] File too large:", req.file.size);
      res.status(400).json({
        error: "File too large",
        details: `Maximum file size is 5MB, got ${(req.file.size / 1024 / 1024).toFixed(2)}MB`
      });
      return;
    }

    // Check trail exists and is not soft-deleted
    console.log("[uploadTrailPhoto] 2. Checking trail exists...");
    const trailCheck = await pool.query(
      "SELECT id FROM trails WHERE id = $1 AND deleted_at IS NULL",
      [trailId]
    );

    if (trailCheck.rows.length === 0) {
      console.warn("[uploadTrailPhoto] Trail not found or deleted:", trailId);
      res.status(404).json({ error: "Trail not found" });
      return;
    }

    // Get file extension
    const ext = req.file.originalname.split(".").pop()?.toLowerCase() || "jpg";
    const timestamp = Date.now();
    const storagePath = `${trailId}/${timestamp}.${ext}`;

    // Upload to Supabase Storage
    console.log("[uploadTrailPhoto] 3. Uploading to Supabase Storage at:", storagePath);
    const supabase = getSupabaseStorageClient();
    const { error: uploadError } = await supabase.storage
      .from("trail-photos")
      .upload(storagePath, req.file.buffer, { contentType: req.file.mimetype });

    if (uploadError) {
      console.error("[uploadTrailPhoto] Storage upload failed:", uploadError);
      res.status(500).json({ error: "Failed to upload photo", details: uploadError.message });
      return;
    }

    // Get public URL
    const { data: urlData } = supabase.storage.from("trail-photos").getPublicUrl(storagePath);
    const publicUrl = urlData?.publicUrl || "";

    console.log("[uploadTrailPhoto] 4. Upload successful, public URL:", publicUrl);

    // Check if this is the first photo
    console.log("[uploadTrailPhoto] 5. Checking if first photo...");
    const photosCountResult = await pool.query(
      "SELECT COUNT(*) as count FROM trail_photos WHERE trail_id = $1",
      [trailId]
    );
    const isFirstPhoto = parseInt(photosCountResult.rows[0].count, 10) === 0;

    // Insert into trail_photos
    console.log("[uploadTrailPhoto] 6. Inserting photo record into DB...");
    const insertResult = await pool.query(
      `INSERT INTO trail_photos (trail_id, user_id, storage_path, caption, is_primary)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [trailId, auth.sub, storagePath, caption || null, isFirstPhoto]
    );

    const photoId = insertResult.rows[0].id;
    console.log("[uploadTrailPhoto] 7. Photo record created, ID:", photoId);

    // If first photo, update trails.image
    if (isFirstPhoto) {
      console.log("[uploadTrailPhoto] 8. Setting as primary, updating trails.image...");
      await pool.query(
        "UPDATE trails SET image = $1 WHERE id = $2",
        [publicUrl, trailId]
      );
    }

    console.log("[uploadTrailPhoto] 9. Upload complete");
    res.status(201).json({ data: { id: photoId, url: publicUrl }, message: "Photo uploaded successfully" });
  } catch (error) {
    console.error("[uploadTrailPhoto] ❌ ERROR CAUGHT:");
    console.error("[uploadTrailPhoto] Error message:", error instanceof Error ? error.message : String(error));
    console.error("[uploadTrailPhoto] Error stack:", error instanceof Error ? error.stack : "No stack");
    res.status(500).json({ error: "Internal server error", details: error instanceof Error ? error.message : String(error) });
  }
}

export async function getTrailPhotos(req: Request, res: Response): Promise<void> {
  console.log("[getTrailPhotos] ========== START ==========");
  console.log("[getTrailPhotos] Trail ID:", req.params.id);

  try {
    const trailId = req.params.id;

    console.log("[getTrailPhotos] 1. Querying direct and review photos for trail...");
    const result = await pool.query(
      `SELECT 
         rp.id,
         rp.photo_storage_path AS storage_path,
         tr.title AS caption,
         false AS is_primary,
         rp.created_at,
         p.full_name AS uploaded_by,
         'review' AS source
       FROM review_photos rp
       JOIN trail_reviews tr ON tr.id = rp.review_id
       LEFT JOIN profiles p ON rp.user_id = p.id
       WHERE tr.trail_id = $1

       UNION ALL

       SELECT 
         tp.id,
         tp.storage_path,
         tp.caption,
         tp.is_primary,
         tp.created_at,
         p.full_name AS uploaded_by,
         'direct' AS source
       FROM trail_photos tp
       LEFT JOIN profiles p ON tp.user_id = p.id
       WHERE tp.trail_id = $1

       ORDER BY is_primary DESC, created_at DESC`,
      [trailId]
    );

    console.log("[getTrailPhotos] 2. Query successful, found", result.rows.length, "photos");

    // Generate public URLs for each photo
    const supabase = getSupabaseStorageClient();
    const photosWithUrls = result.rows.map((photo) => {
      const bucket = photo.source === "review" ? "review-photos" : "trail-photos";
      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(photo.storage_path);
      return {
        id: photo.id,
        url: urlData?.publicUrl || "",
        caption: photo.caption,
        is_primary: photo.is_primary,
        created_at: photo.created_at,
        uploaded_by: photo.uploaded_by,
        source: photo.source
      };
    });

    console.log("[getTrailPhotos] 3. Generated public URLs");
    res.json({ data: photosWithUrls });
  } catch (error) {
    console.error("[getTrailPhotos] ❌ ERROR CAUGHT:");
    console.error("[getTrailPhotos] Error message:", error instanceof Error ? error.message : String(error));
    console.error("[getTrailPhotos] Error stack:", error instanceof Error ? error.stack : "No stack");
    res.status(500).json({ error: "Internal server error", details: error instanceof Error ? error.message : String(error) });
  }
}

export async function deleteTrailPhoto(req: Request, res: Response): Promise<void> {
  console.log("[deleteTrailPhoto] ========== START ==========");
  console.log("[deleteTrailPhoto] Photo ID:", req.params.id);

  try {
    const auth = requireAuth(req);
    const photoId = req.params.id;

    console.log("[deleteTrailPhoto] 1. Auth passed, userId:", auth.sub);

    // Get photo details
    console.log("[deleteTrailPhoto] 2. Fetching photo details...");
    const photoResult = await pool.query(
      "SELECT id, trail_id, user_id, storage_path, is_primary FROM trail_photos WHERE id = $1",
      [photoId]
    );

    if (photoResult.rows.length === 0) {
      console.warn("[deleteTrailPhoto] Photo not found:", photoId);
      res.status(404).json({ error: "Photo not found" });
      return;
    }

    const photo = photoResult.rows[0];

    // Check authorization (uploader or trail owner)
    console.log("[deleteTrailPhoto] 3. Checking authorization...");
    if (photo.user_id !== auth.sub) {
      // Check if user is trail owner
      const trailOwnerResult = await pool.query(
        "SELECT user_id FROM trails WHERE id = $1",
        [photo.trail_id]
      );
      if (trailOwnerResult.rows.length === 0 || trailOwnerResult.rows[0].user_id !== auth.sub) {
        console.warn("[deleteTrailPhoto] Unauthorized delete attempt by user:", auth.sub);
        res.status(403).json({ error: "Not authorized to delete this photo" });
        return;
      }
    }

    // Delete from Supabase Storage
    console.log("[deleteTrailPhoto] 4. Deleting from Supabase Storage...");
    const supabase = getSupabaseStorageClient();
    const { error: deleteError } = await supabase.storage
      .from("trail-photos")
      .remove([photo.storage_path]);

    if (deleteError) {
      console.error("[deleteTrailPhoto] Storage deletion failed:", deleteError);
      res.status(500).json({ error: "Failed to delete photo from storage", details: deleteError.message });
      return;
    }

    // Delete from database
    console.log("[deleteTrailPhoto] 5. Deleting from database...");
    await pool.query("DELETE FROM trail_photos WHERE id = $1", [photoId]);

    // If was primary, promote next photo or clear trails.image
    if (photo.is_primary) {
      console.log("[deleteTrailPhoto] 6. Photo was primary, finding next photo...");
      const nextPhotoResult = await pool.query(
        "SELECT id, storage_path FROM trail_photos WHERE trail_id = $1 ORDER BY created_at ASC LIMIT 1",
        [photo.trail_id]
      );

      if (nextPhotoResult.rows.length > 0) {
        const nextPhoto = nextPhotoResult.rows[0];
        console.log("[deleteTrailPhoto] 7a. Setting new primary photo:", nextPhoto.id);
        const { data: urlData } = supabase.storage.from("trail-photos").getPublicUrl(nextPhoto.storage_path);
        await pool.query(
          "UPDATE trail_photos SET is_primary = true WHERE id = $1",
          [nextPhoto.id]
        );
        await pool.query(
          "UPDATE trails SET image = $1 WHERE id = $2",
          [urlData?.publicUrl || "", photo.trail_id]
        );
      } else {
        console.log("[deleteTrailPhoto] 7b. No more photos, clearing trails.image");
        await pool.query("UPDATE trails SET image = NULL WHERE id = $1", [photo.trail_id]);
      }
    }

    console.log("[deleteTrailPhoto] 8. Delete complete");
    res.json({ message: "Photo deleted successfully" });
  } catch (error) {
    console.error("[deleteTrailPhoto] ❌ ERROR CAUGHT:");
    console.error("[deleteTrailPhoto] Error message:", error instanceof Error ? error.message : String(error));
    console.error("[deleteTrailPhoto] Error stack:", error instanceof Error ? error.stack : "No stack");
    res.status(500).json({ error: "Internal server error", details: error instanceof Error ? error.message : String(error) });
  }
}

export async function setPrimaryPhoto(req: Request, res: Response): Promise<void> {
  console.log("[setPrimaryPhoto] ========== START ==========");
  console.log("[setPrimaryPhoto] Photo ID:", req.params.id);

  try {
    const auth = requireAuth(req);
    const photoId = req.params.id;

    console.log("[setPrimaryPhoto] 1. Auth passed, userId:", auth.sub);

    // Get photo details
    console.log("[setPrimaryPhoto] 2. Fetching photo details...");
    const photoResult = await pool.query(
      "SELECT id, trail_id, user_id, storage_path FROM trail_photos WHERE id = $1",
      [photoId]
    );

    if (photoResult.rows.length === 0) {
      console.warn("[setPrimaryPhoto] Photo not found:", photoId);
      res.status(404).json({ error: "Photo not found" });
      return;
    }

    const photo = photoResult.rows[0];

    // Check authorization (uploader or trail owner)
    console.log("[setPrimaryPhoto] 3. Checking authorization...");
    if (photo.user_id !== auth.sub) {
      const trailOwnerResult = await pool.query(
        "SELECT user_id FROM trails WHERE id = $1",
        [photo.trail_id]
      );
      if (trailOwnerResult.rows.length === 0 || trailOwnerResult.rows[0].user_id !== auth.sub) {
        console.warn("[setPrimaryPhoto] Unauthorized update attempt by user:", auth.sub);
        res.status(403).json({ error: "Not authorized to update this photo" });
        return;
      }
    }

    // Get public URL for the photo
    const supabase = getSupabaseStorageClient();
    const { data: urlData } = supabase.storage.from("trail-photos").getPublicUrl(photo.storage_path);
    const publicUrl = urlData?.publicUrl || "";

    // Begin transaction
    console.log("[setPrimaryPhoto] 4. Starting transaction...");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Set all photos to is_primary = false
      console.log("[setPrimaryPhoto] 5. Setting all photos to is_primary = false...");
      await client.query(
        "UPDATE trail_photos SET is_primary = false WHERE trail_id = $1",
        [photo.trail_id]
      );

      // Set this photo to is_primary = true
      console.log("[setPrimaryPhoto] 6. Setting this photo to is_primary = true...");
      await client.query(
        "UPDATE trail_photos SET is_primary = true WHERE id = $1",
        [photoId]
      );

      // Update trails.image
      console.log("[setPrimaryPhoto] 7. Updating trails.image...");
      await client.query(
        "UPDATE trails SET image = $1 WHERE id = $2",
        [publicUrl, photo.trail_id]
      );

      await client.query("COMMIT");
      console.log("[setPrimaryPhoto] 8. Transaction committed successfully");
    } catch (transactionError) {
      await client.query("ROLLBACK");
      throw transactionError;
    } finally {
      client.release();
    }

    console.log("[setPrimaryPhoto] 9. Update complete");
    res.json({ message: "Primary photo updated successfully" });
  } catch (error) {
    console.error("[setPrimaryPhoto] ❌ ERROR CAUGHT:");
    console.error("[setPrimaryPhoto] Error message:", error instanceof Error ? error.message : String(error));
    console.error("[setPrimaryPhoto] Error stack:", error instanceof Error ? error.stack : "No stack");
    res.status(500).json({ error: "Internal server error", details: error instanceof Error ? error.message : String(error) });
  }
}
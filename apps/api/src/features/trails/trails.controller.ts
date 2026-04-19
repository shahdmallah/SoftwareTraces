import type { Request, Response } from "express";
import { ZodError, z } from "zod";
import multer from "multer";
import { createClient } from "@supabase/supabase-js";
import { pool } from "../../db/pool";
import { env } from "../../config/env";
import * as trailStatsService from "./trails.service";
import { requireAuth } from "../../middleware/auth";
import { HttpError } from "../../lib/httpError";
import { formatTrailForApp } from "../../utils/formatTrail";

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

// Helper: Get Supabase storage client
function getSupabaseStorageClient() {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase configuration missing");
  }
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

export async function getNearbyTrails(req: Request, res: Response): Promise<void> {
  console.log("[getNearbyTrails] ========== FUNCTION STARTED ==========");

  try {
    console.log("[getNearbyTrails] Step 1: Building query...");
    const { lat, lng, radius = 10000 } = req.query;
    const query = `
      SELECT
        id,
        name,
        name_ar,
        description,
        description_ar,
        region,
        region_ar,
        ST_Length(geometry) AS length_meters,
        elevation_gain_meters,
        elevation_min,
        elevation_max,
        estimated_duration_minutes,
        difficulty,
        rating,
        reviews,
        image,
        images,
        features,
        features_ar,
        has_checkpoint,
        checkpoint_note,
        tags,
        user_id,
        is_active,
        created_at,
        updated_at,
        ST_X(ST_StartPoint(CAST(geometry AS geometry))) AS start_lng,
        ST_Y(ST_StartPoint(CAST(geometry AS geometry))) AS start_lat,
        ST_AsText(geometry) AS geometry_text,
        ST_Distance(
          geometry,
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
        ) AS distance_meters
      FROM trails
      WHERE is_active = true
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
    const { q = "", difficulty, minLength = 0, maxLength = 1000 } = req.query;
    const query = `
      SELECT
        id,
        name,
        name_ar,
        description,
        description_ar,
        region,
        region_ar,
        ST_Length(geometry) AS length_meters,
        elevation_gain_meters,
        elevation_min,
        elevation_max,
        estimated_duration_minutes,
        difficulty,
        rating,
        reviews,
        image,
        images,
        features,
        features_ar,
        has_checkpoint,
        checkpoint_note,
        tags,
        user_id,
        is_active,
        created_at,
        updated_at,
        ST_X(ST_StartPoint(CAST(geometry AS geometry))) AS start_lng,
        ST_Y(ST_StartPoint(CAST(geometry AS geometry))) AS start_lat,
        ST_AsText(geometry) AS geometry_text
      FROM trails
      WHERE is_active = true
        AND (name ILIKE $1 OR description ILIKE $1 OR region ILIKE $1)
        AND ($2::TEXT IS NULL OR difficulty = $2)
        AND ST_Length(geometry) / 1000 BETWEEN $3 AND $4
      ORDER BY created_at DESC
    `;

    console.log("[searchTrails] Step 2: Executing query...");
    const result = await pool.query(query, [`%${String(q)}%`, difficulty ?? null, Number(minLength), Number(maxLength)]);
    console.log("[searchTrails] Step 3: Query succeeded, rows:", result.rows.length);

    console.log("[searchTrails] Step 4: Formatting results...");
    const formattedTrails = result.rows.map(formatTrailForApp);

    console.log("[searchTrails] Step 5: Sending response...");
    res.json({ data: formattedTrails });
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
        id, name, name_ar, description, description_ar,
        region, region_ar,
        ST_Length(geometry) as length_meters,
        elevation_gain_meters, elevation_min, elevation_max,
        estimated_duration_minutes, difficulty,
        rating, reviews, image, images,
        features, features_ar,
        has_checkpoint, checkpoint_note, tags,
        user_id, is_active, created_at, updated_at,
        ST_X(ST_StartPoint(CAST(geometry AS geometry))) as start_lng,
        ST_Y(ST_StartPoint(CAST(geometry AS geometry))) as start_lat
      FROM trails
      WHERE is_active = true
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
        id,
        name,
        name_ar,
        description,
        description_ar,
        region,
        region_ar,
        ST_Length(geometry) AS length_meters,
        elevation_gain_meters,
        elevation_min,
        elevation_max,
        estimated_duration_minutes,
        difficulty,
        rating,
        reviews,
        image,
        images,
        features,
        features_ar,
        has_checkpoint,
        checkpoint_note,
        tags,
        user_id,
        is_active,
        created_at,
        updated_at,
        ST_X(ST_StartPoint(CAST(geometry AS geometry))) AS start_lng,
        ST_Y(ST_StartPoint(CAST(geometry AS geometry))) AS start_lat,
        ST_AsText(geometry) AS geometry_text
      FROM trails
      WHERE id = $1
    `;

    console.log("[getTrailById] Step 2: Executing query...");
    const trailResult = await pool.query(query, [req.params.id]);
    console.log("[getTrailById] Step 3: Query succeeded, rows:", trailResult.rows.length);

    if (trailResult.rows.length === 0) {
      console.log("[getTrailById] No trail found for id:", req.params.id);
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

    const region = "Unknown";
    const linestring = `LINESTRING(${coordinates.map(([lng, lat]) => `${lng} ${lat}`).join(", ")})`;

    const insertQuery = `INSERT INTO trails (
      name,
      description,
      region,
      difficulty,
      elevation_gain_meters,
      estimated_duration_minutes,
      geometry,
      user_id
    ) VALUES (
      $1, $2, $3, $4, $5, $6, ST_GeogFromText($7), $8
    ) RETURNING id`;

    const queryValues = [
      name,
      description ?? "",
      region,
      stats.difficulty,
      stats.elevation_gain_meters,
      Math.round(stats.estimated_duration_minutes),
      linestring,
      userId,
    ];

    console.error("[createTrail] insert query:", insertQuery);
    console.error("[createTrail] query values:", JSON.stringify(queryValues, null, 2));

    const result = await pool.query(insertQuery, queryValues);

    res.status(201).json({ data: { id: result.rows[0].id } });
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
  const result = await pool.query("SELECT * FROM trail_reviews WHERE trail_id = $1 ORDER BY created_at DESC", [req.params.id]);
  res.json({ data: result.rows });
}

export async function createTrailReview(req: Request, res: Response): Promise<void> {
  console.log("[createTrailReview] ========== START ==========");
  console.log("[createTrailReview] 1. Trail ID:", req.params.id);
  console.log("[createTrailReview] 2. Request body:", JSON.stringify(req.body, null, 2));
  console.log("[createTrailReview] 3. Auth user:", (req as any).auth?.sub);

  try {
    const auth = requireAuth(req);
    console.log("[createTrailReview] 4. Auth passed, userId:", auth.sub);

    const trailId = req.params.id;
    const { rating, title, content } = req.body;
    console.log("[createTrailReview] 5. Destructured values:", { rating, title, content });

    console.log("[createTrailReview] 6. About to execute INSERT...");

    const result = await pool.query(
      `INSERT INTO trail_reviews (trail_id, user_id, rating, title, content, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING id`,
      [trailId, auth.sub, rating, title, content]
    );

    console.log("[createTrailReview] 7. INSERT successful, review ID:", result.rows[0].id);

    res.status(201).json({ data: { id: result.rows[0].id } });
  } catch (error) {
    console.error("[createTrailReview] ❌ ERROR CAUGHT:");
    console.error("[createTrailReview] Error object:", error);
    console.error("[createTrailReview] Error message:", error instanceof Error ? error.message : String(error));
    console.error("[createTrailReview] Error stack:", error instanceof Error ? error.stack : "No stack");

    res.status(500).json({ 
      error: "Internal server error", 
      details: error instanceof Error ? error.message : String(error)
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
        t.id,
        t.name,
        t.description,
        t.region,
        t.difficulty,
        t.elevation_gain_meters,
        t.estimated_duration_minutes,
        t.rating,
        t.reviews,
        t.user_id as creator_id
       FROM saved_trails st
       JOIN trails t ON st.trail_id = t.id
       WHERE st.user_id = $1 AND st.list_type = $2 AND t.deleted_at IS NULL
       ORDER BY st.created_at DESC
       LIMIT $3 OFFSET $4`,
      [auth.sub, list_type, limit, offset]
    );

    const pages = Math.ceil(total / limit);
    console.log("[getSavedTrails] 5. Query successful, returned", result.rows.length, "trails");

    res.json({
      data: result.rows,
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

    console.log("[getTrailPhotos] 1. Querying photos for trail...");
    const result = await pool.query(
      `SELECT 
        tp.id,
        tp.storage_path,
        tp.caption,
        tp.is_primary,
        tp.created_at,
        p.username as uploaded_by
       FROM trail_photos tp
       LEFT JOIN profiles p ON tp.user_id = p.user_id
       WHERE tp.trail_id = $1
       ORDER BY tp.is_primary DESC, tp.created_at DESC`,
      [trailId]
    );

    console.log("[getTrailPhotos] 2. Query successful, found", result.rows.length, "photos");

    // Generate public URLs for each photo
    const supabase = getSupabaseStorageClient();
    const photosWithUrls = result.rows.map((photo) => {
      const { data: urlData } = supabase.storage.from("trail-photos").getPublicUrl(photo.storage_path);
      return {
        id: photo.id,
        url: urlData?.publicUrl || "",
        caption: photo.caption,
        is_primary: photo.is_primary,
        created_at: photo.created_at,
        uploaded_by: photo.uploaded_by
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

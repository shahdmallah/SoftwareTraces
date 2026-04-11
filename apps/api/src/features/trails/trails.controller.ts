import type { Request, Response } from "express";
import { z } from "zod";
import { pool } from "../../db/pool";
import * as trailStatsService from "./trails.service";
import { requireAuth } from "../../middleware/auth";
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

export async function getNearbyTrails(req: Request, res: Response): Promise<void> {
  const { lat, lng, radius = 10000 } = req.query;
  const result = await pool.query(
    `
    SELECT id, slug, name, name_ar, description, region, difficulty, length_km,
      estimated_duration_min, elevation_gain_m, elevation_loss_m, tags,
      hero_image_url, is_featured, created_at, updated_at,
      ST_X(start_point::geometry) AS start_lng,
      ST_Y(start_point::geometry) AS start_lat,
      ST_Distance(
        start_point,
        ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
      ) AS distance_meters
    FROM trails
    WHERE ST_DWithin(
      start_point,
      ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
      $3
    )
    ORDER BY distance_meters ASC
    `,
    [Number(lng), Number(lat), Number(radius)]
  );

  res.json({ data: result.rows.map(formatTrailForApp) });
}

export async function searchTrails(req: Request, res: Response): Promise<void> {
  const { q = "", difficulty, minLength = 0, maxLength = 1000 } = req.query;
  const result = await pool.query(
    `
    SELECT *,
      ST_X(ST_StartPoint(geometry)) AS start_lng,
      ST_Y(ST_StartPoint(geometry)) AS start_lat,
      ST_AsText(geometry) AS geometry_text
    FROM trails
    WHERE (name ILIKE $1 OR description ILIKE $1 OR region ILIKE $1)
      AND ($2::TEXT IS NULL OR difficulty = $2)
      AND length_km BETWEEN $3 AND $4
    ORDER BY is_featured DESC, length_km ASC
    `,
    [`%${String(q)}%`, difficulty ?? null, Number(minLength), Number(maxLength)]
  );

  res.json({ data: result.rows.map(formatTrailForApp) });
}

export async function getAllTrails(req: Request, res: Response): Promise<void> {
  const result = await pool.query(`
    SELECT *,
      ST_X(ST_StartPoint(geometry)) AS start_lng,
      ST_Y(ST_StartPoint(geometry)) AS start_lat,
      ST_AsText(geometry) AS geometry_text
    FROM trails
    ORDER BY created_at DESC
  `);

  res.json({ data: result.rows.map(formatTrailForApp) });
}

export async function getTrailById(req: Request, res: Response): Promise<void> {
  const trailResult = await pool.query(
    `
    SELECT *,
      ST_X(ST_StartPoint(geometry)) AS start_lng,
      ST_Y(ST_StartPoint(geometry)) AS start_lat,
      ST_AsText(geometry) AS geometry_text
    FROM trails
    WHERE id = $1
    `,
    [req.params.id]
  );

  if (trailResult.rows.length === 0) {
    res.status(404).json({ error: "Trail not found" });
    return;
  }

  res.json({ data: formatTrailForApp(trailResult.rows[0]) });
}

export async function calculateTrailStats(req: Request, res: Response): Promise<void> {
  const { coordinates } = calculateTrailStatsBodySchema.parse(req.body);
  const stats = trailStatsService.calculateTrailStats(coordinates);

  res.json({ data: stats });
}

export async function createTrail(req: Request, res: Response): Promise<void> {
  const { name, description, coordinates, stats } = createTrailBodySchema.parse(req.body);
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .replace(/--+/g, "-");
  const region = "Unknown";
  const length_km = Number((stats.length_meters / 1000).toFixed(3));
  const startPoint = coordinates[0];
  const endPoint = coordinates[coordinates.length - 1];
  const linestring = `LINESTRING(${coordinates.map(([lng, lat]) => `${lng} ${lat}`).join(", ")})`;

  const result = await pool.query(
    `INSERT INTO trails (
      slug,
      name,
      description,
      region,
      difficulty,
      length_km,
      estimated_duration_min,
      elevation_gain_m,
      elevation_loss_m,
      tags,
      hero_image_url,
      is_featured,
      start_point,
      end_point,
      geometry
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, 0, ARRAY[]::TEXT[], NULL, FALSE,
      ST_SetSRID(ST_MakePoint($9, $10), 4326)::geography,
      ST_SetSRID(ST_MakePoint($11, $12), 4326)::geography,
      ST_GeogFromText($13)
    ) RETURNING id`,
    [
      slug,
      name,
      description ?? "",
      region,
      stats.difficulty,
      length_km,
      Math.round(stats.estimated_duration_minutes),
      stats.elevation_gain_meters,
      startPoint[0],
      startPoint[1],
      endPoint[0],
      endPoint[1],
      linestring,
    ]
  );

  res.status(201).json({ data: { id: result.rows[0].id } });
}

export async function getTrailReviews(req: Request, res: Response): Promise<void> {
  const result = await pool.query("SELECT * FROM trail_reviews WHERE trail_id = $1 ORDER BY created_at DESC", [req.params.id]);
  res.json({ data: result.rows });
}

export async function createTrailReview(req: Request, res: Response): Promise<void> {
  const auth = requireAuth(req);
  const { rating, comment } = req.body;
  const result = await pool.query(
    "INSERT INTO trail_reviews (trail_id, user_id, rating, comment) VALUES ($1, $2, $3, $4) RETURNING *",
    [req.params.id, auth.sub, rating, comment]
  );
  res.status(201).json({ data: result.rows[0] });
}

export async function getTrailConditions(req: Request, res: Response): Promise<void> {
  const result = await pool.query("SELECT * FROM trail_conditions WHERE trail_id = $1 ORDER BY reported_at DESC LIMIT 20", [req.params.id]);
  res.json({ data: result.rows });
}

export async function createTrailCondition(req: Request, res: Response): Promise<void> {
  const auth = requireAuth(req);
  const { status, note } = req.body;
  const result = await pool.query(
    "INSERT INTO trail_conditions (trail_id, user_id, status, note) VALUES ($1, $2, $3, $4) RETURNING *",
    [req.params.id, auth.sub, status, note]
  );
  res.status(201).json({ data: result.rows[0] });
}

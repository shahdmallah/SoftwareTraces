import type { Request, Response } from "express";
import { pool } from "../../db/pool";
import { getTrailWeather } from "../../services/weatherService";

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

  res.json({ data: result.rows });
}

export async function searchTrails(req: Request, res: Response): Promise<void> {
  const { q = "", difficulty, minLength = 0, maxLength = 1000 } = req.query;
  const result = await pool.query(
    `
    SELECT *
    FROM trails
    WHERE (name ILIKE $1 OR description ILIKE $1 OR region ILIKE $1)
      AND ($2::TEXT IS NULL OR difficulty = $2)
      AND length_km BETWEEN $3 AND $4
    ORDER BY is_featured DESC, length_km ASC
    `,
    [`%${String(q)}%`, difficulty ?? null, Number(minLength), Number(maxLength)]
  );

  res.json({ data: result.rows });
}

export async function getTrailById(req: Request, res: Response): Promise<void> {
  const trailResult = await pool.query("SELECT * FROM trails WHERE id = $1", [req.params.id]);
  const weather = await getTrailWeather(31.77, 35.21);
  res.json({ data: { trail: trailResult.rows[0], weather } });
}

export async function getTrailReviews(req: Request, res: Response): Promise<void> {
  const result = await pool.query("SELECT * FROM trail_reviews WHERE trail_id = $1 ORDER BY created_at DESC", [req.params.id]);
  res.json({ data: result.rows });
}

export async function createTrailReview(req: Request, res: Response): Promise<void> {
  const { rating, comment } = req.body;
  const result = await pool.query(
    "INSERT INTO trail_reviews (trail_id, user_id, rating, comment) VALUES ($1, $2, $3, $4) RETURNING *",
    [req.params.id, req.auth?.sub, rating, comment]
  );
  res.status(201).json({ data: result.rows[0] });
}

export async function getTrailConditions(req: Request, res: Response): Promise<void> {
  const result = await pool.query("SELECT * FROM trail_conditions WHERE trail_id = $1 ORDER BY reported_at DESC LIMIT 20", [req.params.id]);
  res.json({ data: result.rows });
}

export async function createTrailCondition(req: Request, res: Response): Promise<void> {
  const { status, note } = req.body;
  const result = await pool.query(
    "INSERT INTO trail_conditions (trail_id, user_id, status, note) VALUES ($1, $2, $3, $4) RETURNING *",
    [req.params.id, req.auth?.sub, status, note]
  );
  res.status(201).json({ data: result.rows[0] });
}

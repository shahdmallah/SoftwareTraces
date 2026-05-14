import type { Request, Response } from "express";
import { pool } from "../../db/pool";
import { requireAuth } from "../../middleware/auth";
import { formatTrailForApp } from "../../utils/formatTrail";

function getTrailDraftSelectFields(): string {
  return `
    t.id,
    t.slug,
    t.name,
    t.name_ar,
    t.description,
    t.description_ar,
    t.region,
    t.region_ar,
    t.length_meters,
    t.elevation_gain_meters,
    t.elevation_min,
    t.elevation_max,
    t.estimated_duration_minutes,
    t.difficulty,
    t.average_rating,
    t.total_reviews,
    t.rating,
    t.reviews,
    t.image,
    t.images,
    t.features,
    t.features_ar,
    t.has_checkpoint,
    t.checkpoint_note,
    t.tags,
    t.user_id,
    t.is_active,
    t.status,
    t.published_at,
    t.deleted_at,
    t.created_at,
    t.updated_at,
    ST_AsText(t.start_point::geometry) AS start_point_text,
    ST_X(ST_StartPoint(t.geometry::geometry)) AS start_lng,
    ST_Y(ST_StartPoint(t.geometry::geometry)) AS start_lat,
    ST_AsText(t.geometry::geometry) AS geometry_text
  `;
}

export async function getMyTrailDrafts(req: Request, res: Response): Promise<void> {
  try {
    const auth = requireAuth(req);
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const offset = (page - 1) * limit;

    const [countResult, trailsResult] = await Promise.all([
      pool.query<{ count: string }>(
        `SELECT COUNT(*) AS count
           FROM trails t
         WHERE t.user_id = $1::uuid
           AND t.deleted_at IS NULL
           AND t.status = 'draft'`,
        [auth.sub]
      ),
      pool.query(
        `SELECT
           ${getTrailDraftSelectFields()}
         FROM trails t
         WHERE t.user_id = $1::uuid
           AND t.deleted_at IS NULL
           AND t.status = 'draft'
         ORDER BY COALESCE(t.updated_at, t.created_at) DESC
         LIMIT $2 OFFSET $3`,
        [auth.sub, limit, offset]
      ),
    ]);

    const total = Number(countResult.rows[0]?.count ?? 0);

    res.json({
      data: trailsResult.rows.map(formatTrailForApp),
      pagination: {
        page,
        limit,
        total,
        pages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : String(error),
    });
  }
}

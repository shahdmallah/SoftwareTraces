import type { Request, Response } from "express";
import type { OfflineSyncPayload } from "@traces/shared-types";
import { pool } from "../../db/pool";
import { requireAuth } from "../../middleware/auth";

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
  res.json({
    data: {
      trailId: req.params.trailId,
      tileRegion: "palestine-default",
      tileUrlTemplate: "mapbox://styles/mapbox/outdoors-v12"
    }
  });
}

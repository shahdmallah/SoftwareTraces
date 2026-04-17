import type { Request, Response } from "express";
import type { AddActivityPointsRequest, CompleteActivityRequest, StartActivityRequest } from "@traces/shared-types";
import { pool } from "../../db/pool";
import { HttpError } from "../../lib/httpError";
import { requireAuth } from "../../middleware/auth";
import { generateGpx } from "../../services/gpxService";

export async function getUserActivities(req: Request, res: Response): Promise<void> {
  const result = await pool.query("SELECT * FROM activities WHERE user_id = $1 ORDER BY started_at DESC", [req.params.userId]);
  res.json({ data: result.rows });
}

export async function getActivityById(req: Request, res: Response): Promise<void> {
  const result = await pool.query("SELECT * FROM activities WHERE id = $1", [req.params.id]);
  if (!result.rows[0]) {
    throw new HttpError(404, "Activity not found");
  }
  res.json({ data: result.rows[0] });
}

export async function createActivity(req: Request, res: Response): Promise<void> {
  const auth = requireAuth(req);
  const { title, startedAt, trailId } = req.body as StartActivityRequest;
  const result = await pool.query(
    "INSERT INTO activities (user_id, trail_id, title, started_at, status) VALUES ($1, $2, $3, $4, 'recording') RETURNING *",
    [auth.sub, trailId ?? null, title, startedAt]
  );
  res.status(201).json({ data: result.rows[0] });
}

export async function addActivityPoints(req: Request, res: Response): Promise<void> {
  const { points } = req.body as AddActivityPointsRequest;

  for (const point of points) {
    await pool.query(
      `
      INSERT INTO activity_points (activity_id, latitude, longitude, elevation, accuracy, speed_mps, recorded_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [req.params.id, point.lat, point.lng, point.elevation ?? null, point.accuracy ?? null, point.speedMps ?? null, point.recordedAt]
    );
  }

  await pool.query(
    `
    UPDATE activities
    SET route = (
      SELECT ST_MakeLine(geom::geometry ORDER BY recorded_at)::geography
      FROM activity_points
      WHERE activity_id = $1
    )
    WHERE id = $1
    `,
    [req.params.id]
  );

  res.status(204).send();
}

export async function completeActivity(req: Request, res: Response): Promise<void> {
  const { endedAt, distanceKm, elevationGainM, avgSpeedKph, maxSpeedKph } = req.body as CompleteActivityRequest;
  const result = await pool.query(
    `
    UPDATE activities
    SET ended_at = $2,
      duration_sec = EXTRACT(EPOCH FROM ($2::timestamptz - started_at)),
      distance_km = $3,
      elevation_gain_m = $4,
      avg_speed_kph = $5,
      max_speed_kph = $6,
      status = 'completed',
      last_synced_at = NOW()
    WHERE id = $1
    RETURNING *
    `,
    [req.params.id, endedAt, distanceKm, elevationGainM, avgSpeedKph, maxSpeedKph]
  );
  if (!result.rows[0]) {
    throw new HttpError(404, "Activity not found");
  }
  res.json({ data: result.rows[0] });
}

export async function deleteActivity(req: Request, res: Response): Promise<void> {
  const auth = requireAuth(req);
  await pool.query("DELETE FROM activities WHERE id = $1 AND user_id = $2", [req.params.id, auth.sub]);
  res.status(204).send();
}

export async function exportActivityGpx(req: Request, res: Response): Promise<void> {
  const pointsResult = await pool.query(
    "SELECT latitude, longitude, elevation, accuracy, speed_mps, recorded_at FROM activity_points WHERE activity_id = $1 ORDER BY recorded_at ASC",
    [req.params.id]
  );

  const points = pointsResult.rows.map((row) => ({
    lat: Number(row.latitude),
    lng: Number(row.longitude),
    elevation: row.elevation ? Number(row.elevation) : undefined,
    accuracy: row.accuracy ? Number(row.accuracy) : undefined,
    speedMps: row.speed_mps ? Number(row.speed_mps) : undefined,
    recordedAt: row.recorded_at.toISOString()
  }));

  res.setHeader("Content-Type", "application/gpx+xml");
  res.send(generateGpx(points, `activity-${req.params.id}`));
}

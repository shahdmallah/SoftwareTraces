import type { Request, Response } from "express";
import { pool } from "../../db/pool";
import { HttpError } from "../../lib/httpError";
import { requireAuth } from "../../middleware/auth";
import { createNotification } from "../notifications/notifications.service";

const NAVIGATION_ALERT_COOLDOWN_MS = 5 * 60 * 1000;

function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function parseCoordinate(value: unknown, fieldName: string, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new HttpError(400, `${fieldName} must be between ${min} and ${max}`);
  }
  return parsed;
}

function parseOptionalHeading(value: unknown): number | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed >= 360) {
    throw new HttpError(400, "heading must be between 0 and 359");
  }
  return parsed;
}

function bearingBetween(fromLat: number, fromLng: number, toLat: number, toLng: number): number {
  const phi1 = (fromLat * Math.PI) / 180;
  const phi2 = (toLat * Math.PI) / 180;
  const deltaLambda = ((toLng - fromLng) * Math.PI) / 180;
  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function headingDelta(a: number, b: number): number {
  return Math.abs(((a - b + 540) % 360) - 180);
}

function directionLabel(delta: number): string {
  if (delta < 30) {
    return "Continue straight";
  }
  return delta > 180 ? "Turn left" : "Turn right";
}

function sendNavigationError(action: string, res: Response, error: unknown): void {
  console.log(`[navigation.${action}] error`, error);
  if (error instanceof HttpError) {
    res.status(error.statusCode).json({ error: error.message });
    return;
  }
  res.status(500).json({ error: "Internal server error", details: error instanceof Error ? error.message : String(error) });
}

function shouldSendNavigationAlert(lastOffTrailEventAt: string | Date | null): boolean {
  if (!lastOffTrailEventAt) {
    return true;
  }

  const lastEventMs = lastOffTrailEventAt instanceof Date ? lastOffTrailEventAt.getTime() : new Date(lastOffTrailEventAt).getTime();
  return !Number.isFinite(lastEventMs) || Date.now() - lastEventMs >= NAVIGATION_ALERT_COOLDOWN_MS;
}

async function createNavigationAlertBestEffort(input: {
  userId: string;
  trailId: string;
  trailName: string | null;
  sessionId: string;
  latitude: number;
  longitude: number;
  deviationMeters: number;
  progressPercent: number;
  instruction: string;
}): Promise<void> {
  try {
    await createNotification({
      user_id: input.userId,
      type: "danger_alert",
      title: "Navigation alert",
      body: input.instruction || `You are ${input.deviationMeters} meters off trail.`,
      entity_type: "trail",
      entity_id: input.trailId,
      data: {
        notification_kind: "navigation_off_track",
        navigation_session_id: input.sessionId,
        trail_id: input.trailId,
        trail_name: input.trailName,
        latitude: input.latitude,
        longitude: input.longitude,
        deviation_meters: input.deviationMeters,
        progress_percent: input.progressPercent,
        instruction: input.instruction,
      },
    });
  } catch (error) {
    console.error("[navigation.createNavigationAlertBestEffort] Failed to create notification:", error);
  }
}

export async function startNavigation(req: Request, res: Response): Promise<void> {
  try {
    console.log("[navigation.startNavigation] requiring auth");
    const auth = requireAuth(req);
    const trailId = req.body.trail_id;

    if (!isUuid(auth.sub)) {
      throw new HttpError(401, "Authentication required");
    }

    if (!isUuid(trailId)) {
      throw new HttpError(400, "trail_id must be a valid UUID");
    }

    console.log("[navigation.startNavigation] verifying trail", { trailId });
    const trailResult = await pool.query("SELECT id, name FROM trails WHERE id = $1::uuid AND deleted_at IS NULL", [trailId]);
    const trail = trailResult.rows[0];

    if (!trail) {
      throw new HttpError(404, "Trail not found");
    }

    console.log("[navigation.startNavigation] creating session");
    const sessionResult = await pool.query(
      `
      INSERT INTO navigation_sessions (user_id, trail_id, status, started_at)
      VALUES ($1::uuid, $2::uuid, 'active', NOW())
      RETURNING id, trail_id, started_at, status
      `,
      [auth.sub, trailId]
    );

    res.status(201).json({
      data: {
        ...sessionResult.rows[0],
        instruction: `Start ${trail.name}. Follow the trail from the marked start point.`
      }
    });
  } catch (error) {
    sendNavigationError("startNavigation", res, error);
  }
}

export async function checkPosition(req: Request, res: Response): Promise<void> {
  try {
    console.log("[navigation.checkPosition] requiring auth");
    const auth = requireAuth(req);

    if (!isUuid(auth.sub) || !isUuid(req.params.id)) {
      throw new HttpError(400, "Invalid navigation session id");
    }

    const latitude = parseCoordinate(req.body.latitude, "latitude", -90, 90);
    const longitude = parseCoordinate(req.body.longitude, "longitude", -180, 180);
    const heading = parseOptionalHeading(req.body.heading);
    const timestamp = typeof req.body.timestamp === "string" ? req.body.timestamp : new Date().toISOString();

    console.log("[navigation.checkPosition] loading session and trail", { sessionId: req.params.id, latitude, longitude });
    const result = await pool.query(
      `
      WITH session_trail AS (
        SELECT ns.id, ns.user_id, ns.trail_id, ns.status, ns.off_trail_count, t.name AS trail_name, t.geometry
        FROM navigation_sessions ns
        JOIN trails t ON t.id = ns.trail_id
        WHERE ns.id = $1::uuid
      ),
      position AS (
        SELECT ST_SetSRID(ST_MakePoint($3, $2), 4326)::geography AS geog,
               ST_SetSRID(ST_MakePoint($3, $2), 4326)::geometry AS geom
      ),
      projected AS (
        SELECT
          st.*,
          ST_Distance(st.geometry, position.geog) AS deviation_meters,
          ST_LineLocatePoint(st.geometry::geometry, position.geom) AS progress,
          ST_Length(st.geometry) AS trail_length_meters
        FROM session_trail st, position
      )
      SELECT
        id,
        user_id,
        trail_id,
        status,
        trail_name,
        off_trail_count,
        deviation_meters,
        progress,
        trail_length_meters,
        (
          SELECT MAX(ote.created_at)
          FROM off_trail_events ote
          WHERE ote.navigation_session_id = projected.id
        ) AS last_off_trail_event_at,
        ST_Y(ST_LineInterpolatePoint(geometry::geometry, LEAST(progress + 0.02, 1))) AS ahead_latitude,
        ST_X(ST_LineInterpolatePoint(geometry::geometry, LEAST(progress + 0.02, 1))) AS ahead_longitude,
        ST_Y(ST_LineInterpolatePoint(geometry::geometry, progress)) AS trail_latitude,
        ST_X(ST_LineInterpolatePoint(geometry::geometry, progress)) AS trail_longitude
      FROM projected
      `,
      [req.params.id, latitude, longitude]
    );
    const nav = result.rows[0];

    if (!nav) {
      throw new HttpError(404, "Navigation session not found");
    }

    if (nav.user_id !== auth.sub) {
      throw new HttpError(403, "Not authorized");
    }

    if (nav.status !== "active") {
      throw new HttpError(400, "Navigation session is not active");
    }

    const deviationMeters = Math.round(Number(nav.deviation_meters));
    const progress = Number(nav.progress);
    const offTrack = deviationMeters > 50;
    const milestones = [0.25, 0.5, 0.75, 0.9].filter((milestone) => progress >= milestone).map((m) => `${Math.round(m * 100)}%`);

    let instruction = offTrack ? `You are ${deviationMeters} meters off trail. Return to the highlighted route.` : "Continue on trail.";

    if (!offTrack && heading !== null) {
      const trailBearing = bearingBetween(Number(nav.trail_latitude), Number(nav.trail_longitude), Number(nav.ahead_latitude), Number(nav.ahead_longitude));
      const delta = headingDelta(heading, trailBearing);
      if (delta > 30) {
        instruction = `${directionLabel(((trailBearing - heading + 360) % 360))} to stay on the trail.`;
      }
    }

    if (offTrack) {
      console.log("[navigation.checkPosition] recording off-trail event", { deviationMeters });
      const shouldNotify = shouldSendNavigationAlert(nav.last_off_trail_event_at ?? null);
      await pool.query(
        `
        INSERT INTO off_trail_events (navigation_session_id, latitude, longitude, deviation_meters, created_at)
        VALUES ($1::uuid, $2, $3, $4, $5::timestamptz)
        `,
        [req.params.id, latitude, longitude, deviationMeters, timestamp]
      );
      await pool.query("UPDATE navigation_sessions SET off_trail_count = off_trail_count + 1 WHERE id = $1::uuid", [req.params.id]);

      if (shouldNotify) {
        await createNavigationAlertBestEffort({
          userId: auth.sub,
          trailId: nav.trail_id,
          trailName: nav.trail_name ?? null,
          sessionId: req.params.id,
          latitude,
          longitude,
          deviationMeters,
          progressPercent: Math.round(progress * 100),
          instruction,
        });
      }
    }

    res.json({
      data: {
        session_id: req.params.id,
        off_track: offTrack,
        deviation_meters: deviationMeters,
        progress,
        progress_percent: Math.round(progress * 100),
        milestones,
        instruction
      }
    });
  } catch (error) {
    sendNavigationError("checkPosition", res, error);
  }
}

export async function endNavigation(req: Request, res: Response): Promise<void> {
  try {
    console.log("[navigation.endNavigation] requiring auth");
    const auth = requireAuth(req);

    if (!isUuid(auth.sub) || !isUuid(req.params.id)) {
      throw new HttpError(400, "Invalid navigation session id");
    }

    const result = await pool.query(
      `
      UPDATE navigation_sessions
      SET status = 'ended', ended_at = NOW()
      WHERE id = $1::uuid AND user_id = $2::uuid
      RETURNING id, trail_id, started_at, ended_at, status, off_trail_count, total_off_trail_duration_seconds
      `,
      [req.params.id, auth.sub]
    );

    if (!result.rows[0]) {
      throw new HttpError(404, "Navigation session not found");
    }

    res.json({ data: result.rows[0] });
  } catch (error) {
    sendNavigationError("endNavigation", res, error);
  }
}

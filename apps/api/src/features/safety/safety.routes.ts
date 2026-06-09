import { Router } from "express";
import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { env } from "../../config/env";
import { pool } from "../../db/pool";
import { asyncHandler } from "../../lib/asyncHandler";
import { HttpError } from "../../lib/httpError";
import { authenticate } from "../../middleware/auth";
import { updateUserStats } from "../achievements/achievements.service";
import { createNotification } from "../notifications/notifications.service";
import { requireAdmin } from "./admin";
import {
  getCheckpointStatus,
  getSuggestedCheckpointRoutes,
  reportCheckpointWait,
  suggestCheckpointRoute,
} from "../trails/access.controller";
import { fetchOchaIncidents } from "./ocha.fetcher";

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

type RiskLevel = "safe" | "caution" | "dangerous" | "avoid";
type Severity = "critical" | "high" | "medium" | "low";

interface CoordinatePoint {
  latitude: number;
  longitude: number;
}

interface DangerousLocationRow {
  id: string;
  name: string;
  name_ar: string | null;
  location_type: string;
  latitude: string | number;
  longitude: string | number;
  danger_radius_meters: string | number;
  risk_level: Severity;
}

interface SafetyIncidentRow {
  id: string;
  incident_type: string;
  severity: Severity;
  latitude: string | number;
  longitude: string | number;
  description: string | null;
  headline: string | null;
  source: string;
  source_name: string | null;
  source_url: string | null;
  reported_at: string | Date;
  expires_at: string | Date;
}

const router = Router();
const SAFETY_PUSH_WARNING_RADIUS_METERS = 500;

function optionalAuthenticate(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    next();
    return;
  }

  if (!authHeader.startsWith("Bearer ")) {
    next(new HttpError(401, "Missing bearer token"));
    return;
  }

  try {
    const token = authHeader.replace("Bearer ", "");
    const payload = jwt.verify(token, env.JWT_SECRET);
    if (
      typeof payload !== "object" ||
      payload === null ||
      typeof payload.sub !== "string" ||
      typeof payload.email !== "string"
    ) {
      throw new HttpError(401, "Invalid token payload");
    }

    req.auth = {
      sub: payload.sub,
      email: payload.email,
    };
    next();
  } catch {
    next(new HttpError(401, "Invalid token"));
  }
}

router.post("/checkpoints/:checkpointId/report", authenticate, asyncHandler(reportCheckpointWait));
router.get("/checkpoints/:id/status", asyncHandler(getCheckpointStatus));
router.post("/checkpoints/:id/suggest-route", authenticate, asyncHandler(suggestCheckpointRoute));
router.get("/checkpoints/:id/suggested-routes", asyncHandler(getSuggestedCheckpointRoutes));

const reportIncidentSchema = z.object({
  incident_type: z.enum([
    "settler_attack",
    "road_block",
    "military_checkpoint",
    "flying_checkpoint",
    "harassment",
    "land_confiscation",
    "tree_uprooting",
    "settler_presence",
    "military_raid",
    "other",
  ]),
  severity: z.enum(["critical", "high", "medium", "low"]),
  latitude: z.number().min(31.2).max(32.6),
  longitude: z.number().min(34.8).max(35.8),
  location_name: z.string().optional(),
  description: z.string().optional(),
});

const incidentModerationSchema = z.object({
  status: z.enum(["pending", "active", "rejected", "resolved", "expired"]),
  note: z.string().trim().max(1000).optional(),
});

function toNumber(value: string | number | null | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function createSafetyNotificationBestEffort(input: {
  user_id: string;
  title: string;
  body: string;
  entity_id?: string | null;
  data: Record<string, unknown>;
  cooldownMinutes?: number;
}): Promise<void> {
  try {
    const cooldownMinutes = input.cooldownMinutes ?? 60;
    const dangerId = typeof input.data.danger_id === "string" ? input.data.danger_id : null;
    if (dangerId) {
      const duplicateResult = await pool.query<{ id: string }>(
        `SELECT id
         FROM notifications
         WHERE user_id = $1::uuid
           AND type = 'danger_alert'
           AND data->>'danger_id' = $2
           AND created_at > NOW() - ($3::int * INTERVAL '1 minute')
         LIMIT 1`,
        [input.user_id, dangerId, cooldownMinutes]
      );

      if (duplicateResult.rows[0]) {
        console.log("[safety.routes] Skipping duplicate safety notification:", {
          user_id: input.user_id,
          danger_id: dangerId,
          cooldownMinutes,
        });
        return;
      }
    }

    console.log("[safety.routes] Creating safety notification:", {
      user_id: input.user_id,
      title: input.title,
      entity_id: input.entity_id,
    });
    await createNotification({
      user_id: input.user_id,
      type: "danger_alert",
      title: input.title,
      body: input.body,
      entity_type: "trail",
      entity_id: input.entity_id ?? null,
      data: input.data,
    });
  } catch (error) {
    console.error("[safety.routes] Failed to create safety notification:", error);
  }
}

function getRiskPenalty(riskLevel: string): number {
  switch (riskLevel) {
    case "critical":
      return 40;
    case "high":
      return 25;
    case "medium":
      return 15;
    case "low":
      return 10;
    default:
      return 15;
  }
}

function getRiskLevel(score: number): RiskLevel {
  if (score >= 80) return "safe";
  if (score >= 60) return "caution";
  if (score >= 40) return "dangerous";
  return "avoid";
}

function parseLineString(lineString: string | null): CoordinatePoint[] {
  if (!lineString) {
    return [];
  }

  const match = lineString.match(/LINESTRING\s*\(([^)]+)\)/i);
  if (!match?.[1]) {
    return [];
  }

  return match[1]
    .split(",")
    .map((pair) => pair.trim().split(/\s+/).map(Number))
    .filter(([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat))
    .map(([longitude, latitude]) => ({ latitude, longitude }));
}

function sampleRoutePoints(points: CoordinatePoint[], maxSamples = 20): CoordinatePoint[] {
  if (points.length <= maxSamples) {
    return points;
  }

  const samples: CoordinatePoint[] = [];
  const lastIndex = points.length - 1;

  for (let index = 0; index < maxSamples; index += 1) {
    const pointIndex = Math.round((index / (maxSamples - 1)) * lastIndex);
    samples.push(points[pointIndex]);
  }

  return samples;
}

function getMinimumDistanceToRoute(points: CoordinatePoint[], latitude: number, longitude: number): number {
  return Math.min(...points.map((point) => haversineMeters(point.latitude, point.longitude, latitude, longitude)));
}

async function getTrailRoutePoints(trailId: string): Promise<CoordinatePoint[]> {
  console.log("[safety.routes] Fetching trail route points:", trailId);
  const result = await pool.query<{ geometry_text: string | null }>(
    `SELECT ST_AsText(geometry::geometry) AS geometry_text
     FROM trails
     WHERE id = $1::uuid AND deleted_at IS NULL`,
    [trailId]
  );

  if (result.rowCount === 0) {
    return [];
  }

  return parseLineString(result.rows[0].geometry_text);
}

router.post(
  "/fetch-ocha",
  authenticate,
  asyncHandler(requireAdmin),
  asyncHandler(async (_req, res) => {
    console.log("[safety.routes] POST /fetch-ocha start");
    try {
      const result = await fetchOchaIncidents();
      const totalResult = await pool.query<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM safety_incidents WHERE source = 'ocha'"
      );

      res.json({
        message: "OCHA incidents fetched",
        processed: result.processed,
        inserted: result.inserted,
        total_in_db: Number(totalResult.rows[0]?.count ?? 0),
      });
    } catch (error) {
      console.error("[safety.routes] /fetch-ocha failed:", error);
      res.status(500).json({ error: "Failed to fetch OCHA incidents", detail: error instanceof Error ? error.message : String(error) });
    }
  })
);

router.get(
  "/nearby-alerts",
  optionalAuthenticate,
  asyncHandler(async (req, res) => {
    console.log("[safety.routes] GET /nearby-alerts start");
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    const radius = req.query.radius === undefined ? 5000 : Number(req.query.radius);
    const userId = req.auth?.sub ?? null;
    const trailId = isUuid(req.query.trail_id) ? req.query.trail_id : null;

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      res.status(400).json({ error: "lat and lng query parameters are required and must be numeric" });
      return;
    }

    if (!Number.isFinite(radius) || radius <= 0) {
      res.status(400).json({ error: "radius must be a positive number" });
      return;
    }

    try {
      console.log("[safety.routes] Fetching active incidents and dangerous locations");
      const [incidentResult, locationResult] = await Promise.all([
        pool.query<SafetyIncidentRow>(
          `SELECT id, incident_type, severity, latitude, longitude, description, headline,
                  source, source_name, source_url, reported_at, expires_at
           FROM safety_incidents
           WHERE is_resolved = false
             AND expires_at > NOW()
             AND COALESCE(moderation_status, 'active') = 'active'`
        ),
        pool.query<DangerousLocationRow>(
          `SELECT id, name, name_ar, location_type, latitude, longitude, danger_radius_meters, risk_level
           FROM dangerous_locations
           WHERE is_active = true`
        ),
      ]);

      const incidents = incidentResult.rows
        .map((incident) => ({
          ...incident,
          kind: "incident" as const,
          latitude: toNumber(incident.latitude),
          longitude: toNumber(incident.longitude),
          distance_meters: Math.round(haversineMeters(lat, lng, toNumber(incident.latitude), toNumber(incident.longitude))),
        }))
        .filter((incident) => incident.distance_meters <= radius);

      const locations = locationResult.rows
        .map((location) => ({
          ...location,
          kind: "location" as const,
          latitude: toNumber(location.latitude),
          longitude: toNumber(location.longitude),
          danger_radius_meters: toNumber(location.danger_radius_meters),
          distance_meters: Math.round(haversineMeters(lat, lng, toNumber(location.latitude), toNumber(location.longitude))),
        }))
        .filter((location) => location.distance_meters <= radius);

      const alerts = [...incidents, ...locations].sort((left, right) => left.distance_meters - right.distance_meters);

      if (userId) {
        console.log("[safety.routes] Creating nearby alert notifications for user:", userId);
        const notificationAlerts = alerts.filter((alert) => alert.distance_meters <= SAFETY_PUSH_WARNING_RADIUS_METERS);
        for (const alert of notificationAlerts) {
          const isLocation = alert.kind === "location";
          const locationName = isLocation
            ? alert.name
            : alert.headline ?? alert.description ?? alert.incident_type;
          const locationType = isLocation ? alert.location_type : alert.incident_type;
          const riskLevel = isLocation ? alert.risk_level : alert.severity;
          const title = locationType === "settlement" || locationType.includes("settlement")
            ? "Settlement nearby"
            : "Danger reported nearby";

          await createSafetyNotificationBestEffort({
            user_id: userId,
            title,
            body: `${locationName} is ${Math.round(alert.distance_meters)}m from your location. Exercise caution.`,
            entity_id: trailId,
            data: {
              danger_id: alert.id,
              danger_kind: alert.kind,
              severity: riskLevel,
              danger_type: locationType,
              source: "safety",
              latitude: alert.latitude,
              longitude: alert.longitude,
              distance_meters: alert.distance_meters,
              warning_radius_meters: SAFETY_PUSH_WARNING_RADIUS_METERS,
              cooldown_minutes: 60,
            },
            cooldownMinutes: 60,
          });
        }
      }

      res.json({ data: alerts });
    } catch (error) {
      console.error("[safety.routes] /nearby-alerts database error:", error);
      res.status(500).json({ error: "Failed to fetch nearby alerts", detail: error instanceof Error ? error.message : String(error) });
    }
  })
);

router.get(
  "/trails/:id/safety",
  asyncHandler(async (req, res) => {
    console.log("[safety.routes] GET /trails/:id/safety start");
    const trailId = req.params.id;

    if (typeof trailId !== "string" || trailId.trim() === "") {
      res.status(400).json({ error: "Trail id is required" });
      return;
    }

    try {
      console.log("[safety.routes] Checking safety score cache");
      const cachedResult = await pool.query(
        `SELECT safety_score, risk_level, nearest_settlement_name, nearest_settlement_distance_meters,
                nearest_checkpoint_name, nearest_checkpoint_distance_meters, incident_count_48h, last_calculated
         FROM trail_safety_scores
         WHERE trail_id = $1::uuid AND last_calculated > NOW() - INTERVAL '1 hour'`,
        [trailId]
      );

      if ((cachedResult.rowCount ?? 0) > 0) {
        const cached = cachedResult.rows[0];
        res.json({
          data: {
            safety_score: Number(cached.safety_score),
            risk_level: cached.risk_level,
            nearest_settlement: cached.nearest_settlement_name
              ? {
                  name: cached.nearest_settlement_name,
                  distance_meters: Number(cached.nearest_settlement_distance_meters ?? 0),
                }
              : null,
            nearest_checkpoint: cached.nearest_checkpoint_name
              ? {
                  name: cached.nearest_checkpoint_name,
                  distance_meters: Number(cached.nearest_checkpoint_distance_meters ?? 0),
                }
              : null,
            incident_count_48h: Number(cached.incident_count_48h ?? 0),
            warnings: [],
            cached: true,
          },
        });
        return;
      }

      const routePoints = await getTrailRoutePoints(trailId);
      if (routePoints.length === 0) {
        res.status(404).json({ error: "Trail route not found" });
        return;
      }

      const samplePoints = sampleRoutePoints(routePoints);
      console.log(`[safety.routes] Sampled ${samplePoints.length} route points`);

      const [locationsResult, incidentsResult] = await Promise.all([
        pool.query<DangerousLocationRow>(
          `SELECT id, name, name_ar, location_type, latitude, longitude, danger_radius_meters, risk_level
           FROM dangerous_locations
           WHERE is_active = true`
        ),
        pool.query<SafetyIncidentRow>(
          `SELECT id, incident_type, severity, latitude, longitude, description, headline,
                  source, source_name, source_url, reported_at, expires_at
           FROM safety_incidents
           WHERE is_resolved = false
             AND reported_at > NOW() - INTERVAL '7 days'
             AND COALESCE(moderation_status, 'active') = 'active'`
        ),
      ]);

      let safetyScore = 100;
      const warnings: string[] = [];
      let nearestSettlement: { name: string; distance_meters: number } | null = null;
      let nearestCheckpoint: { name: string; distance_meters: number } | null = null;

      for (const location of locationsResult.rows) {
        const distance = getMinimumDistanceToRoute(samplePoints, toNumber(location.latitude), toNumber(location.longitude));
        const roundedDistance = Math.round(distance);

        if (location.location_type.includes("settlement") && (!nearestSettlement || roundedDistance < nearestSettlement.distance_meters)) {
          nearestSettlement = { name: location.name, distance_meters: roundedDistance };
        }

        if (location.location_type.includes("checkpoint") && (!nearestCheckpoint || roundedDistance < nearestCheckpoint.distance_meters)) {
          nearestCheckpoint = { name: location.name, distance_meters: roundedDistance };
        }

        if (distance <= toNumber(location.danger_radius_meters)) {
          safetyScore -= getRiskPenalty(location.risk_level);
          warnings.push(`${location.risk_level} risk near ${location.name}`);
        }
      }

      let incidentCount48h = 0;
      const twoDaysAgo = Date.now() - 48 * 60 * 60 * 1000;

      for (const incident of incidentsResult.rows) {
        const distance = getMinimumDistanceToRoute(samplePoints, toNumber(incident.latitude), toNumber(incident.longitude));
        if (distance > 2000) {
          continue;
        }

        safetyScore -= getRiskPenalty(incident.severity);
        warnings.push(`${incident.severity} incident nearby: ${incident.headline ?? incident.incident_type}`);

        if (new Date(incident.reported_at).getTime() >= twoDaysAgo) {
          incidentCount48h += 1;
        }
      }

      safetyScore = Math.max(0, safetyScore);
      const riskLevel = getRiskLevel(safetyScore);

      console.log("[safety.routes] Caching calculated safety score");
      await pool.query(
        `INSERT INTO trail_safety_scores (trail_id, safety_score, risk_level, incident_count_48h, last_calculated)
         VALUES ($1::uuid, $2, $3, $4, NOW())
         ON CONFLICT (trail_id) DO UPDATE SET
           safety_score = EXCLUDED.safety_score,
           risk_level = EXCLUDED.risk_level,
           incident_count_48h = EXCLUDED.incident_count_48h,
           last_calculated = NOW()`,
        [trailId, safetyScore, riskLevel, incidentCount48h]
      );

      res.json({
        data: {
          safety_score: safetyScore,
          risk_level: riskLevel,
          nearest_settlement: nearestSettlement,
          nearest_checkpoint: nearestCheckpoint,
          incident_count_48h: incidentCount48h,
          warnings,
        },
      });
    } catch (error) {
      console.error("[safety.routes] /trails/:id/safety database error:", error);
      res.status(500).json({ error: "Failed to calculate trail safety", detail: error instanceof Error ? error.message : String(error) });
    }
  })
);

router.post(
  "/report-incident",
  authenticate,
  asyncHandler(async (req, res) => {
    console.log("[safety.routes] POST /report-incident start");

    if (!req.auth?.sub) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const parsed = reportIncidentSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }

    try {
      console.log("[safety.routes] Inserting user incident report");
      const result = await pool.query<{ id: string; moderation_status: string }>(
        `INSERT INTO safety_incidents (
           incident_type, severity, latitude, longitude,
           description, headline, reported_at, expires_at,
           source, source_name, confirmed_count, reporter_id, moderation_status
         )
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW() + INTERVAL '48 hours', 'user', 'User report', 1, $7::uuid, 'pending')
         RETURNING id, moderation_status`,
        [
          parsed.data.incident_type,
          parsed.data.severity,
          parsed.data.latitude,
          parsed.data.longitude,
          parsed.data.description ?? "",
          parsed.data.location_name ?? "User reported safety incident",
          req.auth.sub,
        ]
      );

      console.log("[safety.routes] Updating achievement stats for incident report");
      await updateUserStats(req.auth.sub, { incidents: 1 });

      res.status(201).json({ data: { id: result.rows[0].id, moderation_status: result.rows[0].moderation_status } });
    } catch (error) {
      console.error("[safety.routes] /report-incident database error:", error);
      res.status(500).json({ error: "Failed to report incident", detail: error instanceof Error ? error.message : String(error) });
    }
  })
);

router.patch(
  "/incidents/:id/moderation",
  authenticate,
  asyncHandler(requireAdmin),
  asyncHandler(async (req, res) => {
    const incidentId = req.params.id;
    if (!isUuid(incidentId)) {
      res.status(400).json({ error: "Incident id must be a valid UUID" });
      return;
    }

    const parsed = incidentModerationSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }

    const isResolved = ["resolved", "expired", "rejected"].includes(parsed.data.status);
    const result = await pool.query(
      `UPDATE safety_incidents
       SET moderation_status = $2,
           moderation_note = $3,
           moderated_by = $4::uuid,
           moderated_at = NOW(),
           is_resolved = $5,
           resolved_at = CASE WHEN $5 THEN COALESCE(resolved_at, NOW()) ELSE resolved_at END
       WHERE id = $1::uuid
       RETURNING id, moderation_status, is_resolved, moderated_at`,
      [incidentId, parsed.data.status, parsed.data.note ?? null, req.auth?.sub, isResolved]
    );

    if (!result.rows[0]) {
      res.status(404).json({ error: "Incident not found" });
      return;
    }

    res.json({ data: result.rows[0] });
  })
);

export default router;

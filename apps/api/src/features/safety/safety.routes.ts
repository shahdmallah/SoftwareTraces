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
import { trackUserActivity } from "../analytics/analytics.service";
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
type IncidentModerationStatus = "pending" | "approved" | "verified" | "rejected" | "hidden" | "active" | "resolved" | "expired";
type IncidentTrustLevel = "community_report" | "community_confirmed" | "admin_verified" | "disputed" | "hidden";

const PUBLIC_INCIDENT_MODERATION_SQL = "'pending', 'approved', 'verified', 'active'";
const COMMUNITY_CONFIRMATION_THRESHOLD = 5;
const safetyIncidentColumnCache = new Map<string, boolean>();

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
  moderation_status: IncidentModerationStatus | null;
  confirmations_count: string | number | null;
  disputes_count: string | number | null;
  community_confidence_score: string | number | null;
  reported_at: string | Date;
  expires_at: string | Date;
}

const router = Router();
const SAFETY_PUSH_NOTIFICATION_DISTANCE_METERS = 500;

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
  status: z.enum(["pending", "approved", "verified", "rejected", "hidden"]),
  note: z.string().trim().max(1000).optional(),
});

const incidentFeedbackSchema = z.object({
  action: z.enum(["confirm", "dispute", "note"]),
  comment: z.string().trim().max(1000).optional(),
});

function toNumber(value: string | number | null | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function safetyIncidentColumnExists(columnName: string): Promise<boolean> {
  const cached = safetyIncidentColumnCache.get(columnName);
  if (cached !== undefined) {
    return cached;
  }

  const result = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'safety_incidents'
         AND column_name = $1
     ) AS exists`,
    [columnName]
  );
  const exists = Boolean(result.rows[0]?.exists);
  safetyIncidentColumnCache.set(columnName, exists);
  return exists;
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

function getIncidentTrustLevel(
  incident: Pick<SafetyIncidentRow, "moderation_status" | "confirmations_count" | "disputes_count">
): IncidentTrustLevel {
  const status = incident.moderation_status ?? "pending";
  const confirmations = toNumber(incident.confirmations_count);
  const disputes = toNumber(incident.disputes_count);

  if (status === "hidden") {
    return "hidden";
  }

  if (status === "approved" || status === "verified" || status === "active") {
    return "admin_verified";
  }

  if (disputes > confirmations) {
    return "disputed";
  }

  if (confirmations >= COMMUNITY_CONFIRMATION_THRESHOLD && confirmations > disputes) {
    return "community_confirmed";
  }

  return "community_report";
}

function getIncidentVerificationLabel(
  incident: Pick<SafetyIncidentRow, "moderation_status" | "source" | "confirmations_count" | "disputes_count">
): string {
  switch (getIncidentTrustLevel(incident)) {
    case "admin_verified":
      return "Verified by admin";
    case "community_confirmed":
      return "Community confirmed";
    case "disputed":
      return "Disputed";
    case "hidden":
      return "Hidden";
    case "community_report":
    default:
      return incident.source === "user" ? "Reported by community" : "Community report";
  }
}

function enrichIncidentForPublic(incident: SafetyIncidentRow) {
  const confirmationsCount = toNumber(incident.confirmations_count);
  const disputesCount = toNumber(incident.disputes_count);

  return {
    ...incident,
    confirmations_count: confirmationsCount,
    disputes_count: disputesCount,
    community_confidence_score: toNumber(incident.community_confidence_score),
    trust_level: getIncidentTrustLevel(incident),
    verification_label: getIncidentVerificationLabel(incident),
    confirmation_label: `Confirmed by ${confirmationsCount} users`,
    dispute_label: `Disputed by ${disputesCount} users`,
  };
}

async function refreshIncidentCommunityValidation(incidentId: string) {
  const hasCommunityNotesCount = await safetyIncidentColumnExists("community_notes_count");
  const communityNotesCountSetSql = hasCommunityNotesCount
    ? `,
         community_notes_count = calculated_counts.community_notes_count`
    : "";
  const communityNotesCountReturningSql = hasCommunityNotesCount
    ? `,
               si.community_notes_count`
    : "";

  const result = await pool.query(
    `WITH counts AS (
       SELECT
         requested.incident_id,
         COALESCE(COUNT(feedback.id) FILTER (WHERE feedback.feedback_type = 'confirm'), 0)::int AS confirmations_count,
         COALESCE(COUNT(feedback.id) FILTER (WHERE feedback.feedback_type = 'dispute'), 0)::int AS disputes_count,
         COALESCE(COUNT(feedback.id) FILTER (WHERE feedback.feedback_type = 'note'), 0)::int AS community_notes_count
       FROM (SELECT $1::uuid AS incident_id) requested
       LEFT JOIN safety_incident_feedback feedback
         ON feedback.incident_id = requested.incident_id
       GROUP BY requested.incident_id
     ),
     calculated_counts AS (
       SELECT
         counts.incident_id,
         counts.confirmations_count,
         counts.disputes_count,
         counts.community_notes_count,
         CASE
           WHEN counts.confirmations_count + counts.disputes_count = 0 THEN 0
           ELSE ROUND((counts.confirmations_count::numeric / (counts.confirmations_count + counts.disputes_count)) * 100)
         END AS community_confidence_score
       FROM counts
     )
     UPDATE safety_incidents si
     SET confirmations_count = calculated_counts.confirmations_count,
         disputes_count = calculated_counts.disputes_count,
         community_confidence_score = calculated_counts.community_confidence_score${communityNotesCountSetSql}
     FROM calculated_counts
     WHERE si.id = calculated_counts.incident_id
     RETURNING si.id,
               si.confirmations_count,
               si.disputes_count,
               si.community_confidence_score,
               si.moderation_status${communityNotesCountReturningSql}`,
    [incidentId]
  );

  await pool.query("DELETE FROM trail_safety_scores");
  return result.rows[0] ?? null;
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
                  source, source_name, source_url, COALESCE(moderation_status, 'pending') AS moderation_status,
                  COALESCE(confirmations_count, confirmed_count, 0) AS confirmations_count,
                  COALESCE(disputes_count, 0) AS disputes_count,
                  COALESCE(community_confidence_score, 0) AS community_confidence_score,
                  reported_at, expires_at
           FROM safety_incidents
           WHERE is_resolved = false
             AND expires_at > NOW()
             AND COALESCE(moderation_status, 'pending') IN (${PUBLIC_INCIDENT_MODERATION_SQL})`
        ),
        pool.query<DangerousLocationRow>(
          `SELECT id, name, name_ar, location_type, latitude, longitude, danger_radius_meters, risk_level
           FROM dangerous_locations
           WHERE is_active = true`
        ),
      ]);

      const incidents = incidentResult.rows
        .map((incident) => ({
          ...enrichIncidentForPublic(incident),
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
        for (const alert of alerts) {
          if (alert.distance_meters > SAFETY_PUSH_NOTIFICATION_DISTANCE_METERS) {
            continue;
          }

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
                  source, source_name, source_url, COALESCE(moderation_status, 'pending') AS moderation_status,
                  COALESCE(confirmations_count, confirmed_count, 0) AS confirmations_count,
                  COALESCE(disputes_count, 0) AS disputes_count,
                  COALESCE(community_confidence_score, 0) AS community_confidence_score,
                  reported_at, expires_at
           FROM safety_incidents
           WHERE is_resolved = false
             AND reported_at > NOW() - INTERVAL '7 days'
             AND COALESCE(moderation_status, 'pending') IN (${PUBLIC_INCIDENT_MODERATION_SQL})`
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
        warnings.push(`${incident.severity} incident nearby (${getIncidentVerificationLabel(incident)}): ${incident.headline ?? incident.incident_type}`);

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
      const result = await pool.query<{ id: string; moderation_status: string; confirmations_count: number; disputes_count: number; community_confidence_score: number }>(
        `INSERT INTO safety_incidents (
           incident_type, severity, latitude, longitude,
           description, headline, reported_at, expires_at,
           source, source_name, confirmed_count, reporter_id, moderation_status,
           confirmations_count, disputes_count, community_confidence_score
         )
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW() + INTERVAL '48 hours', 'user', 'User report', 0, $7::uuid, 'pending', 0, 0, 0)
         RETURNING id, moderation_status, confirmations_count, disputes_count, community_confidence_score`,
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
      await trackUserActivity({
        userId: req.auth.sub,
        eventType: "incident_reported",
        metadata: { incident_id: result.rows[0].id, incident_type: parsed.data.incident_type },
      });
      await pool.query("DELETE FROM trail_safety_scores");

      res.status(201).json({
        data: {
          id: result.rows[0].id,
          moderation_status: result.rows[0].moderation_status,
          confirmations_count: result.rows[0].confirmations_count,
          disputes_count: result.rows[0].disputes_count,
          community_confidence_score: result.rows[0].community_confidence_score,
          trust_level: "community_report",
          verification_label: "Reported by community",
        },
      });
    } catch (error) {
      console.error("[safety.routes] /report-incident database error:", error);
      res.status(500).json({ error: "Failed to report incident", detail: error instanceof Error ? error.message : String(error) });
    }
  })
);

router.post(
  "/incidents/:id/feedback",
  authenticate,
  asyncHandler(async (req, res) => {
    try {
      const incidentId = req.params.id;
      if (!isUuid(incidentId)) {
        res.status(400).json({ error: "Incident id must be a valid UUID" });
        return;
      }

      if (!req.auth?.sub) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }

      const parsed = incidentFeedbackSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
        return;
      }

      if (parsed.data.action === "note" && !parsed.data.comment) {
        res.status(400).json({ error: "A supporting note requires a comment" });
        return;
      }

      const profileResult = await pool.query<{ id: string }>(
        `SELECT COALESCE(id, user_id) AS id
         FROM profiles
         WHERE user_id = $1::uuid OR id = $1::uuid
         LIMIT 1`,
        [req.auth.sub]
      );

      if (!profileResult.rows[0]) {
        res.status(404).json({ error: "Authenticated user profile not found" });
        return;
      }

      const incidentResult = await pool.query<{ id: string }>(
        `SELECT id
         FROM safety_incidents
         WHERE id = $1::uuid
           AND is_resolved = false
           AND COALESCE(moderation_status, 'pending') IN (${PUBLIC_INCIDENT_MODERATION_SQL})
         LIMIT 1`,
        [incidentId]
      );

      if (!incidentResult.rows[0]) {
        res.status(404).json({ error: "Incident not found or not available for community feedback" });
        return;
      }

      const existingFeedbackResult = await pool.query<{ id: string; feedback_type: string; note: string | null }>(
        `SELECT id, feedback_type, note
         FROM safety_incident_feedback
         WHERE incident_id = $1::uuid
           AND user_id = $2::uuid
         LIMIT 1`,
        [incidentId, req.auth.sub]
      );
      const wasUpdated = Boolean(existingFeedbackResult.rows[0]);

      const feedbackResult = await pool.query<{
        id: string;
        incident_id: string;
        user_id: string;
        feedback_type: string;
        note: string | null;
        comment: string | null;
        created_at: string | Date;
        updated_at: string | Date;
      }>(
        `INSERT INTO safety_incident_feedback (incident_id, user_id, feedback_type, note)
         VALUES ($1::uuid, $2::uuid, $3, $4)
         ON CONFLICT (incident_id, user_id, feedback_type)
         DO UPDATE SET
           feedback_type = EXCLUDED.feedback_type,
           note = EXCLUDED.note,
           updated_at = NOW()
         RETURNING id, incident_id, user_id, feedback_type, note, note AS comment, created_at, updated_at`,
        [incidentId, req.auth.sub, parsed.data.action, parsed.data.comment ?? null]
      );

      const incident = await refreshIncidentCommunityValidation(incidentId);

      res.status(wasUpdated ? 200 : 201).json({
        data: {
          feedback: feedbackResult.rows[0],
          incident,
          duplicate_strategy: wasUpdated ? "updated_existing_feedback" : "created_feedback",
        },
      });
    } catch (error) {
      console.error("[safety.feedback]", error);

      const pgCode = typeof error === "object" && error !== null && "code" in error ? String((error as { code?: unknown }).code) : "";
      if (pgCode === "23503") {
        res.status(404).json({ error: "Referenced incident or user no longer exists" });
        return;
      }

      if (pgCode === "23514" || pgCode === "22P02") {
        res.status(400).json({ error: "Invalid feedback request" });
        return;
      }

      res.status(500).json({
        error: "Failed to save safety incident feedback",
        ...(process.env.NODE_ENV !== "production"
          ? { details: error instanceof Error ? error.message : String(error) }
          : {}),
      });
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

    const result = await pool.query(
      `UPDATE safety_incidents
       SET moderation_status = $2,
           moderation_note = $3,
           moderated_by = $4::uuid,
           moderated_at = NOW()
       WHERE id = $1::uuid
       RETURNING id, moderation_status, moderation_note, moderated_by, moderated_at`,
      [incidentId, parsed.data.status, parsed.data.note ?? null, req.auth?.sub]
    );

    if (!result.rows[0]) {
      res.status(404).json({ error: "Incident not found" });
      return;
    }

    await pool.query("DELETE FROM trail_safety_scores");

    res.json({ data: result.rows[0] });
  })
);

export default router;

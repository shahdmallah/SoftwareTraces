import type { Request, Response } from "express";
import fetch from "node-fetch";
import { z, ZodError } from "zod";
import { pool } from "../../db/pool";
import { requireAuth } from "../../middleware/auth";
import { HttpError } from "../../lib/httpError";

type AccessRiskLevel = "clear" | "attention" | "caution" | "dangerous";

interface RoutePoint {
  lat: number;
  lng: number;
  distanceFromStartMeters?: number;
}

interface DangerousLocationRow {
  id: string;
  name: string;
  name_ar: string | null;
  location_type: string;
  latitude: string | number;
  longitude: string | number;
  danger_radius_meters: string | number | null;
  risk_level: string;
  operating_hours: string | null;
  description: string | null;
  description_ar: string | null;
  is_active: boolean;
}

interface CheckpointReportRow {
  id: string;
  checkpoint_id: string;
  reporter_id: string | null;
  status: "open" | "slow" | "closed";
  wait_minutes: number;
  notes: string | null;
  created_at: string | Date;
  expires_at: string | Date;
}

interface CheckpointReportSummaryRow {
  average_wait_minutes: string | number | null;
  reports_count: string | number;
}

interface CheckpointRouteSuggestionRow {
  id: string;
  checkpoint_id: string;
  reporter_id: string | null;
  from_lat: string | number;
  from_lng: string | number;
  trailhead_lat: string | number;
  trailhead_lng: string | number;
  waypoint_lat: string | number;
  waypoint_lng: string | number;
  waypoint_name: string | null;
  notes: string | null;
  original_distance_km: string | number | null;
  original_duration_minutes: number | null;
  suggested_distance_km: string | number | null;
  suggested_duration_minutes: number | null;
  extra_distance_km: string | number | null;
  extra_time_minutes: number | null;
  route_geometry: unknown;
  created_at: string | Date;
  expires_at: string | Date;
  status: "active" | "expired" | "hidden";
}

interface AccessRouteRow {
  id: string;
  trail_id: string;
  trailhead_latitude: string | number;
  trailhead_longitude: string | number;
  trailhead_name: string | null;
  trailhead_name_ar: string | null;
  trailhead_parking_notes: string | null;
  trailhead_parking_notes_ar: string | null;
  trailhead_access_notes: string | null;
  trailhead_access_notes_ar: string | null;
  created_at: string | Date;
  updated_at: string | Date;
}

interface TrailStartPointRow {
  id: string;
  start_lat: string | number;
  start_lng: string | number;
  name: string | null;
  name_ar: string | null;
  geometry_geojson: unknown;
}

interface MapboxRoute {
  distance: number;
  duration: number;
  geometry: {
    coordinates: [number, number][];
  };
}

interface MapboxDirectionsResponse {
  routes?: MapboxRoute[];
  message?: string;
}

const accessBodySchema = z.object({
  latitude: z.coerce.number().optional(),
  longitude: z.coerce.number().optional(),
  trailhead_lat: z.coerce.number().optional(),
  trailhead_lng: z.coerce.number().optional(),
  trailhead_latitude: z.coerce.number().optional(),
  trailhead_longitude: z.coerce.number().optional(),
  name: z.string().trim().min(1).optional(),
  name_ar: z.string().trim().min(1).optional(),
  trailhead_name: z.string().trim().min(1).optional(),
  trailhead_name_ar: z.string().trim().min(1).optional(),
  notes: z.string().trim().optional(),
  parking_notes: z.string().trim().optional(),
  parking_notes_ar: z.string().trim().optional(),
  access_notes: z.string().trim().optional(),
  access_notes_ar: z.string().trim().optional(),
  trailhead_parking_notes: z.string().trim().optional(),
  trailhead_parking_notes_ar: z.string().trim().optional(),
  trailhead_access_notes: z.string().trim().optional(),
  trailhead_access_notes_ar: z.string().trim().optional(),
});

type NormalizedAccessBody = {
  trailhead_latitude: number;
  trailhead_longitude: number;
  trailhead_name: string;
  trailhead_name_ar: string;
  trailhead_parking_notes: string | null;
  trailhead_parking_notes_ar: string | null;
  trailhead_access_notes: string | null;
  trailhead_access_notes_ar: string | null;
};

const checkpointReportSchema = z.object({
  status: z.enum(["open", "closed", "slow"]),
  wait_minutes: z.coerce.number().min(0).max(300).optional(),
  wait_time_minutes: z.coerce.number().min(0).max(300).optional(),
  expires_in_minutes: z.coerce.number().int().min(1).max(24 * 60).optional(),
  notes: z.string().trim().optional(),
}).transform((body) => ({
  status: body.status,
  wait_minutes: body.wait_time_minutes ?? body.wait_minutes ?? 0,
  expires_in_minutes: body.expires_in_minutes ?? 180,
  notes: body.notes,
}));

const routeSuggestionSchema = z.object({
  from_lat: z.number().min(31.0).max(33.0),
  from_lng: z.number().min(34.5).max(36.0),
  trailhead_lat: z.number().min(31.0).max(33.0),
  trailhead_lng: z.number().min(34.5).max(36.0),
  waypoint_lat: z.number().min(31.0).max(33.0),
  waypoint_lng: z.number().min(34.5).max(36.0),
  waypoint_name: z.string().optional(),
  notes: z.string().optional(),
});

function getRequestId(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] : (value ?? "");
}

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toFiniteNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isValidCoordinate(lat: number, lng: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return false;
  }

  if (lat === 0 && lng === 0) {
    return false;
  }

  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

function parseCoordinatePair(value: unknown, preferredOrder: "latlng" | "lnglat" = "latlng"): { lat: number; lng: number } | null {
  if (!Array.isArray(value) || value.length < 2) {
    return null;
  }

  const first = toFiniteNumber(value[0]);
  const second = toFiniteNumber(value[1]);
  if (first === null || second === null) {
    return null;
  }

  const primary = preferredOrder === "lnglat"
    ? { lng: first, lat: second }
    : { lat: first, lng: second };
  if (isValidCoordinate(primary.lat, primary.lng)) {
    return primary;
  }

  const swapped = preferredOrder === "lnglat"
    ? { lat: first, lng: second }
    : { lng: first, lat: second };
  return isValidCoordinate(swapped.lat, swapped.lng) ? swapped : null;
}

function getFirstValidCoordinate(value: unknown, preferredOrder: "latlng" | "lnglat" = "latlng"): { lat: number; lng: number } | null {
  const direct = parseCoordinatePair(value, preferredOrder);
  if (direct) {
    return direct;
  }

  if (value && typeof value === "object" && "coordinates" in value) {
    return getFirstValidCoordinate((value as { coordinates?: unknown }).coordinates, "lnglat");
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const coordinate = getFirstValidCoordinate(item, preferredOrder);
      if (coordinate) {
        return coordinate;
      }
    }
  }

  return null;
}

function getValidLatLng(latValue: unknown, lngValue: unknown): { lat: number; lng: number } | null {
  const lat = toFiniteNumber(latValue);
  const lng = toFiniteNumber(lngValue);
  return lat !== null && lng !== null && isValidCoordinate(lat, lng) ? { lat, lng } : null;
}

function normalizeAccessBody(rawBody: unknown): { data?: NormalizedAccessBody; error?: unknown } {
  const parsed = accessBodySchema.safeParse(rawBody ?? {});
  if (!parsed.success) {
    return { error: parsed.error.flatten() };
  }

  const body = parsed.data;
  const latitude = body.latitude ?? body.trailhead_lat ?? body.trailhead_latitude;
  const longitude = body.longitude ?? body.trailhead_lng ?? body.trailhead_longitude;
  const coordinate = getValidLatLng(latitude, longitude);
  if (!coordinate || !isWestBankCoordinate(coordinate.lat, coordinate.lng)) {
    return {
      error: {
        fieldErrors: {
          latitude: ["latitude, trailhead_lat, or trailhead_latitude must be a valid West Bank latitude."],
          longitude: ["longitude, trailhead_lng, or trailhead_longitude must be a valid West Bank longitude."],
        },
        formErrors: [],
      },
    };
  }

  const name = body.name ?? body.trailhead_name ?? "Main trailhead";
  const nameAr = body.name_ar ?? body.trailhead_name_ar ?? name;
  return {
    data: {
      trailhead_latitude: coordinate.lat,
      trailhead_longitude: coordinate.lng,
      trailhead_name: name,
      trailhead_name_ar: nameAr,
      trailhead_parking_notes: body.parking_notes ?? body.trailhead_parking_notes ?? body.notes ?? null,
      trailhead_parking_notes_ar: body.parking_notes_ar ?? body.trailhead_parking_notes_ar ?? null,
      trailhead_access_notes: body.access_notes ?? body.trailhead_access_notes ?? null,
      trailhead_access_notes_ar: body.access_notes_ar ?? body.trailhead_access_notes_ar ?? null,
    },
  };
}

function isDbConstraintError(error: unknown): error is { code?: string; constraint?: string; detail?: string; message?: string } {
  return typeof error === "object" && error !== null && "code" in error;
}

function toIsoString(value: string | Date | null | undefined): string | null {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function isWestBankCoordinate(lat: number, lng: number): boolean {
  return lat >= 31.0 && lat <= 33.0 && lng >= 34.5 && lng <= 36.0;
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function handleAccessError(scope: string, res: Response, error: unknown): void {
  console.error(`[access.${scope}] ERROR:`, error);

  if (error instanceof ZodError) {
    res.status(400).json({ error: "Validation failed", details: error.flatten() });
    return;
  }

  res.status(500).json({
    error: "Internal server error",
    details: error instanceof Error ? error.message : String(error),
  });
}

async function getProfileIdForAuthUser(userId: string): Promise<string | null> {
  const result = await pool.query<{ id: string }>(
    `SELECT id
     FROM profiles
     WHERE id = $1::uuid OR user_id = $1::uuid
     LIMIT 1`,
    [userId]
  );

  return result.rows[0]?.id ?? null;
}

export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function sampleRoutePoints(coordinates: [number, number][], intervalMeters: number): RoutePoint[] {
  console.log("[access.sampleRoutePoints] Sampling route:", { coordinateCount: coordinates.length, intervalMeters });

  if (coordinates.length === 0) {
    return [];
  }

  const first = coordinates[0];
  const samples: RoutePoint[] = [{ lng: first[0], lat: first[1], distanceFromStartMeters: 0 }];
  let totalDistanceMeters = 0;
  let nextSampleAtMeters = intervalMeters;

  for (let index = 1; index < coordinates.length; index += 1) {
    const [previousLng, previousLat] = coordinates[index - 1];
    const [currentLng, currentLat] = coordinates[index];
    const segmentDistance = haversineMeters(previousLat, previousLng, currentLat, currentLng);

    while (segmentDistance > 0 && totalDistanceMeters + segmentDistance >= nextSampleAtMeters) {
      const ratio = (nextSampleAtMeters - totalDistanceMeters) / segmentDistance;
      samples.push({
        lng: previousLng + (currentLng - previousLng) * ratio,
        lat: previousLat + (currentLat - previousLat) * ratio,
        distanceFromStartMeters: nextSampleAtMeters,
      });
      nextSampleAtMeters += intervalMeters;
    }

    totalDistanceMeters += segmentDistance;
  }

  const last = coordinates[coordinates.length - 1];
  const lastSample = samples[samples.length - 1];
  if (!lastSample || lastSample.lat !== last[1] || lastSample.lng !== last[0]) {
    samples.push({ lng: last[0], lat: last[1], distanceFromStartMeters: totalDistanceMeters });
  }

  console.log("[access.sampleRoutePoints] Samples created:", samples.length);
  return samples;
}

function getCheckpointStatusLabel(status: unknown): string {
  if (status === "closed") {
    return "Checkpoint reported closed";
  }

  if (status === "slow") {
    return "Checkpoint reported slow";
  }

  return "Checkpoint reported open";
}

function getIncidentLabel(status: unknown): string {
  return getCheckpointStatusLabel(status);
}

function buildWarning(location: DangerousLocationRow, currentReport: CheckpointReportRow | null): { warning_en: string; warning_ar: string } {
  const operatingHours = location.operating_hours ? `${location.operating_hours}.` : "";
  const waitInfo = currentReport
    ? `Current report: ${currentReport.status}, about ${currentReport.wait_minutes} minutes wait.`
    : "";

  if (location.location_type === "military_checkpoint" || location.location_type === "flying_checkpoint") {
    if (currentReport) {
      const currentWait = { incident_type: currentReport.status, wait_minutes: currentReport.wait_minutes };
      const warning = `⚠️ ${getIncidentLabel(currentWait.incident_type)}. Wait: ${currentWait.wait_minutes} min`;
      return {
        warning_en: warning,
        warning_ar: warning,
      };
    }

    return {
      warning_en: `⚠️ ${location.name} ahead. Have your ID ready. ${operatingHours} ${waitInfo}`.replace(/\s+/g, " ").trim(),
      warning_ar: `⚠️ ${location.name_ar ?? location.name} أمامك. جهز هويتك. ${operatingHours} ${waitInfo}`.replace(/\s+/g, " ").trim(),
    };
  }

  if (location.location_type === "settlement" || location.location_type === "outpost") {
    return {
      warning_en: `⚠️ Route passes near ${location.name} settlement. Exercise caution on this road.`,
      warning_ar: `⚠️ يمر الطريق بالقرب من ${location.name_ar ?? location.name}. توخ الحذر على هذا الطريق.`,
    };
  }

  return {
    warning_en: "⚠️ This road passes through a settlement bypass. Alternative route recommended.",
    warning_ar: "⚠️ يمر هذا الطريق عبر شارع التفافي للمستوطنات. يوصى باستخدام طريق بديل.",
  };
}

function formatCheckpointReport(report: CheckpointReportRow) {
  return {
    id: report.id,
    checkpoint_id: report.checkpoint_id,
    status: report.status,
    wait_minutes: Number(report.wait_minutes ?? 0),
    notes: report.notes,
    created_at: toIsoString(report.created_at),
    expires_at: toIsoString(report.expires_at),
  };
}

function formatRouteSuggestion(suggestion: CheckpointRouteSuggestionRow) {
  return {
    id: suggestion.id,
    checkpoint_id: suggestion.checkpoint_id,
    waypoint: {
      latitude: toNumber(suggestion.waypoint_lat),
      longitude: toNumber(suggestion.waypoint_lng),
      name: suggestion.waypoint_name,
    },
    notes: suggestion.notes,
    comparison: {
      original_distance_km: suggestion.original_distance_km === null ? null : toNumber(suggestion.original_distance_km),
      original_duration_minutes: suggestion.original_duration_minutes,
      suggested_distance_km: suggestion.suggested_distance_km === null ? null : toNumber(suggestion.suggested_distance_km),
      suggested_duration_minutes: suggestion.suggested_duration_minutes,
      extra_distance_km: suggestion.extra_distance_km === null ? null : toNumber(suggestion.extra_distance_km),
      extra_time_minutes: suggestion.extra_time_minutes,
    },
    route_geometry: suggestion.route_geometry,
    created_at: toIsoString(suggestion.created_at),
    expires_at: toIsoString(suggestion.expires_at),
    status: suggestion.status,
  };
}

export async function detectCheckpointsOnRoute(
  sampledPoints: RoutePoint[],
  detectionRadiusMeters = 300
): Promise<any[]> {
  console.log("[access.detectCheckpointsOnRoute] ========== START ==========");
  console.log("[access.detectCheckpointsOnRoute] Params:", { sampledPoints: sampledPoints.length, detectionRadiusMeters });

  const locationsResult = await pool.query<DangerousLocationRow>(
    `SELECT id, name, name_ar, location_type, latitude, longitude, danger_radius_meters,
            risk_level, operating_hours, description, description_ar, is_active
     FROM dangerous_locations
     WHERE is_active = true
       AND location_type IN ('military_checkpoint', 'flying_checkpoint', 'settlement', 'outpost', 'bypass_road')`
  );

  const detected: any[] = [];

  for (const location of locationsResult.rows) {
    const locationLat = toNumber(location.latitude);
    const locationLng = toNumber(location.longitude);
    let minDistance = Number.POSITIVE_INFINITY;
    let distanceFromStartMeters = 0;

    for (const point of sampledPoints) {
      const distance = haversineMeters(point.lat, point.lng, locationLat, locationLng);
      if (distance < minDistance) {
        minDistance = distance;
        distanceFromStartMeters = point.distanceFromStartMeters ?? 0;
      }
    }

    const locationRadius = toNumber(location.danger_radius_meters) || detectionRadiusMeters;
    const effectiveRadius = Math.max(detectionRadiusMeters, locationRadius);
    if (minDistance > effectiveRadius) {
      continue;
    }

    console.log("[access.detectCheckpointsOnRoute] Danger zone detected:", {
      id: location.id,
      name: location.name,
      minDistance,
    });

    const [latestReportResult, recentReportsResult, suggestionsResult] = await Promise.all([
      pool.query<CheckpointReportRow>(
        `SELECT id, checkpoint_id, reporter_id, status, wait_minutes, notes, created_at, expires_at
         FROM checkpoint_reports
         WHERE checkpoint_id = $1::uuid
           AND expires_at > NOW()
         ORDER BY created_at DESC
         LIMIT 1`,
        [location.id]
      ),
      pool.query<CheckpointReportRow>(
        `SELECT id, checkpoint_id, reporter_id, status, wait_minutes, notes, created_at, expires_at
         FROM checkpoint_reports
         WHERE checkpoint_id = $1::uuid
           AND expires_at > NOW()
         ORDER BY created_at DESC
         LIMIT 5`,
        [location.id]
      ),
      pool.query<CheckpointRouteSuggestionRow>(
        `SELECT id, checkpoint_id, reporter_id, from_lat, from_lng, trailhead_lat, trailhead_lng,
                waypoint_lat, waypoint_lng, waypoint_name, notes, original_distance_km,
                original_duration_minutes, suggested_distance_km, suggested_duration_minutes,
                extra_distance_km, extra_time_minutes, route_geometry, created_at, expires_at, status
         FROM checkpoint_route_suggestions
         WHERE checkpoint_id = $1::uuid
           AND status = 'active'
           AND expires_at > NOW()
         ORDER BY created_at DESC
         LIMIT 3`,
        [location.id]
      ),
    ]);

    const latestReport = latestReportResult.rows[0] ?? null;
    const warning = buildWarning(location, latestReport);

    detected.push({
      id: location.id,
      name: location.name,
      name_ar: location.name_ar,
      location_type: location.location_type,
      risk_level: location.risk_level,
      distance_from_start_km: Number((distanceFromStartMeters / 1000).toFixed(1)),
      distance_from_route_meters: Math.round(minDistance),
      operating_hours: location.operating_hours,
      ...warning,
      warning: warning.warning_en,
      latest_report: latestReport
        ? {
            id: latestReport.id,
            status: latestReport.status,
            wait_minutes: Number(latestReport.wait_minutes),
            notes: latestReport.notes,
            created_at: toIsoString(latestReport.created_at),
            expires_at: toIsoString(latestReport.expires_at),
          }
        : null,
      recent_reports: recentReportsResult.rows.map(formatCheckpointReport),
      suggested_routes: suggestionsResult.rows.map(formatRouteSuggestion),
      has_suggested_routes: suggestionsResult.rows.length > 0,
      checkpoint_status: latestReport?.status ?? null,
      alternatives: suggestionsResult.rows.map((suggestion) => ({
        id: suggestion.id,
        waypoint_name: suggestion.waypoint_name,
        waypoint_lat: toNumber(suggestion.waypoint_lat),
        waypoint_lng: toNumber(suggestion.waypoint_lng),
        extra_distance_km: suggestion.extra_distance_km === null ? null : toNumber(suggestion.extra_distance_km),
        extra_time_minutes: suggestion.extra_time_minutes,
        notes: suggestion.notes,
      })),
    });
  }

  console.log("[access.detectCheckpointsOnRoute] Detected count:", detected.length);
  return detected.sort((left, right) => left.distance_from_start_km - right.distance_from_start_km);
}

function getMapboxToken(): string | undefined {
  return process.env.MAPBOX_ACCESS_TOKEN || process.env.MAPBOX_TOKEN;
}

async function fetchMapboxRoute(coordinates: [number, number][]): Promise<MapboxRoute | null> {
  const token = getMapboxToken();
  if (!token) {
    console.warn("[access.fetchMapboxRoute] Missing Mapbox token");
    return null;
  }

  const coordinatePath = coordinates.map(([lng, lat]) => `${lng},${lat}`).join(";");
  const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinatePath}?geometries=geojson&overview=full&access_token=${encodeURIComponent(token)}`;

  try {
    console.log("[access.fetchMapboxRoute] Calling Mapbox Directions");
    const response = await fetch(url);
    if (!response.ok) {
      console.warn("[access.fetchMapboxRoute] Mapbox non-OK response:", response.status);
      return null;
    }

    const body = (await response.json()) as MapboxDirectionsResponse;
    const route = body.routes?.[0] ?? null;
    console.log("[access.fetchMapboxRoute] Route found:", Boolean(route));
    return route;
  } catch (error) {
    console.error("[access.fetchMapboxRoute] Mapbox failed:", error);
    return null;
  }
}

function getFallbackDistanceMeters(coordinates: [number, number][]): number {
  let total = 0;

  for (let index = 1; index < coordinates.length; index += 1) {
    const [previousLng, previousLat] = coordinates[index - 1];
    const [currentLng, currentLat] = coordinates[index];
    total += haversineMeters(previousLat, previousLng, currentLat, currentLng);
  }

  return total;
}

function routeDistanceKm(route: MapboxRoute | null, fallbackCoordinates: [number, number][]): number {
  return Number(((route?.distance ?? getFallbackDistanceMeters(fallbackCoordinates)) / 1000).toFixed(1));
}

function routeDurationMinutes(route: MapboxRoute | null): number | null {
  return route ? Math.round(route.duration / 60) : null;
}

async function ensureCheckpointExists(checkpointId: string): Promise<boolean> {
  const checkpointResult = await pool.query<{ id: string }>(
    `SELECT id
     FROM dangerous_locations
     WHERE id = $1::uuid
       AND is_active = true
       AND location_type IN ('military_checkpoint', 'flying_checkpoint')
     LIMIT 1`,
    [checkpointId]
  );

  return Boolean(checkpointResult.rows[0]);
}

function formatTrailhead(row: AccessRouteRow) {
  const coordinate = getValidLatLng(row.trailhead_latitude, row.trailhead_longitude);
  return {
    id: row.id,
    trail_id: row.trail_id,
    latitude: coordinate?.lat ?? null,
    longitude: coordinate?.lng ?? null,
    name: row.trailhead_name,
    name_ar: row.trailhead_name_ar,
    parking_notes: row.trailhead_parking_notes,
    parking_notes_ar: row.trailhead_parking_notes_ar,
    access_notes: row.trailhead_access_notes,
    access_notes_ar: row.trailhead_access_notes_ar,
  };
}

function getAccessRiskLevel(dangerZones: any[]): AccessRiskLevel {
  if (dangerZones.some((zone) => zone.risk_level === "critical")) {
    return "dangerous";
  }

  if (dangerZones.some((zone) => zone.risk_level === "high")) {
    return "caution";
  }

  if (dangerZones.some((zone) => zone.risk_level === "medium")) {
    return "attention";
  }

  return "clear";
}

function buildSafetyTips(dangerZones: any[]): string[] {
  const tips = ["Carry your ID at all times"];

  if (dangerZones.some((zone) => zone.location_type === "military_checkpoint" || zone.location_type === "flying_checkpoint")) {
    tips.push("Allow extra 30-60 minutes for checkpoint delays");
  }

  if (dangerZones.some((zone) => Number(zone.current_wait?.wait_minutes ?? 0) > 30)) {
    tips.push("Consider using alternative route");
  }

  return tips;
}

async function getAccessRouteByTrailId(trailId: string): Promise<AccessRouteRow | null> {
  console.log("[access.getAccessRouteByTrailId] trailId:", trailId);
  const result = await pool.query<AccessRouteRow>(
    `SELECT id, trail_id, trailhead_latitude, trailhead_longitude, trailhead_name, trailhead_name_ar,
            trailhead_parking_notes, trailhead_parking_notes_ar, trailhead_access_notes,
            trailhead_access_notes_ar, created_at, updated_at
     FROM access_routes
     WHERE trail_id = $1::uuid
     LIMIT 1`,
    [trailId]
  );

  const configuredAccess = result.rows[0];
  if (configuredAccess) {
    const configuredCoordinate = getValidLatLng(configuredAccess.trailhead_latitude, configuredAccess.trailhead_longitude);
    if (configuredCoordinate) {
      return configuredAccess;
    }

    console.warn("[access.getAccessRouteByTrailId] Ignoring invalid configured access coordinates", {
      trailId,
      latitude: configuredAccess.trailhead_latitude,
      longitude: configuredAccess.trailhead_longitude,
    });
  }

  console.log("[access.getAccessRouteByTrailId] No valid access route found; falling back to first trail coordinate");
  const trailResult = await pool.query<TrailStartPointRow>(
    `SELECT id,
            ST_Y(start_point::geometry) AS start_lat,
            ST_X(start_point::geometry) AS start_lng,
            name,
            name_ar,
            ST_AsGeoJSON(geometry::geometry)::json AS geometry_geojson
     FROM trails
     WHERE id = $1::uuid
       AND deleted_at IS NULL
     LIMIT 1`,
    [trailId]
  );
  const trail = trailResult.rows[0];

  if (!trail) {
    return null;
  }

  const fallbackCoordinate = getFirstValidCoordinate(trail.geometry_geojson, "lnglat")
    ?? getValidLatLng(trail.start_lat, trail.start_lng);

  if (!fallbackCoordinate) {
    console.warn("[access.getAccessRouteByTrailId] No valid fallback coordinate found", { trailId });
    return null;
  }

  return {
    id: `trail-start:${trail.id}`,
    trail_id: trail.id,
    trailhead_latitude: fallbackCoordinate.lat,
    trailhead_longitude: fallbackCoordinate.lng,
    trailhead_name: trail.name ? `${trail.name} trailhead` : "Trailhead",
    trailhead_name_ar: trail.name_ar ?? trail.name ?? "Trailhead",
    trailhead_parking_notes: null,
    trailhead_parking_notes_ar: null,
    trailhead_access_notes: "Using the trail start point because no access route has been configured yet.",
    trailhead_access_notes_ar: null,
    created_at: new Date(),
    updated_at: new Date(),
  };
}

export async function getTrailAccess(req: Request, res: Response): Promise<void> {
  console.log("[access.getTrailAccess] ========== START ==========");
  const trailId = getRequestId(req.params.id);
  const fromLat = Number(req.query.from_lat);
  const fromLng = Number(req.query.from_lng);
  console.log("[access.getTrailAccess] Params:", { trailId, fromLat, fromLng });

  if (!isUuid(trailId)) {
    res.status(400).json({ error: "Trail id must be a valid UUID" });
    return;
  }

  if (!Number.isFinite(fromLat) || !Number.isFinite(fromLng)) {
    res.status(400).json({ error: "from_lat and from_lng are required and must be numeric" });
    return;
  }

  if (!isWestBankCoordinate(fromLat, fromLng)) {
    res.status(400).json({ error: "Starting coordinates must be within West Bank bounds" });
    return;
  }

  try {
    const accessRoute = await getAccessRouteByTrailId(trailId);
    if (!accessRoute) {
      res.json({
        data: {
          available: false,
          warning: "No valid trail access coordinates available.",
          trailhead: null,
          driving_route: {
            available: false,
            warning: "No valid trail access coordinates available.",
          },
          danger_zones: [],
          access_risk_level: "clear",
          safety_tips: buildSafetyTips([]),
        },
      });
      return;
    }

    const trailheadCoordinate = getValidLatLng(accessRoute.trailhead_latitude, accessRoute.trailhead_longitude);
    if (!trailheadCoordinate) {
      res.json({
        data: {
          available: false,
          warning: "No valid trail access coordinates available.",
          trailhead: null,
          driving_route: {
            available: false,
            warning: "No valid trail access coordinates available.",
          },
          danger_zones: [],
          access_risk_level: "clear",
          safety_tips: buildSafetyTips([]),
        },
      });
      return;
    }

    const trailheadLat = trailheadCoordinate.lat;
    const trailheadLng = trailheadCoordinate.lng;
    const mapboxRoute = await fetchMapboxRoute([[fromLng, fromLat], [trailheadLng, trailheadLat]]);
    const coordinates = mapboxRoute?.geometry.coordinates ?? [[fromLng, fromLat], [trailheadLng, trailheadLat]];
    const sampledPoints = sampleRoutePoints(coordinates, mapboxRoute ? 500 : 1000);
    const dangerZones = await detectCheckpointsOnRoute(sampledPoints);
    const accessRiskLevel = getAccessRiskLevel(dangerZones);

    const straightLineMeters = haversineMeters(fromLat, fromLng, trailheadLat, trailheadLng);
    res.json({
      data: {
        trailhead: formatTrailhead(accessRoute),
        driving_route: {
          available: Boolean(mapboxRoute),
          distance_km: Number(((mapboxRoute?.distance ?? straightLineMeters) / 1000).toFixed(1)),
          duration_minutes: mapboxRoute ? Math.round(mapboxRoute.duration / 60) : null,
          geometry: {
            type: "LineString",
            coordinates,
          },
          warning: mapboxRoute ? null : "Driving directions are currently unavailable. Showing straight-line safety warnings only.",
        },
        danger_zones: dangerZones,
        access_risk_level: accessRiskLevel,
        safety_tips: buildSafetyTips(dangerZones),
      },
    });
  } catch (error) {
    handleAccessError("getTrailAccess", res, error);
  }
}

export async function setTrailAccess(req: Request, res: Response): Promise<void> {
  console.log("[access.setTrailAccess] ========== START ==========");

  try {
    const auth = requireAuth(req);
    const trailId = getRequestId(req.params.id);
    const normalized = normalizeAccessBody(req.body);
    if (!normalized.data) {
      res.status(400).json({
        error: "Validation failed",
        details: normalized.error,
        accepted_shape: {
          latitude: 31.7767,
          longitude: 35.2345,
          name: "Main trailhead",
          parking_notes: "Parking or access notes.",
          access_notes: "Use this point as the driving destination.",
        },
      });
      return;
    }
    const body = normalized.data;
    console.log("[access.setTrailAccess] Params:", { userId: auth.sub, trailId });

    if (!isUuid(trailId)) {
      res.status(400).json({ error: "Trail id must be a valid UUID" });
      return;
    }

    const trailResult = await pool.query<{ id: string; user_id: string; is_admin: boolean }>(
      `SELECT
         t.id,
         t.user_id,
         COALESCE((to_jsonb(p)->>'is_admin')::boolean, false)
           OR COALESCE(to_jsonb(p)->>'role', '') = 'admin'
           OR COALESCE(to_jsonb(p)->>'user_role', '') = 'admin' AS is_admin
       FROM trails t
       LEFT JOIN profiles p ON p.user_id = $2::uuid OR p.id = $2::uuid
       WHERE t.id = $1::uuid
         AND t.deleted_at IS NULL
       LIMIT 1`,
      [trailId, auth.sub]
    );

    const trail = trailResult.rows[0];
    if (!trail) {
      res.status(404).json({ error: "Trail not found" });
      return;
    }

    if (trail.user_id !== auth.sub && !trail.is_admin) {
      res.status(403).json({ error: "Only the trail creator or an admin can set trail access" });
      return;
    }

    console.log("[access.setTrailAccess] Saving access route");
    const values = [
      body.trailhead_latitude,
      body.trailhead_longitude,
      body.trailhead_name,
      body.trailhead_name_ar,
      body.trailhead_parking_notes,
      body.trailhead_parking_notes_ar,
      body.trailhead_access_notes,
      body.trailhead_access_notes_ar,
      trailId,
    ];
    let result = await pool.query<AccessRouteRow>(
      `UPDATE access_routes
       SET trailhead_latitude = $1,
           trailhead_longitude = $2,
           trailhead_name = $3,
           trailhead_name_ar = $4,
           trailhead_parking_notes = $5,
           trailhead_parking_notes_ar = $6,
           trailhead_access_notes = $7,
           trailhead_access_notes_ar = $8,
           updated_at = NOW()
       WHERE trail_id = $9::uuid
       RETURNING id, trail_id, trailhead_latitude, trailhead_longitude, trailhead_name,
                 trailhead_name_ar, trailhead_parking_notes, trailhead_parking_notes_ar,
                 trailhead_access_notes, trailhead_access_notes_ar, created_at, updated_at`,
      values
    );

    let statusCode = 200;
    if (!result.rows[0]) {
      result = await pool.query<AccessRouteRow>(
        `INSERT INTO access_routes (
           trail_id,
           trailhead_latitude,
           trailhead_longitude,
           trailhead_name,
           trailhead_name_ar,
           trailhead_parking_notes,
           trailhead_parking_notes_ar,
           trailhead_access_notes,
           trailhead_access_notes_ar,
           updated_at
         )
         VALUES ($9::uuid, $1, $2, $3, $4, $5, $6, $7, $8, NOW())
         RETURNING id, trail_id, trailhead_latitude, trailhead_longitude, trailhead_name,
                   trailhead_name_ar, trailhead_parking_notes, trailhead_parking_notes_ar,
                   trailhead_access_notes, trailhead_access_notes_ar, created_at, updated_at`,
        values
      );
      statusCode = 201;
    }

    res.status(statusCode).json({ data: formatTrailhead(result.rows[0]) });
  } catch (error) {
    if (isDbConstraintError(error) && ["23502", "23503", "23505", "42P10", "42703", "42P01"].includes(error.code ?? "")) {
      console.error("[access.setTrailAccess] Database constraint/schema error:", error);
      res.status(400).json({
        error: "Could not save trail access point",
        details: "The request is valid, but the database rejected it. Check access_routes columns, foreign keys, and trail_id uniqueness if using conflict upserts.",
        code: error.code,
      });
      return;
    }

    handleAccessError("setTrailAccess", res, error);
  }
}

export async function getAlternativeRoute(req: Request, res: Response): Promise<void> {
  console.log("[access.getAlternativeRoute] ========== START ==========");
  const trailId = getRequestId(req.params.id);
  const checkpointId = typeof req.query.checkpoint_id === "string" ? req.query.checkpoint_id : "";
  const fromLat = Number(req.query.from_lat);
  const fromLng = Number(req.query.from_lng);
  console.log("[access.getAlternativeRoute] Params:", { trailId, checkpointId, fromLat, fromLng });

  if (!isUuid(trailId)) {
    res.status(400).json({ error: "Trail id must be a valid UUID" });
    return;
  }

  if (checkpointId && !isUuid(checkpointId)) {
    res.status(400).json({ error: "checkpoint_id must be a valid UUID" });
    return;
  }

  if (!checkpointId || !Number.isFinite(fromLat) || !Number.isFinite(fromLng)) {
    res.status(400).json({ error: "checkpoint_id, from_lat, and from_lng are required" });
    return;
  }

  if (!isWestBankCoordinate(fromLat, fromLng)) {
    res.status(400).json({ error: "Starting coordinates must be within West Bank bounds" });
    return;
  }

  try {
    const accessRoute = await getAccessRouteByTrailId(trailId);
    if (!accessRoute) {
      res.status(404).json({ error: "Trail access route not found" });
      return;
    }

    const alternativesResult = await pool.query<CheckpointRouteSuggestionRow>(
      `SELECT id, checkpoint_id, reporter_id, from_lat, from_lng, trailhead_lat, trailhead_lng,
              waypoint_lat, waypoint_lng, waypoint_name, notes, original_distance_km,
              original_duration_minutes, suggested_distance_km, suggested_duration_minutes,
              extra_distance_km, extra_time_minutes, route_geometry, created_at, expires_at, status
       FROM checkpoint_route_suggestions
       WHERE checkpoint_id = $1::uuid
         AND status = 'active'
         AND expires_at > NOW()
       ORDER BY created_at DESC
       LIMIT 1`,
      [checkpointId]
    );

    const alternative = alternativesResult.rows[0];
    if (!alternative) {
      res.status(404).json({ error: "No alternative route found for this checkpoint" });
      return;
    }

    const trailheadLat = toNumber(accessRoute.trailhead_latitude);
    const trailheadLng = toNumber(accessRoute.trailhead_longitude);
    const viaLat = toNumber(alternative.waypoint_lat);
    const viaLng = toNumber(alternative.waypoint_lng);
    const [directRoute, alternativeRoute] = await Promise.all([
      fetchMapboxRoute([[fromLng, fromLat], [trailheadLng, trailheadLat]]),
      fetchMapboxRoute([[fromLng, fromLat], [viaLng, viaLat], [trailheadLng, trailheadLat]]),
    ]);

    if (!alternativeRoute) {
      res.json({
        data: {
          route_available: false,
          warning: "Alternative directions are currently unavailable. Showing known waypoint only.",
          alternative: formatRouteSuggestion(alternative),
        },
      });
      return;
    }

    const directDistance = directRoute?.distance ?? 0;
    const directDuration = directRoute?.duration ?? 0;
    res.json({
      data: {
        route_available: true,
        waypoint: {
          name: alternative.waypoint_name,
          latitude: viaLat,
          longitude: viaLng,
          notes: alternative.notes,
        },
        driving_route: {
          distance_km: Number((alternativeRoute.distance / 1000).toFixed(1)),
          duration_minutes: Math.round(alternativeRoute.duration / 60),
          geometry: {
            type: "LineString",
            coordinates: alternativeRoute.geometry.coordinates,
          },
        },
        extra_distance_km: directRoute
          ? Number(((alternativeRoute.distance - directDistance) / 1000).toFixed(1))
          : alternative.extra_distance_km === null ? null : toNumber(alternative.extra_distance_km),
        extra_time_minutes: directRoute
          ? Math.round((alternativeRoute.duration - directDuration) / 60)
          : alternative.extra_time_minutes,
      },
    });
  } catch (error) {
    handleAccessError("getAlternativeRoute", res, error);
  }
}

export async function reportCheckpointWait(req: Request, res: Response): Promise<void> {
  console.log("[access.reportCheckpointWait] ========== START ==========");

  try {
    const auth = requireAuth(req);
    const checkpointId = getRequestId(req.params.checkpointId ?? req.params.id);
    const parsedBody = checkpointReportSchema.safeParse(req.body);
    console.log("[access.reportCheckpointWait] Params:", { checkpointId, userId: auth.sub });

    if (!isUuid(checkpointId)) {
      res.status(400).json({ error: "Checkpoint id must be a valid UUID" });
      return;
    }

    if (!parsedBody.success) {
      res.status(400).json({ error: "Validation failed", details: parsedBody.error.flatten() });
      return;
    }

    const checkpointResult = await pool.query<{ id: string; location_type: string; is_active: boolean }>(
      `SELECT id, location_type, is_active
       FROM dangerous_locations
       WHERE id = $1::uuid
       LIMIT 1`,
      [checkpointId]
    );
    const checkpoint = checkpointResult.rows[0];

    if (!checkpoint) {
      res.status(404).json({ error: "Checkpoint not found" });
      return;
    }

    if (!checkpoint.is_active || !["military_checkpoint", "flying_checkpoint"].includes(checkpoint.location_type)) {
      res.status(400).json({ error: "Location exists but is not reportable as a checkpoint" });
      return;
    }

    const reporterProfileId = await getProfileIdForAuthUser(auth.sub);
    if (!reporterProfileId) {
      res.status(400).json({ error: "Authenticated user profile not found" });
      return;
    }

    const body = parsedBody.data;
    console.log("[access.reportCheckpointWait] Inserting checkpoint report");
    const result = await pool.query<CheckpointReportRow>(
      `INSERT INTO checkpoint_reports (
         checkpoint_id,
         reporter_id,
         status,
         wait_minutes,
         notes,
         expires_at
       )
       VALUES ($1::uuid, $2::uuid, $3, $4, $5, NOW() + ($6::int * INTERVAL '1 minute'))
       RETURNING id, checkpoint_id, reporter_id, status, wait_minutes, notes, created_at, expires_at`,
      [
        checkpointId,
        reporterProfileId,
        body.status,
        body.wait_minutes,
        body.notes ?? null,
        body.expires_in_minutes,
      ]
    );

    res.status(201).json({ data: formatCheckpointReport(result.rows[0]) });
  } catch (error) {
    console.error("[access.reportCheckpointWait] Database/unexpected error:", error);

    if (error instanceof HttpError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }

    if (error instanceof ZodError) {
      res.status(400).json({ error: "Validation failed", details: error.flatten() });
      return;
    }

    res.status(500).json({ error: "Failed to create checkpoint report" });
  }
}

export async function getCheckpointStatus(req: Request, res: Response): Promise<void> {
  console.log("[access.getCheckpointStatus] ========== START ==========");
  const checkpointId = getRequestId(req.params.id);
  console.log("[access.getCheckpointStatus] checkpointId:", checkpointId);

  if (!isUuid(checkpointId)) {
    res.status(400).json({ error: "Checkpoint id must be a valid UUID" });
    return;
  }

  try {
    const checkpointResult = await pool.query<{ id: string }>(
      `SELECT id
       FROM dangerous_locations
       WHERE id = $1::uuid
         AND is_active = true
         AND location_type IN ('military_checkpoint', 'flying_checkpoint')
       LIMIT 1`,
      [checkpointId]
    );

    if (!checkpointResult.rows[0]) {
      res.status(404).json({ error: "Checkpoint not found" });
      return;
    }

    const [statusResult, recentReportsResult, summaryResult, suggestionsResult] = await Promise.all([
      pool.query<CheckpointReportRow>(
        `SELECT id, checkpoint_id, reporter_id, status, wait_minutes, notes, created_at, expires_at
       FROM checkpoint_reports
       WHERE checkpoint_id = $1::uuid
         AND expires_at > NOW()
       ORDER BY created_at DESC
       LIMIT 1`,
        [checkpointId]
      ),
      pool.query<CheckpointReportRow>(
        `SELECT id, checkpoint_id, reporter_id, status, wait_minutes, notes, created_at, expires_at
       FROM checkpoint_reports
       WHERE checkpoint_id = $1::uuid
         AND expires_at > NOW()
       ORDER BY created_at DESC
       LIMIT 10`,
        [checkpointId]
      ),
      pool.query<CheckpointReportSummaryRow>(
        `SELECT AVG(wait_minutes)::numeric(10,1) AS average_wait_minutes,
                COUNT(*)::int AS reports_count
       FROM checkpoint_reports
       WHERE checkpoint_id = $1::uuid
         AND expires_at > NOW()`,
        [checkpointId]
      ),
      pool.query<{ count: string | number }>(
        `SELECT COUNT(*)::int AS count
       FROM checkpoint_route_suggestions
       WHERE checkpoint_id = $1::uuid
         AND status = 'active'
         AND expires_at > NOW()`,
        [checkpointId]
      ),
    ]);

    const latestStatus = statusResult.rows[0];
    if (!latestStatus) {
      res.status(404).json({ error: "No active checkpoint status report found" });
      return;
    }

    res.json({
      data: {
        status: latestStatus.status,
        wait_minutes: Number(latestStatus.wait_minutes),
        latest_report: formatCheckpointReport(latestStatus),
        recent_reports: recentReportsResult.rows.map(formatCheckpointReport),
        average_wait_minutes: summaryResult.rows[0]?.average_wait_minutes === null ? null : toNumber(summaryResult.rows[0]?.average_wait_minutes),
        reports_count: toNumber(summaryResult.rows[0]?.reports_count),
        has_suggested_routes: toNumber(suggestionsResult.rows[0]?.count) > 0,
      },
    });
  } catch (error) {
    handleAccessError("getCheckpointStatus", res, error);
  }
}

export async function suggestCheckpointRoute(req: Request, res: Response): Promise<void> {
  console.log("[access.suggestCheckpointRoute] ========== START ==========");

  try {
    const auth = requireAuth(req);
    const checkpointId = getRequestId(req.params.id);
    const body = routeSuggestionSchema.parse(req.body);
    console.log("[access.suggestCheckpointRoute] Params:", { checkpointId, userId: auth.sub });

    if (!isUuid(checkpointId)) {
      res.status(400).json({ error: "Checkpoint id must be a valid UUID" });
      return;
    }

    if (!(await ensureCheckpointExists(checkpointId))) {
      res.status(404).json({ error: "Checkpoint not found" });
      return;
    }

    const latestReportResult = await pool.query<CheckpointReportRow>(
      `SELECT id, checkpoint_id, reporter_id, status, wait_minutes, notes, created_at, expires_at
       FROM checkpoint_reports
       WHERE checkpoint_id = $1::uuid
         AND expires_at > NOW()
       ORDER BY created_at DESC
       LIMIT 1`,
      [checkpointId]
    );
    const latestReport = latestReportResult.rows[0] ?? null;

    if (!latestReport || latestReport.status !== "closed") {
      res.status(400).json({ error: "Alternative route suggestions are only allowed when the latest checkpoint report is closed" });
      return;
    }

    const originalCoordinates: [number, number][] = [
      [body.from_lng, body.from_lat],
      [body.trailhead_lng, body.trailhead_lat],
    ];
    const suggestedFallbackCoordinates: [number, number][] = [
      [body.from_lng, body.from_lat],
      [body.waypoint_lng, body.waypoint_lat],
      [body.trailhead_lng, body.trailhead_lat],
    ];

    const [originalRoute, suggestedRoute] = await Promise.all([
      fetchMapboxRoute(originalCoordinates),
      fetchMapboxRoute(suggestedFallbackCoordinates),
    ]);

    const originalDistanceKm = routeDistanceKm(originalRoute, originalCoordinates);
    const suggestedDistanceKm = routeDistanceKm(suggestedRoute, suggestedFallbackCoordinates);
    const originalDurationMinutes = routeDurationMinutes(originalRoute);
    const suggestedDurationMinutes = routeDurationMinutes(suggestedRoute);
    const extraDistanceKm = Number((suggestedDistanceKm - originalDistanceKm).toFixed(1));
    const extraTimeMinutes =
      originalDurationMinutes !== null && suggestedDurationMinutes !== null
        ? suggestedDurationMinutes - originalDurationMinutes
        : null;
    const routeGeometry = {
      type: "LineString",
      coordinates: suggestedRoute?.geometry.coordinates ?? suggestedFallbackCoordinates,
      source: suggestedRoute ? "mapbox" : "fallback",
    };

    const result = await pool.query<CheckpointRouteSuggestionRow>(
      `INSERT INTO checkpoint_route_suggestions (
         checkpoint_id,
         reporter_id,
         from_lat,
         from_lng,
         trailhead_lat,
         trailhead_lng,
         waypoint_lat,
         waypoint_lng,
         waypoint_name,
         notes,
         original_distance_km,
         original_duration_minutes,
         suggested_distance_km,
         suggested_duration_minutes,
         extra_distance_km,
         extra_time_minutes,
         route_geometry,
         expires_at
       )
       VALUES (
         $1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9, $10,
         $11, $12, $13, $14, $15, $16, $17::jsonb, NOW() + INTERVAL '24 hours'
       )
       RETURNING id, checkpoint_id, reporter_id, from_lat, from_lng, trailhead_lat, trailhead_lng,
                 waypoint_lat, waypoint_lng, waypoint_name, notes, original_distance_km,
                 original_duration_minutes, suggested_distance_km, suggested_duration_minutes,
                 extra_distance_km, extra_time_minutes, route_geometry, created_at, expires_at, status`,
      [
        checkpointId,
        auth.sub,
        body.from_lat,
        body.from_lng,
        body.trailhead_lat,
        body.trailhead_lng,
        body.waypoint_lat,
        body.waypoint_lng,
        body.waypoint_name ?? null,
        body.notes ?? null,
        originalDistanceKm,
        originalDurationMinutes,
        suggestedDistanceKm,
        suggestedDurationMinutes,
        extraDistanceKm,
        extraTimeMinutes,
        JSON.stringify(routeGeometry),
      ]
    );

    res.status(201).json({
      data: {
        ...formatRouteSuggestion(result.rows[0]),
        route_available: Boolean(suggestedRoute),
        original_route_available: Boolean(originalRoute),
      },
    });
  } catch (error) {
    handleAccessError("suggestCheckpointRoute", res, error);
  }
}

export async function getSuggestedCheckpointRoutes(req: Request, res: Response): Promise<void> {
  console.log("[access.getSuggestedCheckpointRoutes] ========== START ==========");
  const checkpointId = getRequestId(req.params.id);

  if (!isUuid(checkpointId)) {
    res.status(400).json({ error: "Checkpoint id must be a valid UUID" });
    return;
  }

  try {
    if (!(await ensureCheckpointExists(checkpointId))) {
      res.status(404).json({ error: "Checkpoint not found" });
      return;
    }

    const result = await pool.query<CheckpointRouteSuggestionRow>(
      `SELECT id, checkpoint_id, reporter_id, from_lat, from_lng, trailhead_lat, trailhead_lng,
              waypoint_lat, waypoint_lng, waypoint_name, notes, original_distance_km,
              original_duration_minutes, suggested_distance_km, suggested_duration_minutes,
              extra_distance_km, extra_time_minutes, route_geometry, created_at, expires_at, status
       FROM checkpoint_route_suggestions
       WHERE checkpoint_id = $1::uuid
         AND status = 'active'
         AND expires_at > NOW()
       ORDER BY created_at DESC`,
      [checkpointId]
    );

    res.json({ data: result.rows.map(formatRouteSuggestion) });
  } catch (error) {
    handleAccessError("getSuggestedCheckpointRoutes", res, error);
  }
}

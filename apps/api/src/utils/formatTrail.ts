import type { Difficulty } from "@traces/shared-types";

interface TrailRecord {
  id: string;
  slug?: string | null;
  name?: string | null;
  name_ar?: string | null;
  region?: string | null;
  region_ar?: string | null;
  description?: string | null;
  description_ar?: string | null;
  length_meters?: number | string | null;
  length_km?: number | string | null;
  estimated_duration_minutes?: number | string | null;
  estimated_duration_min?: number | string | null;
  elevation_gain_meters?: number | string | null;
  elevation_gain_m?: number | string | null;
  elevation_min?: number | string | null;
  elevation_max?: number | string | null;
  elevation_loss_m?: number | string | null;
  difficulty?: string | null;
  rating?: number | string | null;
  reviews?: number | string | null;
  image?: string | null;
  hero_image_url?: string | null;
  images?: unknown;
  features?: unknown;
  features_ar?: unknown;
  has_checkpoint?: boolean | null;
  checkpoint_note?: string | null;
  is_featured?: boolean | null;
  geometry_text?: string | null;
  geometry?: string | null;
  start_lng?: number | string | null;
  start_lat?: number | string | null;
  start_point_text?: string | null;
  end_point_text?: string | null;
  tags?: unknown;
  created_at?: string | Date | null;
  updated_at?: string | Date | null;
}

function normalizeDifficulty(value: string | null | undefined): Difficulty {
  switch ((value ?? "").toLowerCase()) {
    case "moderate":
      return "moderate";
    case "hard":
      return "hard";
    case "expert":
      return "expert";
    default:
      return "easy";
  }
}

function toNumber(value: number | string | null | undefined, fallback = 0): number {
  if (value == null) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parsePointText(pointText: string | null | undefined): { lat: number; lng: number } | null {
  if (!pointText) {
    return null;
  }

  const match = pointText.match(/POINT\s*\(([^)]+)\)/i);
  const rawPoint = match?.[1] ?? pointText;
  const [lng, lat] = rawPoint.trim().split(/\s+/).map(Number);

  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return { lat, lng };
  }

  return null;
}

function parseGeometryPoints(geometry: string | null | undefined): Array<{ lat: number; lng: number }> {
  if (!geometry) {
    return [];
  }

  const linestringMatch = geometry.match(/LINESTRING\s*\(([^)]+)\)/i);
  if (linestringMatch?.[1]) {
    return linestringMatch[1]
      .split(",")
      .map((pair) => pair.trim().split(/\s+/).map(Number))
      .filter(([lng, lat]) => Number.isFinite(lat) && Number.isFinite(lng))
      .map(([lng, lat]) => ({ lat, lng }));
  }

  const point = parsePointText(geometry);
  return point ? [point] : [];
}

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function toIsoString(value: string | Date | null | undefined): string {
  if (!value) {
    return new Date(0).toISOString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date(0).toISOString() : parsed.toISOString();
}

export function formatTrailForApp(dbTrail: TrailRecord) {
  const lengthKm = dbTrail.length_meters != null
    ? toNumber(dbTrail.length_meters) / 1000
    : toNumber(dbTrail.length_km);

  const estimatedDurationMin = dbTrail.estimated_duration_minutes != null
    ? Math.round(toNumber(dbTrail.estimated_duration_minutes))
    : Math.round(toNumber(dbTrail.estimated_duration_min));

  const elevationGainM = dbTrail.elevation_gain_meters != null
    ? toNumber(dbTrail.elevation_gain_meters)
    : toNumber(dbTrail.elevation_gain_m);

  const geometry = parseGeometryPoints(dbTrail.geometry_text ?? dbTrail.geometry);
  const fallbackStartPoint = parsePointText(dbTrail.start_point_text) ?? { lat: toNumber(dbTrail.start_lat), lng: toNumber(dbTrail.start_lng) };
  const fallbackEndPoint = parsePointText(dbTrail.end_point_text) ?? geometry[geometry.length - 1] ?? fallbackStartPoint;
  const startPoint = geometry[0] ?? fallbackStartPoint;
  const endPoint = geometry[geometry.length - 1] ?? fallbackEndPoint;

  return {
    id: dbTrail.id,
    slug: dbTrail.slug ?? dbTrail.id,
    name: dbTrail.name ?? "",
    nameAr: dbTrail.name_ar ?? "",
    description: dbTrail.description ?? "",
    region: dbTrail.region ?? "",
    difficulty: normalizeDifficulty(dbTrail.difficulty),
    lengthKm,
    estimatedDurationMin,
    elevationGainM,
    elevationLossM: toNumber(dbTrail.elevation_loss_m),
    startPoint,
    endPoint,
    geometry,
    tags: normalizeStringArray(dbTrail.tags),
    heroImageUrl: dbTrail.image ?? dbTrail.hero_image_url ?? undefined,
    isFeatured: Boolean(dbTrail.is_featured ?? false),
    createdAt: toIsoString(dbTrail.created_at),
    updatedAt: toIsoString(dbTrail.updated_at),
  };
}

import type { Difficulty } from "@traces/shared-types";
import { formatDuration } from "./formatDuration";

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
  estimated_duration_minutes?: number | string | null;
  elevation_gain_meters?: number | string | null;
  elevation_min?: number | string | null;
  elevation_max?: number | string | null;
  difficulty?: string | null;
  average_rating?: number | string | null;
  total_reviews?: number | string | null;
  rating?: number | string | null;
  reviews?: number | string | null;
  image?: string | null;
  images?: unknown;
  features?: unknown;
  features_ar?: unknown;
  has_checkpoint?: boolean | null;
  checkpoint_note?: string | null;
  geometry_text?: string | null;
  geometry?: string | null;
  start_lng?: number | string | null;
  start_lat?: number | string | null;
  start_point_text?: string | null;
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

function parsePointText(pointText: string | null | undefined): [number, number] | null {
  if (!pointText) {
    return null;
  }

  const match = pointText.match(/POINT\s*\(([^)]+)\)/i);
  const rawPoint = match?.[1] ?? pointText;
  const [lng, lat] = rawPoint.trim().split(/\s+/).map(Number);

  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return [lat, lng];
  }

  return null;
}

export function extractFullGeometry(geometry: string | null | undefined): Array<[number, number]> {
  if (!geometry) {
    return [];
  }

  const linestringMatch = geometry.match(/LINESTRING\s*\(([^)]+)\)/i);
  if (linestringMatch?.[1]) {
    return linestringMatch[1]
      .split(",")
      .map((pair) => pair.trim().split(/\s+/).map(Number))
      .filter(([lng, lat]) => Number.isFinite(lat) && Number.isFinite(lng))
      .map(([lng, lat]) => [lat, lng] as [number, number]);
  }

  const point = parsePointText(geometry);
  return point ? [point] : [];
}

function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
    } catch {
      return [];
    }
  }

  return [];
}

function normalizeUnknownArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) {
    return value as T[];
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? parsed as T[] : [];
    } catch {
      return [];
    }
  }

  return [];
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
  const distanceMeters = toNumber(dbTrail.length_meters);
  const distance = Number((distanceMeters / 1000).toFixed(2));
  const durationMinutes = Math.round(toNumber(dbTrail.estimated_duration_minutes));
  const routeCoordinates = extractFullGeometry(dbTrail.geometry_text ?? dbTrail.geometry);
  const fallbackCoordinates = parsePointText(dbTrail.start_point_text) ?? [toNumber(dbTrail.start_lat), toNumber(dbTrail.start_lng)] as [number, number];
  const coordinates = routeCoordinates[0] ?? fallbackCoordinates;

  return {
    id: dbTrail.id,
    slug: dbTrail.slug ?? dbTrail.id,
    name: dbTrail.name ?? "",
    nameAr: dbTrail.name_ar ?? "",
    description: dbTrail.description ?? "",
    descriptionAr: dbTrail.description_ar ?? "",
    region: dbTrail.region ?? "",
    regionAr: dbTrail.region_ar ?? "",
    distance,
    duration: formatDuration(durationMinutes),
    elevationGain: toNumber(dbTrail.elevation_gain_meters),
    elevationMin: toNumber(dbTrail.elevation_min),
    elevationMax: toNumber(dbTrail.elevation_max),
    difficulty: normalizeDifficulty(dbTrail.difficulty),
    rating: toNumber(dbTrail.average_rating, toNumber(dbTrail.rating)),
    reviews: Math.round(toNumber(dbTrail.total_reviews, toNumber(dbTrail.reviews))),
    image: dbTrail.image ?? "",
    images: normalizeUnknownArray<string>(dbTrail.images),
    features: normalizeUnknownArray<string>(dbTrail.features),
    featuresAr: normalizeUnknownArray<string>(dbTrail.features_ar),
    hasCheckpoint: Boolean(dbTrail.has_checkpoint),
    checkpointNote: dbTrail.checkpoint_note ?? "",
    tags: normalizeStringArray(dbTrail.tags),
    coordinates,
    routeCoordinates,
    mapX: 0,
    mapY: 0,
    createdAt: toIsoString(dbTrail.created_at),
    updatedAt: toIsoString(dbTrail.updated_at),
  };
}

import type { Difficulty } from "@traces/shared-types";
import { formatDuration } from "./formatDuration";

interface TrailRecord {
  id: string;
  name?: string | null;
  name_ar?: string | null;
  region?: string | null;
  region_ar?: string | null;
  description?: string | null;
  description_ar?: string | null;
  length_km?: number | string | null;
  length_meters?: number | string | null;
  estimated_duration_min?: number | string | null;
  elevation_gain_m?: number | string | null;
  elevation_min_m?: number | string | null;
  elevation_max_m?: number | string | null;
  difficulty?: string | null;
  rating?: number | string | null;
  reviews?: number | string | null;
  hero_image_url?: string | null;
  images?: unknown;
  features?: unknown;
  features_ar?: unknown;
  has_checkpoint?: boolean | null;
  checkpoint_note?: string | null;
  geometry_text?: string | null;
  geometry?: string | null;
  start_lng?: number | string | null;
  start_lat?: number | string | null;
  tags?: unknown;
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

function parseFirstPointFromGeometry(geometry: string | null | undefined): [number, number] {
  if (!geometry) {
    return [0, 0];
  }

  const linestringMatch = geometry.match(/LINESTRING\s*\(([^)]+)\)/i);
  const pointMatch = geometry.match(/POINT\s*\(([^)]+)\)/i);
  const pointText = linestringMatch?.[1] ?? pointMatch?.[1];

  if (!pointText) {
    return [0, 0];
  }

  const firstPair = pointText.split(",")[0].trim().split(/\s+/);
  const [lng, lat] = firstPair.map(Number);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return [lat, lng];
  }

  return [0, 0];
}

export function formatTrailForApp(dbTrail: TrailRecord) {
  const distance = dbTrail.length_km != null
    ? Number(dbTrail.length_km)
    : dbTrail.length_meters != null
    ? Number(dbTrail.length_meters) / 1000
    : 0;

  const coordinates = parseFirstPointFromGeometry(dbTrail.geometry_text ?? dbTrail.geometry);

  return {
    id: dbTrail.id,
    name: dbTrail.name ?? "",
    nameAr: dbTrail.name_ar ?? "",
    region: dbTrail.region ?? "",
    regionAr: dbTrail.region_ar ?? "",
    description: dbTrail.description ?? "",
    descriptionAr: dbTrail.description_ar ?? "",
    distance,
    duration: formatDuration(Number(dbTrail.estimated_duration_min ?? 0)),
    elevationGain: Number(dbTrail.elevation_gain_m ?? 0),
    elevationMin: Number(dbTrail.elevation_min_m ?? 0),
    elevationMax: Number(dbTrail.elevation_max_m ?? 0),
    difficulty: normalizeDifficulty(dbTrail.difficulty),
    rating: Number(dbTrail.rating ?? 0),
    reviews: Number(dbTrail.reviews ?? 0),
    image: dbTrail.hero_image_url ?? "",
    images: Array.isArray(dbTrail.images) ? dbTrail.images.filter((item): item is string => typeof item === "string") : [],
    features: Array.isArray(dbTrail.features) ? dbTrail.features.filter((item): item is string => typeof item === "string") : [],
    featuresAr: Array.isArray(dbTrail.features_ar) ? dbTrail.features_ar.filter((item): item is string => typeof item === "string") : [],
    hasCheckpoint: Boolean(dbTrail.has_checkpoint ?? false),
    checkpointNote: dbTrail.checkpoint_note ?? "",
    coordinates,
    mapX: Number(dbTrail.start_lng ?? 0),
    mapY: Number(dbTrail.start_lat ?? 0),
    tags: Array.isArray(dbTrail.tags) ? dbTrail.tags.filter((item): item is string => typeof item === "string") : [],
  };
}

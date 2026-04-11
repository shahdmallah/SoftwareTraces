import { formatDuration } from "./formatDuration";

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

export function formatTrailForApp(dbTrail: any) {
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
    difficulty: dbTrail.difficulty ?? "",
    rating: Number(dbTrail.rating ?? 0),
    reviews: Number(dbTrail.reviews ?? 0),
    image: dbTrail.hero_image_url ?? "",
    images: Array.isArray(dbTrail.images) ? dbTrail.images : [],
    features: Array.isArray(dbTrail.features) ? dbTrail.features : [],
    featuresAr: Array.isArray(dbTrail.features_ar) ? dbTrail.features_ar : [],
    hasCheckpoint: Boolean(dbTrail.has_checkpoint ?? false),
    checkpointNote: dbTrail.checkpoint_note ?? "",
    coordinates,
    mapX: dbTrail.start_lng ?? 0,
    mapY: dbTrail.start_lat ?? 0,
    tags: Array.isArray(dbTrail.tags) ? dbTrail.tags : [],
  };
}

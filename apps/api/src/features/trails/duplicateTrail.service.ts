import { pool } from "../../db/pool";

type CoordinatePair = [number, number];

interface Point {
  lng: number;
  lat: number;
}

interface BoundingBox {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}

interface SimilarTrailCandidateRow {
  id: string;
  name: string;
  length_meters: string | number | null;
  start_distance_meters: string | number | null;
  end_distance_meters: string | number | null;
  bbox_min_lng: string | number | null;
  bbox_min_lat: string | number | null;
  bbox_max_lng: string | number | null;
  bbox_max_lat: string | number | null;
}

export interface DuplicateTrailCheckInput {
  name?: string;
  coordinates: CoordinatePair[];
  distance?: number | null;
  visibility?: string | null;
}

export interface DuplicateTrailMatch {
  trail_id: string;
  name: string;
  similarity_score: number;
  reason: string;
  reasons: string[];
  start_distance_meters: number | null;
  end_distance_meters: number | null;
  length_difference_percent: number | null;
  bounding_box_overlap_percent: number | null;
  name_similarity: number | null;
}

export interface DuplicateTrailWarning {
  has_similar_trails: boolean;
  message: string | null;
  matches: DuplicateTrailMatch[];
}

const START_END_WARNING_METERS = 300;
const LENGTH_WARNING_RATIO = 0.2;
const STRONG_BBOX_OVERLAP_RATIO = 0.65;
const HIGH_NAME_SIMILARITY = 0.72;

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeDistanceMeters(value: unknown): number | null {
  const distance = toNumber(value);

  if (distance === null || distance <= 0) {
    return null;
  }

  return distance < 1000 ? distance * 1000 : distance;
}

function isValidLngLat(point: Point): boolean {
  return (
    Number.isFinite(point.lng) &&
    Number.isFinite(point.lat) &&
    point.lng >= -180 &&
    point.lng <= 180 &&
    point.lat >= -90 &&
    point.lat <= 90 &&
    !(point.lng === 0 && point.lat === 0)
  );
}

function normalizeCoordinate([first, second]: CoordinatePair): Point | null {
  if (!Number.isFinite(first) || !Number.isFinite(second)) {
    return null;
  }

  const looksLikePalestineLatLng = first >= 29 && first <= 34 && second >= 34 && second <= 36;
  const looksLikePalestineLngLat = first >= 34 && first <= 36 && second >= 29 && second <= 34;
  const firstCanBeLngLat = Math.abs(first) <= 180 && Math.abs(second) <= 90;
  const firstCanBeLatLng = Math.abs(first) <= 90 && Math.abs(second) <= 180;

  if (looksLikePalestineLatLng) {
    return { lng: second, lat: first };
  }

  if (looksLikePalestineLngLat || firstCanBeLngLat) {
    return { lng: first, lat: second };
  }

  if (firstCanBeLatLng) {
    return { lng: second, lat: first };
  }

  return null;
}

function normalizeCoordinates(coordinates: CoordinatePair[]): Point[] {
  return coordinates
    .map(normalizeCoordinate)
    .filter((point): point is Point => point !== null && isValidLngLat(point));
}

function buildLineString(points: Point[]): string {
  return `LINESTRING(${points.map((point) => `${point.lng} ${point.lat}`).join(", ")})`;
}

function getBoundingBox(points: Point[]): BoundingBox {
  return points.reduce(
    (box, point) => ({
      minLng: Math.min(box.minLng, point.lng),
      minLat: Math.min(box.minLat, point.lat),
      maxLng: Math.max(box.maxLng, point.lng),
      maxLat: Math.max(box.maxLat, point.lat),
    }),
    {
      minLng: Number.POSITIVE_INFINITY,
      minLat: Number.POSITIVE_INFINITY,
      maxLng: Number.NEGATIVE_INFINITY,
      maxLat: Number.NEGATIVE_INFINITY,
    }
  );
}

function getBoxArea(box: BoundingBox): number {
  return Math.max(0, box.maxLng - box.minLng) * Math.max(0, box.maxLat - box.minLat);
}

function calculateBoxOverlap(left: BoundingBox, right: BoundingBox): number | null {
  const overlapLng = Math.max(0, Math.min(left.maxLng, right.maxLng) - Math.max(left.minLng, right.minLng));
  const overlapLat = Math.max(0, Math.min(left.maxLat, right.maxLat) - Math.max(left.minLat, right.minLat));
  const overlapArea = overlapLng * overlapLat;
  const smallestArea = Math.min(getBoxArea(left), getBoxArea(right));

  if (smallestArea <= 0) {
    return null;
  }

  return overlapArea / smallestArea;
}

function normalizeName(value: string | undefined): string[] {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06ff\s]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function calculateNameSimilarity(left: string | undefined, right: string | undefined): number | null {
  const leftTokens = new Set(normalizeName(left));
  const rightTokens = new Set(normalizeName(right));

  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return null;
  }

  let intersection = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      intersection += 1;
    }
  }

  const union = new Set([...leftTokens, ...rightTokens]).size;
  return union > 0 ? intersection / union : null;
}

function formatMeters(value: number): string {
  return `${Math.round(value)}m`;
}

function calculateSimilarityScore(params: {
  startDistance: number | null;
  endDistance: number | null;
  lengthDifferenceRatio: number | null;
  bboxOverlapRatio: number | null;
  nameSimilarity: number | null;
}): number {
  const startScore = params.startDistance === null ? 0 : Math.max(0, 1 - params.startDistance / 1000) * 0.28;
  const endScore = params.endDistance === null ? 0 : Math.max(0, 1 - params.endDistance / 1000) * 0.28;
  const lengthScore = params.lengthDifferenceRatio === null ? 0 : Math.max(0, 1 - params.lengthDifferenceRatio) * 0.24;
  const bboxScore = (params.bboxOverlapRatio ?? 0) * 0.14;
  const nameScore = (params.nameSimilarity ?? 0) * 0.06;

  return Number(Math.min(1, startScore + endScore + lengthScore + bboxScore + nameScore).toFixed(2));
}

function buildMatch(
  input: DuplicateTrailCheckInput,
  inputBox: BoundingBox,
  row: SimilarTrailCandidateRow
): DuplicateTrailMatch | null {
  const startDistance = toNumber(row.start_distance_meters);
  const endDistance = toNumber(row.end_distance_meters);
  const existingLength = normalizeDistanceMeters(row.length_meters);
  const inputLength = normalizeDistanceMeters(input.distance);
  const lengthDifferenceRatio = inputLength && inputLength > 0 && existingLength && existingLength > 0
    ? Math.abs(existingLength - inputLength) / inputLength
    : null;
  const candidateBoxValues = {
    minLng: toNumber(row.bbox_min_lng),
    minLat: toNumber(row.bbox_min_lat),
    maxLng: toNumber(row.bbox_max_lng),
    maxLat: toNumber(row.bbox_max_lat),
  };
  const candidateBox = Object.values(candidateBoxValues).every((value) => value !== null)
    ? {
        minLng: candidateBoxValues.minLng,
        minLat: candidateBoxValues.minLat,
        maxLng: candidateBoxValues.maxLng,
        maxLat: candidateBoxValues.maxLat,
      } as BoundingBox
    : null;
  const bboxOverlapRatio = candidateBox ? calculateBoxOverlap(inputBox, candidateBox) : null;
  const nameSimilarity = calculateNameSimilarity(input.name, row.name);
  const startEndLengthMatch =
    startDistance !== null &&
    endDistance !== null &&
    lengthDifferenceRatio !== null &&
    startDistance <= START_END_WARNING_METERS &&
    endDistance <= START_END_WARNING_METERS &&
    lengthDifferenceRatio <= LENGTH_WARNING_RATIO;
  const bboxNameMatch =
    bboxOverlapRatio !== null &&
    nameSimilarity !== null &&
    bboxOverlapRatio >= STRONG_BBOX_OVERLAP_RATIO &&
    nameSimilarity >= HIGH_NAME_SIMILARITY;

  if (!startEndLengthMatch && !bboxNameMatch) {
    return null;
  }

  const reasons: string[] = [];

  if (startDistance !== null) {
    reasons.push(`Start point is ${formatMeters(startDistance)} away`);
  }

  if (endDistance !== null) {
    reasons.push(`End point is ${formatMeters(endDistance)} away`);
  }

  if (lengthDifferenceRatio !== null) {
    reasons.push(`Trail length differs by ${Math.round(lengthDifferenceRatio * 100)}%`);
  }

  if (bboxOverlapRatio !== null && bboxOverlapRatio > 0) {
    reasons.push(`Bounding boxes overlap by ${Math.round(bboxOverlapRatio * 100)}%`);
  }

  if (nameSimilarity !== null && nameSimilarity > 0) {
    reasons.push(`Name similarity is ${Math.round(nameSimilarity * 100)}%`);
  }

  const similarityScore = calculateSimilarityScore({
    startDistance,
    endDistance,
    lengthDifferenceRatio,
    bboxOverlapRatio,
    nameSimilarity,
  });

  return {
    trail_id: row.id,
    name: row.name,
    similarity_score: similarityScore,
    reason: startEndLengthMatch
      ? "Nearby start/end points with similar trail length"
      : "Strong bounding box overlap with a similar trail name",
    reasons,
    start_distance_meters: startDistance === null ? null : Math.round(startDistance),
    end_distance_meters: endDistance === null ? null : Math.round(endDistance),
    length_difference_percent: lengthDifferenceRatio === null ? null : Math.round(lengthDifferenceRatio * 100),
    bounding_box_overlap_percent: bboxOverlapRatio === null ? null : Math.round(bboxOverlapRatio * 100),
    name_similarity: nameSimilarity === null ? null : Number(nameSimilarity.toFixed(2)),
  };
}

export async function findSimilarPublicTrails(input: DuplicateTrailCheckInput): Promise<DuplicateTrailWarning> {
  if (input.visibility && input.visibility !== "public") {
    return { has_similar_trails: false, message: null, matches: [] };
  }

  const points = normalizeCoordinates(input.coordinates);

  if (points.length < 2) {
    return { has_similar_trails: false, message: null, matches: [] };
  }

  const start = points[0];
  const end = points[points.length - 1];
  const lineString = buildLineString(points);
  const inputBox = getBoundingBox(points);
  const result = await pool.query<SimilarTrailCandidateRow>(
    `WITH input AS (
       SELECT
         ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography AS start_point,
         ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography AS end_point,
         ST_GeomFromText($5, 4326) AS geometry
     )
     SELECT
       t.id,
       t.name,
       t.length_meters,
       ST_Distance(t.start_point, input.start_point) AS start_distance_meters,
       ST_Distance(t.end_point, input.end_point) AS end_distance_meters,
       ST_XMin(ST_Envelope(t.geometry::geometry)) AS bbox_min_lng,
       ST_YMin(ST_Envelope(t.geometry::geometry)) AS bbox_min_lat,
       ST_XMax(ST_Envelope(t.geometry::geometry)) AS bbox_max_lng,
       ST_YMax(ST_Envelope(t.geometry::geometry)) AS bbox_max_lat
     FROM trails t
     CROSS JOIN input
     WHERE t.deleted_at IS NULL
       AND COALESCE(t.is_active, true) = true
       AND COALESCE(t.status, 'published') = 'published'
       AND (
         ST_DWithin(t.start_point, input.start_point, 5000)
         OR ST_DWithin(t.end_point, input.end_point, 5000)
         OR t.geometry::geometry && ST_Expand(input.geometry, 0.05)
         OR ($6::text <> '' AND t.name ILIKE '%' || $6::text || '%')
       )
     ORDER BY LEAST(
       ST_Distance(t.start_point, input.start_point),
       ST_Distance(t.end_point, input.end_point)
     ) ASC
     LIMIT 80`,
    [start.lng, start.lat, end.lng, end.lat, lineString, input.name?.trim() ?? ""]
  );

  const matches = result.rows
    .map((row) => buildMatch(input, inputBox, row))
    .filter((match): match is DuplicateTrailMatch => match !== null)
    .sort((left, right) => right.similarity_score - left.similarity_score)
    .slice(0, 3);

  return {
    has_similar_trails: matches.length > 0,
    message: matches.length > 0 ? "Similar public trail detected. This route may already exist publicly." : null,
    matches,
  };
}

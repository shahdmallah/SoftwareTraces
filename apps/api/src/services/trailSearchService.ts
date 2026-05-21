import { pool } from "../db/pool";

export type TrailDifficulty = "easy" | "moderate" | "hard" | "expert";

export interface TrailSearchCriteria {
  length_km: number | null;
  difficulty: TrailDifficulty | null;
  region: string | null;
  labels: string[];
}

export interface MatchingTrail {
  id: string;
  name: string;
  region: string;
  match_score: number;
  distance_km: number;
  difficulty: TrailDifficulty;
  labels: string[];
}

interface TrailSearchRow {
  id: string;
  name: string;
  region: string;
  difficulty: string;
  length_meters: string | number | null;
  tags: string[] | null;
  features: string[] | null;
}

function normalizeNumber(value: string | number | null): number {
  if (value == null) {
    return 0;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeDifficulty(value: string): TrailDifficulty {
  if (value === "moderate" || value === "hard" || value === "expert") {
    return value;
  }

  return "easy";
}

function uniqueLabels(tags: string[] | null, features: string[] | null): string[] {
  return Array.from(new Set([...(tags ?? []), ...(features ?? [])]));
}

function calculateMatchScore(row: TrailSearchRow, criteria: TrailSearchCriteria): number {
  let score = 0;
  let possibleScore = 0;
  const rowLabels = uniqueLabels(row.tags, row.features);
  const rowLengthKm = normalizeNumber(row.length_meters) / 1000;

  if (criteria.difficulty) {
    possibleScore += 30;
    if (row.difficulty.toLowerCase() === criteria.difficulty) {
      score += 30;
    }
  }

  if (criteria.region) {
    possibleScore += 25;
    if (row.region.toLowerCase().includes(criteria.region.toLowerCase())) {
      score += 25;
    }
  }

  if (criteria.length_km && rowLengthKm > 0) {
    possibleScore += 25;
    const differenceRatio = Math.abs(rowLengthKm - criteria.length_km) / criteria.length_km;
    if (differenceRatio <= 0.2) {
      score += 25;
    } else if (differenceRatio <= 0.4) {
      score += 12;
    }
  }

  if (criteria.labels.length > 0) {
    possibleScore += 20;
    const matchingLabels = criteria.labels.filter((label) => rowLabels.includes(label));
    score += Math.round((matchingLabels.length / criteria.labels.length) * 20);
  }

  return possibleScore > 0 ? Math.round((score / possibleScore) * 100) : 0;
}

export async function searchTrailsByCriteria(criteria: TrailSearchCriteria): Promise<MatchingTrail[]> {
  const minLengthKm = criteria.length_km ? criteria.length_km * 0.8 : null;
  const maxLengthKm = criteria.length_km ? criteria.length_km * 1.2 : null;

  const result = await pool.query<TrailSearchRow>(
    `SELECT
       id,
       name,
       region,
       difficulty,
       length_meters,
       tags,
       features
     FROM trails
     WHERE deleted_at IS NULL
       AND is_active = TRUE
       AND status = 'published'
       AND ($1::TEXT IS NULL OR difficulty = $1)
       AND ($2::TEXT IS NULL OR region ILIKE '%' || $2 || '%')
       AND (
         $3::NUMERIC IS NULL
         OR length_meters / 1000.0 BETWEEN $3 AND $4
       )
       AND (
         COALESCE(array_length($5::TEXT[], 1), 0) = 0
         OR tags && $5::TEXT[]
         OR features && $5::TEXT[]
       )
     ORDER BY average_rating DESC, total_reviews DESC, name ASC
     LIMIT 20`,
    [criteria.difficulty, criteria.region, minLengthKm, maxLengthKm, criteria.labels]
  );

  return result.rows
    .map((row) => {
      const lengthMeters = normalizeNumber(row.length_meters);
      const distanceKm = lengthMeters / 1000;

      return {
        id: row.id,
        name: row.name,
        region: row.region,
        match_score: calculateMatchScore(row, criteria),
        distance_km: Number(distanceKm.toFixed(1)),
        difficulty: normalizeDifficulty(row.difficulty.toLowerCase()),
        labels: uniqueLabels(row.tags, row.features),
      };
    })
    .filter((trail) => trail.match_score >= 45)
    .sort((left, right) => right.match_score - left.match_score)
    .slice(0, 5);
}

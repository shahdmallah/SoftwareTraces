import type { Difficulty } from "@traces/shared-types";
import { calculateElevationGain, getElevationForPoints } from "../../services/elevationService";
import { totalDistance } from "../../utils/distance";
import { pool } from "../../db/pool";

export interface TrailStats {
  length_meters: number;
  elevation_gain_meters: number;
  estimated_duration_minutes: number;
  difficulty: Difficulty;
}

export interface TrailReviewStats {
  average_rating: number;
  total_reviews: number;
  rating: number;
  reviews: number;
}

interface Queryable {
  query<T = unknown>(text: string, params?: unknown[]): Promise<{ rows: T[] }>;
}

function estimateDurationMinutes(distanceKm: number, elevationGainMeters: number): number {
  const distanceMinutes = (distanceKm / 5) * 60;
  const climbingMinutes = (elevationGainMeters / 600) * 60;
  return distanceMinutes + climbingMinutes;
}

function classifyDifficulty(distanceKm: number, elevationGainMeters: number): Difficulty {
  if (distanceKm >= 16 || elevationGainMeters >= 1000) {
    return "expert";
  }

  if (distanceKm >= 10 || elevationGainMeters >= 600) {
    return "hard";
  }

  if (distanceKm >= 5 || elevationGainMeters >= 250) {
    return "moderate";
  }

  return "easy";
}

export async function calculateTrailStats(coordinates: [number, number][]): Promise<TrailStats> {
  const length_meters = totalDistance(coordinates);
  const distance_km = length_meters / 1000;
  let elevation_gain_meters = 0;

  try {
    const elevationPoints = await getElevationForPoints(coordinates);
    console.log("[trails] Elevation points returned to trail stats:", elevationPoints);
    elevation_gain_meters = calculateElevationGain(elevationPoints);
    console.log("[trails] Calculated elevation gain:", elevation_gain_meters);
  } catch (error) {
    console.warn(
      "[trails] Falling back to zero elevation gain because Mapbox elevation lookup failed:",
      error instanceof Error ? error.message : String(error)
    );
  }

  const estimated_duration_minutes = estimateDurationMinutes(distance_km, elevation_gain_meters);
  const difficulty = classifyDifficulty(distance_km, elevation_gain_meters);

  console.log("[trails] Final calculated trail stats:", {
    length_meters,
    elevation_gain_meters,
    estimated_duration_minutes,
    difficulty
  });

  return {
    length_meters,
    elevation_gain_meters,
    estimated_duration_minutes,
    difficulty,
  };
}

export async function recalculateTrailReviewStats(trailId: string, db: Queryable = pool): Promise<TrailReviewStats> {
  const result = await db.query<TrailReviewStats>(
    `
    WITH review_stats AS (
      SELECT
        COALESCE(ROUND(AVG(rating)::numeric, 2), 0) AS average_rating,
        COUNT(*)::int AS total_reviews
      FROM trail_reviews
      WHERE trail_id = $1
    )
    UPDATE trails
    SET
      average_rating = review_stats.average_rating,
      total_reviews = review_stats.total_reviews,
      rating = review_stats.average_rating,
      reviews = review_stats.total_reviews,
      updated_at = NOW()
    FROM review_stats
    WHERE trails.id = $1
    RETURNING
      average_rating::float AS average_rating,
      total_reviews,
      rating::float AS rating,
      reviews
    `,
    [trailId]
  );

  const stats = result.rows[0];

  if (!stats) {
    throw new Error("Trail not found");
  }

  return {
    average_rating: Number(stats.average_rating),
    total_reviews: Number(stats.total_reviews),
    rating: Number(stats.rating),
    reviews: Number(stats.reviews),
  };
}

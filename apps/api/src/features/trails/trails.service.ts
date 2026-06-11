import type { Difficulty } from "@traces/shared-types";
import { calculateElevationGain, getElevationForPoints } from "../../services/elevationService";
import { classifyDifficulty } from "../../utils/trailDifficulty";
import { totalDistance } from "../../utils/distance";

export interface TrailStats {
  length_meters: number;
  elevation_gain_meters: number;
  estimated_duration_minutes: number;
  difficulty: Difficulty;
}

function estimateDurationMinutes(distanceKm: number, elevationGainMeters: number): number {
  const distanceMinutes = (distanceKm / 5) * 60;
  const climbingMinutes = (elevationGainMeters / 600) * 60;
  return distanceMinutes + climbingMinutes;
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

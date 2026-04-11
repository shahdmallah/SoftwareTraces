import type { Difficulty } from "@traces/shared-types";
import { totalDistance } from "../../utils/distance";

export interface TrailStats {
  length_meters: number;
  elevation_gain_meters: number;
  estimated_duration_minutes: number;
  difficulty: Difficulty;
}

export function calculateTrailStats(coordinates: [number, number][]): TrailStats {
  const length_meters = totalDistance(coordinates);
  const distance_km = length_meters / 1000;
  const elevation_gain_meters = 0;
  const estimated_duration_minutes = (distance_km / 5) * 60;

  let difficulty: Difficulty = "easy";

  if (distance_km >= 16) {
    difficulty = "expert";
  } else if (distance_km >= 10) {
    difficulty = "hard";
  } else if (distance_km >= 5) {
    difficulty = "moderate";
  }

  return {
    length_meters,
    elevation_gain_meters,
    estimated_duration_minutes,
    difficulty,
  };
}

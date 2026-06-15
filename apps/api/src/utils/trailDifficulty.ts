import type { Difficulty } from "@traces/shared-types";

export function classifyDifficulty(distanceKm: number, elevationGainMeters: number): Difficulty {
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

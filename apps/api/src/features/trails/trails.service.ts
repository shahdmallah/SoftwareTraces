import { totalDistance } from "../../utils/distance";

export function calculateTrailStats(coordinates: [number, number][]) {
  const length_meters = totalDistance(coordinates);
  const distance_km = length_meters / 1000;
  const elevation_gain_meters = 0;
  const estimated_duration_minutes = (distance_km / 5) * 60;

  let difficulty: "Easy" | "Moderate" | "Hard" | "Expert" = "Easy";

  if (distance_km >= 16) {
    difficulty = "Expert";
  } else if (distance_km >= 10) {
    difficulty = "Hard";
  } else if (distance_km >= 5) {
    difficulty = "Moderate";
  }

  return {
    length_meters,
    elevation_gain_meters,
    estimated_duration_minutes,
    difficulty,
  };
}

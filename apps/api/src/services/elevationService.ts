import type { ActivityPoint } from "@traces/shared-types";

/**
 * Computes cumulative elevation gain from sequential points.
 */
export function calculateElevationGain(points: ActivityPoint[]): number {
  let total = 0;

  for (let index = 1; index < points.length; index += 1) {
    const delta = (points[index].elevation ?? 0) - (points[index - 1].elevation ?? 0);
    if (delta > 0) {
      total += delta;
    }
  }

  return Number(total.toFixed(2));
}

import type { ActivityPoint, Trail } from "@traces/shared-types";

/**
 * Picks the closest trail by average point-to-trail distance.
 */
export function matchRecordedRouteToTrail(
  recordedPoints: ActivityPoint[],
  candidates: Array<Trail & { averageDistanceMeters?: number }>
): { trailId?: string; confidence: number } {
  if (recordedPoints.length < 2 || candidates.length === 0) {
    return { confidence: 0 };
  }

  const sorted = [...candidates].sort(
    (left, right) =>
      (left.averageDistanceMeters ?? Number.MAX_SAFE_INTEGER) -
      (right.averageDistanceMeters ?? Number.MAX_SAFE_INTEGER)
  );
  const best = sorted[0];
  const avgDistance = best.averageDistanceMeters ?? 5000;

  return {
    trailId: best.id,
    confidence: Math.max(0, Math.min(1, 1 - avgDistance / 1000))
  };
}

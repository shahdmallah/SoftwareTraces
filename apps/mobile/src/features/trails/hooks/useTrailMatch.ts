import { useMemo } from "react";
import type { ActivityPoint, Trail } from "@traces/shared-types";

function euclideanDistance(aLat: number, aLng: number, bLat: number, bLng: number): number {
  return Math.hypot(aLat - bLat, aLng - bLng);
}

function scoreTrail(points: ActivityPoint[], trail: Trail): number {
  if (points.length === 0 || trail.geometry.length === 0) {
    return 0;
  }

  const comparisons = points.slice(0, Math.min(points.length, trail.geometry.length));
  const total = comparisons.reduce((sum, point, index) => {
    const trailPoint = trail.geometry[index];
    return sum + euclideanDistance(point.lat, point.lng, trailPoint.lat, trailPoint.lng);
  }, 0);

  return 1 / (1 + total);
}

export function useTrailMatch(points: ActivityPoint[], trails: Trail[]) {
  return useMemo(() => {
    const ranked = trails
      .map((trail) => ({ trail, score: scoreTrail(points, trail) }))
      .sort((left, right) => right.score - left.score);

    return ranked[0] ?? null;
  }, [points, trails]);
}

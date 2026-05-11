/**
 * Payload passed from TrailReview → ActivityShare after a completed hike.
 * Maps to session data, trail API models, and review submission — no fabricated fields.
 */
export type TrailCompletionDraft = {
  trailId: string;
  trailName: string;
  trailNameAr?: string;
  trailImage?: string;
  region?: string;
  regionAr?: string;
  rating: number;
  review: string;
  photoUris: string[];
  completedAtIso: string;
  durationMs: number;
  stepCount: number;
  /** Number of GPS samples recorded along the route (proxy for “checkpoints” / journey density). */
  routePointCount: number;
  trailDistanceKm?: number;
  trailElevationGainM?: number;
  trailCoordinates?: [number, number];
};

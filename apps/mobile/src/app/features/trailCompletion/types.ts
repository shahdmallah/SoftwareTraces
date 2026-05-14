/**
 * Payload passed from TrailReview -> ActivityShare after a completed hike.
 * Review fields are for the trail review; post fields are for the Activity recap.
 */
export type TrailCompletionDraft = {
  activityId?: string;
  publisherId?: string;
  publisherName?: string;
  publisherHandle?: string;
  publisherAvatar?: string;
  trailId: string;
  trailName: string;
  trailNameAr?: string;
  trailImage?: string;
  region?: string;
  regionAr?: string;
  rating: number;
  review: string;
  reviewPhotoUris?: string[];
  postCaption?: string;
  postPhotoUris?: string[];
  postVisibility?: 'public' | 'friends' | 'private';
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

import type { NatureSighting } from '../../api/natureSightingsApi';

/**
 * Payload passed from TrailReview -> ActivityShare after a completed hike.
 * Review fields are for the trail review; post fields are for the Activity recap.
 */
export type TrailCompletionDraft = {
  activityId?: string;
  activityPostId?: string;
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
  reviewId?: string;
  reviewSkipped?: boolean;
  reviewPhotoUris?: string[];
  postSkipped?: boolean;
  postCaption?: string;
  postPhotoUris?: string[];
  activityPhotoTags?: Array<{
    uri: string;
    coordinate: [number, number];
    capturedAt: number;
    distanceKm?: number;
    elevationM?: number;
  }>;
  postVisibility?: 'public' | 'friends' | 'private';
  photoUris: string[];
  natureSightings?: NatureSighting[];
  completedAtIso: string;
  durationMs: number;
  stepCount: number;
  /** Number of GPS samples recorded along the route (proxy for “checkpoints” / journey density). */
  routePointCount: number;
  activityDistanceKm?: number;
  avgSpeedKph?: number;
  avgPaceMinPerKm?: number;
  elevationProfile?: Array<{
    distanceKm: number;
    elevationM: number;
    capturedAt?: number;
    speedKph?: number;
  }>;
  trailDistanceKm?: number;
  trailElevationGainM?: number;
  trailCoordinates?: [number, number];
};

export type ActivityStatus = "draft" | "recording" | "completed" | "synced";

export interface ActivityPoint {
  lat: number;
  lng: number;
  elevation?: number;
  accuracy?: number;
  speedMps?: number;
  recordedAt: string;
}

export interface GPSTrack {
  id: string;
  activityId: string;
  points: ActivityPoint[];
}

export interface Activity {
  id: string;
  userId: string;
  trailId?: string;
  title: string;
  startedAt: string;
  endedAt?: string;
  durationSec: number;
  distanceKm: number;
  elevationGainM: number;
  avgSpeedKph: number;
  maxSpeedKph: number;
  status: ActivityStatus;
  matchedTrailConfidence?: number;
  track?: GPSTrack;
  createdAt: string;
  updatedAt: string;
}

import type { Activity, ActivityPoint } from "./activity.types";
import type { FeedItem } from "./social.types";
import type { Condition, Review, Trail } from "./trail.types";
import type { AuthSession, Profile, User } from "./user.types";

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface RegisterRequest {
  email: string;
  username: string;
  password: string;
  fullName: string;
  locale?: "en" | "ar";
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthMeResponse {
  user: User;
  profile: Profile;
}

export interface NearbyTrailsQuery {
  lat: number;
  lng: number;
  radius?: number;
}

export interface SearchTrailsQuery {
  q?: string;
  difficulty?: string;
  minLength?: number;
  maxLength?: number;
}

export interface TrailBundle {
  trail: Trail;
  reviews: Review[];
  conditions: Condition[];
}

export interface StartActivityRequest {
  title: string;
  startedAt: string;
  trailId?: string;
}

export interface AddActivityPointsRequest {
  points: ActivityPoint[];
}

export interface CompleteActivityRequest {
  endedAt: string;
  distanceKm: number;
  elevationGainM: number;
  avgSpeedKph: number;
  maxSpeedKph: number;
}

export interface FeedResponse {
  items: FeedItem[];
}

export interface Achievement {
  id: string;
  code: string;
  name: string;
  description: string;
  icon: string;
  points: number;
}

export interface UserAchievement {
  achievementId: string;
  userId: string;
  unlockedAt: string;
}

export interface OfflineSyncPayload {
  activities: Activity[];
}

export interface OfflineSyncResponse {
  uploaded: string[];
  conflicts: string[];
}

export interface RoutesContract {
  auth: {
    register: ApiResponse<AuthSession>;
    login: ApiResponse<AuthSession>;
    me: ApiResponse<AuthMeResponse>;
  };
}

import { apiRequest } from './client';
import type { AuthUser } from './auth';

type Envelope<T> = { data: T; pagination?: unknown };

export type ProfileStats = {
  total_reviews: number;
  total_photos: number;
  total_likes_received: number;
  total_followers: number;
  total_following: number;
  total_friends: number;
  friends_count: number;
  total_points: number;
  achievements_count: number;
};

export type ProfileAchievement = {
  id: string;
  code: string;
  name: string;
  name_ar?: string | null;
  description?: string | null;
  description_ar?: string | null;
  category?: string | null;
  badge_icon_url?: string | null;
  points: number;
  earned_at?: string | null;
};

export type Profile = AuthUser & {
  stats?: ProfileStats;
  recent_reviews?: unknown[];
  recent_photos?: unknown[];
  recent_achievements?: ProfileAchievement[];
};

export type ProfileReview = {
  id: string;
  trail_id: string;
  rating: number;
  content: string;
  created_at: string;
};

export type ProfilePhoto = {
  id: string;
  url: string;
  created_at: string;
};

export async function getProfile(profileId: string) {
  const response = await apiRequest<Envelope<Profile>>(`/api/profiles/${profileId}`);
  return response.data;
}

export async function getProfileReviews(profileId: string, params: { page?: number; limit?: number } = {}) {
  const response = await apiRequest<Envelope<ProfileReview[]>>(`/api/profiles/${profileId}/reviews`, {}, params);
  return response.data;
}

export async function getProfilePhotos(profileId: string, params: { page?: number; limit?: number } = {}) {
  const response = await apiRequest<Envelope<ProfilePhoto[]>>(`/api/profiles/${profileId}/photos`, {}, params);
  return response.data;
}

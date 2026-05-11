import { apiRequest } from './client';

type Envelope<T> = {
  data: T;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
};

export type Profile = {
  id: string;
  user_id?: string;
  full_name: string;
  avatar_url?: string | null;
  bio?: string | null;
  location?: string | null;
  stats?: {
    total_reviews: number;
    total_photos: number;
    total_likes_received: number;
    total_followers: number;
    total_following: number;
  };
  recent_reviews?: ProfileReview[];
  recent_photos?: ProfilePhoto[];
};

export type ProfileReview = {
  id: string;
  rating: number;
  title?: string | null;
  content: string;
  photo_url?: string | null;
  photos?: Array<{ id: string; url: string; created_at: string }>;
  created_at: string;
  likes_count?: number;
  comments_count?: number;
  trail: {
    id: string;
    name: string;
    image?: string | null;
  };
};

export type ProfilePhoto = {
  id: string;
  url: string;
  caption?: string | null;
  created_at?: string;
  source?: 'trail_photo' | 'review';
  trail_id?: string;
  trail_name?: string;
};

export async function getProfile(profileId: string) {
  const response = await apiRequest<Envelope<Profile>>(`/api/profiles/${profileId}`);
  return response.data;
}

export async function getProfileReviews(profileId: string) {
  const response = await apiRequest<Envelope<ProfileReview[]>>(`/api/profiles/${profileId}/reviews`);
  return response.data;
}

export async function getProfilePhotos(profileId: string) {
  const response = await apiRequest<Envelope<ProfilePhoto[]>>(`/api/profiles/${profileId}/photos`);
  return response.data;
}

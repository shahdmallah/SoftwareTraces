import { apiRequest } from './client';
import type { TrailReview } from './trailsApi';

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
};

export type ProfilePhoto = {
  id: string;
  url: string;
  caption?: string | null;
  created_at?: string;
};

export async function getProfile(profileId: string) {
  const response = await apiRequest<Envelope<Profile>>(`/api/profiles/${profileId}`);
  return response.data;
}

export async function getProfileReviews(profileId: string) {
  const response = await apiRequest<Envelope<TrailReview[]>>(`/api/profiles/${profileId}/reviews`);
  return response.data;
}

export async function getProfilePhotos(profileId: string) {
  const response = await apiRequest<Envelope<ProfilePhoto[]>>(`/api/profiles/${profileId}/photos`);
  return response.data;
}

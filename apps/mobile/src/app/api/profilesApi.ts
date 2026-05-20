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

export type UpdateProfilePayload = {
  full_name: string;
  bio?: string | null;
  location?: string | null;
  avatar_url?: string | null;
};

export async function getProfile(profileId: string) {
  const response = await apiRequest<Envelope<Profile>>(`/api/profiles/${profileId}`);
  return response.data;
}

export async function updateMyProfile(payload: UpdateProfilePayload) {
  const response = await apiRequest<Envelope<Profile>>('/api/profiles/me', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  return response.data;
}

export async function uploadMyAvatar(uri: string, mimeType?: string | null, fileName?: string | null) {
  const formData = new FormData();
  const inferredName = fileName || uri.split('/').pop() || 'avatar.jpg';
  const inferredType = mimeType || (inferredName.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg');

  formData.append('avatar', {
    uri,
    name: inferredName,
    type: inferredType,
  } as unknown as Blob);

  const response = await apiRequest<Envelope<Profile>>('/api/profiles/me/avatar', {
    method: 'POST',
    body: formData,
  });
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

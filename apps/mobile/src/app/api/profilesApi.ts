import { apiRequest } from './client';
import type { ReactNativeFile } from './mediaApi';

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
    total_friends?: number;
    friends_count?: number;
    total_points?: number;
    achievements_count?: number;
  };
  relationship?: {
    is_following: boolean;
    is_follower: boolean;
    is_friend: boolean;
  };
  recent_reviews?: ProfileReview[];
  recent_photos?: ProfilePhoto[];
  recent_achievements?: ProfileAchievement[];
};

export type ProfileAchievement = {
  id: string;
  code?: string;
  name: string;
  name_ar?: string | null;
  description?: string | null;
  description_ar?: string | null;
  category?: string | null;
  badge_icon_url?: string | null;
  points?: number;
  earned_at?: string | null;
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
  full_name?: string;
  bio?: string | null;
  location?: string | null;
  avatar_url?: string | null;
  avatar?: ReactNativeFile | null;
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

export async function searchProfiles(query: string, params: { page?: number; limit?: number } = {}) {
  const response = await apiRequest<Envelope<Profile[]>>(`/api/profiles/search`, {}, {
    q: query,
    page: params.page,
    limit: params.limit,
  });
  return response.data;
}

export async function updateMyProfile(payload: UpdateProfilePayload) {
  const hasAvatar = Boolean(payload.avatar);

  if (!hasAvatar) {
    const { avatar, ...jsonPayload } = payload;
    const response = await apiRequest<Envelope<Profile>>('/api/profiles/me', {
      method: 'PATCH',
      body: JSON.stringify(jsonPayload),
    });
    return response.data;
  }

  const formData = new FormData();

  if (Object.prototype.hasOwnProperty.call(payload, 'full_name')) {
    formData.append('full_name', payload.full_name ?? '');
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'bio')) {
    formData.append('bio', payload.bio ?? '');
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'location')) {
    formData.append('location', payload.location ?? '');
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'avatar_url')) {
    formData.append('avatar_url', payload.avatar_url ?? '');
  }

  formData.append('avatar', payload.avatar as unknown as Blob);

  const response = await apiRequest<Envelope<Profile>>('/api/profiles/me', {
    method: 'PATCH',
    body: formData,
  });

  return response.data;
}

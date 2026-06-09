import { apiRequest } from './client';

type Envelope<T> = { data: T; pagination?: { page: number; limit: number; total: number; pages: number } };

export type SocialProfile = {
  id: string;
  full_name: string;
  avatar_url: string | null;
};

export type SocialFeedItem = {
  id: string;
  type: 'review' | 'activity' | 'media';
  user: SocialProfile;
  trail: { id: string | null; name: string | null; image: string | null };
  rating: number | null;
  content: string | null;
  caption: string | null;
  photo_url: string | null;
  created_at: string;
  likes_count: number;
  comments_count: number;
  is_liked_by_user: boolean;
  activity?: { id: string | null; distance_meters: number | null; elapsed_time_seconds: number | null } | null;
};

export async function getSocialFeed(params: { page?: number; limit?: number; filter?: 'all' | 'friends' } = {}) {
  return apiRequest<{ data: SocialFeedItem[]; pagination: { page: number; limit: number; total: number; pages: number } }>(
    '/api/social/feed',
    {},
    params,
  );
}

export async function followUser(userId: string) {
  return apiRequest<{ message: string }>(`/api/social/users/${userId}/follow`, { method: 'POST' });
}

export async function unfollowUser(userId: string) {
  return apiRequest<{ message: string }>(`/api/social/users/${userId}/follow`, { method: 'DELETE' });
}

export async function likeReview(reviewId: string) {
  return apiRequest<{ message: string }>(`/api/social/reviews/${reviewId}/like`, { method: 'POST' });
}

export async function unlikeReview(reviewId: string) {
  return apiRequest<{ message: string }>(`/api/social/reviews/${reviewId}/like`, { method: 'DELETE' });
}

export async function likeActivity(activityId: string) {
  return apiRequest<{ message: string }>(`/api/social/activities/${activityId}/like`, { method: 'POST' });
}

export async function unlikeActivity(activityId: string) {
  return apiRequest<{ message: string }>(`/api/social/activities/${activityId}/like`, { method: 'DELETE' });
}

export async function addReviewComment(reviewId: string, content: string) {
  const response = await apiRequest<Envelope<unknown>>(`/api/social/reviews/${reviewId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  });
  return response.data;
}

export async function commentOnActivity(activityId: string, body: string) {
  const response = await apiRequest<Envelope<unknown>>(`/api/social/activities/${activityId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ body }),
  });
  return response.data;
}

export async function getMyFriends(params: { page?: number; limit?: number } = {}) {
  return apiRequest<{ data: SocialProfile[]; pagination: { page: number; limit: number; total: number; pages: number } }>(
    '/api/social/users/me/friends',
    {},
    params,
  );
}

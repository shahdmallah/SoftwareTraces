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

export type SocialFeedReview = {
  id: string;
  type: 'review';
  user: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
  trail: {
    id: string;
    name: string;
    image: string | null;
  };
  rating: number;
  title: string | null;
  content: string;
  photo_url: string | null;
  photos: Array<{ id: string; url: string; created_at: string }>;
  created_at: string;
  likes_count: number;
  comments_count: number;
  is_liked_by_user: boolean;
};

export type SocialProfile = {
  id: string;
  full_name: string;
  avatar_url: string | null;
};

export type ReviewComment = {
  id: string;
  content: string;
  created_at: string;
  user: SocialProfile;
};

export async function getSocialFeed(params: { page?: number; limit?: number } = {}) {
  const response = await apiRequest<Envelope<SocialFeedReview[]>>('/api/social/feed', {}, {
    page: params.page,
    limit: params.limit,
  });

  return response;
}

export async function getFollowers(userId: string, params: { page?: number; limit?: number } = {}) {
  const response = await apiRequest<Envelope<SocialProfile[]>>(`/api/social/users/${userId}/followers`, {}, params);
  return response;
}

export async function getFollowing(userId: string, params: { page?: number; limit?: number } = {}) {
  const response = await apiRequest<Envelope<SocialProfile[]>>(`/api/social/users/${userId}/following`, {}, params);
  return response;
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

export async function getReviewLikes(reviewId: string, params: { page?: number; limit?: number } = {}) {
  const response = await apiRequest<Envelope<SocialProfile[]>>(`/api/social/reviews/${reviewId}/likes`, {}, params);
  return response;
}

export async function addReviewComment(reviewId: string, content: string) {
  const response = await apiRequest<Envelope<ReviewComment>>(`/api/social/reviews/${reviewId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  });
  return response.data;
}

export async function getReviewComments(reviewId: string, params: { page?: number; limit?: number } = {}) {
  const response = await apiRequest<Envelope<ReviewComment[]>>(`/api/social/reviews/${reviewId}/comments`, {}, params);
  return response;
}

export async function deleteReviewComment(commentId: string) {
  return apiRequest<{ message: string }>(`/api/social/comments/${commentId}`, { method: 'DELETE' });
}

export async function likeActivity(activityId: string) {
  await apiRequest<void>(`/api/social/activities/${activityId}/like`, { method: 'POST' });
}

export async function commentOnActivity(activityId: string, body: string) {
  const response = await apiRequest<Envelope<Record<string, unknown>>>(`/api/social/activities/${activityId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ body }),
  });
  return response.data;
}

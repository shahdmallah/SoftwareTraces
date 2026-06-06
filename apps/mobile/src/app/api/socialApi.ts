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

export type SocialFeedReviewPhotos = Array<{ id: string; url: string; created_at: string }>;

type SocialFeedUser = {
  id: string;
  full_name: string;
  avatar_url: string | null;
};

type SocialFeedTrail = {
  id: string | null;
  name: string | null;
  image: string | null;
};

type SocialFeedActivityStats = {
  id: string | null;
  distance_meters: number | null;
  elapsed_time_seconds: number | null;
  elevation_gain_meters: number | null;
} | null;

export type SocialFeedComment = {
  id: string;
  body: string;
  created_at: string;
  user: SocialFeedUser;
};

export type SocialFeedReviewItem = {
  id: string;
  type: 'review';
  user: SocialFeedUser;
  trail: SocialFeedTrail;
  rating: number | null;
  title: string | null;
  content: string | null;
  caption: string | null;
  visibility: string | null;
  photo_url: string | null;
  photos: SocialFeedReviewPhotos;
  activity: SocialFeedActivityStats;
  created_at: string;
  likes_count: number;
  comments_count: number;
  is_liked_by_user: boolean;
  recent_comments?: SocialFeedComment[];
};

export type SocialFeedActivityItem = {
  id: string;
  type: 'activity';
  user: SocialFeedUser;
  trail: SocialFeedTrail;
  rating: number | null;
  title: string | null;
  content: string | null;
  caption: string | null;
  visibility: string | null;
  photo_url: string | null;
  photos: SocialFeedReviewPhotos;
  activity: NonNullable<SocialFeedActivityStats>;
  created_at: string;
  likes_count: number;
  comments_count: number;
  is_liked_by_user: boolean;
  recent_comments?: SocialFeedComment[];
};

export type SocialFeedItem = SocialFeedReviewItem | SocialFeedActivityItem;

export type SocialFeedResponse = {
  data: SocialFeedItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
};

/** @deprecated Use SocialFeedItem; kept for gradual migration */
export type SocialFeedReview = SocialFeedReviewItem;

export type SocialProfile = {
  id: string;
  full_name: string;
  avatar_url: string | null;
};

export type FriendSuggestion = SocialProfile & {
  mutual_following_count: number;
};

export type ReviewComment = {
  id: string;
  content: string;
  created_at: string;
  user: SocialProfile;
};

export type ActivityComment = {
  id: string;
  activity_id: string;
  user_id: string;
  body: string;
  created_at?: string;
  user?: SocialProfile;
};

export type PaginatedList<T> = {
  count: number;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
};

export async function getSocialFeed(params: { page?: number; limit?: number } = {}) {
  return apiRequest<SocialFeedResponse>('/api/social/feed', {}, {
    page: params.page,
    limit: params.limit,
  });
}

export async function getSocialFeedItem(type: 'review' | 'activity', id: string) {
  const response = await apiRequest<Envelope<SocialFeedItem>>(`/api/social/feed/${type}/${id}`);
  return response.data;
}

export async function getFollowers(userId: string, params: { page?: number; limit?: number } = {}) {
  return apiRequest<PaginatedList<SocialProfile>>(`/api/social/users/${userId}/followers`, {}, params);
}

export async function getFollowing(userId: string, params: { page?: number; limit?: number } = {}) {
  return apiRequest<PaginatedList<SocialProfile>>(`/api/social/users/${userId}/following`, {}, params);
}

export async function getFriends(userId: string, params: { page?: number; limit?: number } = {}) {
  return apiRequest<PaginatedList<SocialProfile>>(`/api/social/users/${userId}/friends`, {}, params);
}

export async function getMyFriends(params: { page?: number; limit?: number } = {}) {
  return apiRequest<PaginatedList<SocialProfile>>('/api/social/users/me/friends', {}, params);
}

export async function getFriendSuggestions(params: { page?: number; limit?: number } = {}) {
  return apiRequest<{
    count: number;
    data: FriendSuggestion[];
    pagination: { page: number; limit: number; total?: number; pages?: number };
  }>('/api/social/users/me/friend-suggestions', {}, params);
}

export async function getFriendCount(userId: string) {
  const response = await apiRequest<{ count: number }>(`/api/social/users/${userId}/friends/count`);
  return response.count;
}

export async function followUser(userId: string) {
  return apiRequest<{ message: string }>(`/api/social/users/${userId}/follow`, { method: 'POST' });
}

export async function unfollowUser(userId: string) {
  return apiRequest<{ message: string }>(`/api/social/users/${userId}/follow`, { method: 'DELETE' });
}

export async function removeFriend(userId: string) {
  return apiRequest<{ message: string; deleted: number }>(`/api/social/users/${userId}/friend`, { method: 'DELETE' });
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
  return apiRequest<PaginatedList<ReviewComment>>(`/api/social/reviews/${reviewId}/comments`, {}, params);
}

export async function deleteReviewComment(commentId: string) {
  return apiRequest<{ message: string }>(`/api/social/comments/${commentId}`, { method: 'DELETE' });
}

export async function likeActivity(activityId: string) {
  return apiRequest<{ message: string }>(`/api/social/activities/${activityId}/like`, { method: 'POST' });
}

export async function unlikeActivity(activityId: string) {
  return apiRequest<{ message: string; deleted: number }>(`/api/social/activities/${activityId}/like`, { method: 'DELETE' });
}

export async function commentOnActivity(activityId: string, body: string) {
  const response = await apiRequest<Envelope<ActivityComment>>(`/api/social/activities/${activityId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ body }),
  });
  return response.data;
}

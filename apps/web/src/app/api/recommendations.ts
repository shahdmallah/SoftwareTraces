import { apiRequest } from './client';

type Envelope<T> = {
  data: T;
};

export type TrailRecommendation = {
  trail_id: string;
  name: string;
  name_ar?: string | null;
  region?: string | null;
  difficulty?: string | null;
  length_km: number;
  rating: number;
  safety_score?: number | null;
  risk_level?: string | null;
  image?: string | null;
  score: number;
  reason: string;
  match_tags: string[];
};

export type RecommendationPreferences = {
  preferred_regions: string[];
  preferred_difficulties: string[];
  preferred_features: string[];
  preferred_tags: string[];
  min_distance_km: number | null;
  max_distance_km: number | null;
};

export async function getTrailRecommendations() {
  const response = await apiRequest<Envelope<TrailRecommendation[]>>('/api/recommendations/trails');
  return response.data.map((recommendation) => ({
    ...recommendation,
    match_tags: Array.isArray(recommendation.match_tags) ? recommendation.match_tags : [],
  }));
}

export async function getRecommendationPreferences() {
  const response = await apiRequest<Envelope<RecommendationPreferences>>('/api/recommendations/preferences');
  return response.data;
}

export async function updateRecommendationPreferences(preferences: Partial<RecommendationPreferences>) {
  const response = await apiRequest<Envelope<RecommendationPreferences>>('/api/recommendations/preferences', {
    method: 'PUT',
    body: JSON.stringify(preferences),
  });
  return response.data;
}

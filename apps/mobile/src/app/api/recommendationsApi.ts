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

export async function getTrailRecommendations() {
  const response = await apiRequest<Envelope<TrailRecommendation[]>>('/api/recommendations/trails');

  return response.data.map((recommendation) => ({
    ...recommendation,
    match_tags: Array.isArray(recommendation.match_tags) ? recommendation.match_tags : [],
  }));
}

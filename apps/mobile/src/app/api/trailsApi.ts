// Updated to centralize typed frontend access for trail, review, condition, bookmark, and nearby APIs with mobile-friendly normalization.
import { apiRequest } from './client';

export type TrailDifficulty = 'Easy' | 'Moderate' | 'Hard' | 'Expert';
export type TrailDifficultyApi = 'easy' | 'moderate' | 'hard' | 'expert';
export type BookmarkType = 'favorites' | 'want_to_do' | 'completed';
export type ConditionType =
  | 'snow'
  | 'ice'
  | 'mud'
  | 'flood'
  | 'fallen_trees'
  | 'wildfire'
  | 'closure'
  | 'good'
  | 'fair';
export type ConditionSeverity = 'low' | 'medium' | 'high' | 'extreme';

export type Trail = {
  id: string;
  name: string;
  nameAr: string;
  region: string;
  regionAr: string;
  description: string;
  descriptionAr: string;
  distance: number;
  duration: string;
  elevationGain: number;
  elevationMin: number;
  elevationMax: number;
  difficulty: TrailDifficulty;
  rating: number;
  reviews: number;
  image: string;
  images: string[];
  features: string[];
  featuresAr: string[];
  hasCheckpoint: boolean;
  checkpointNote?: string;
  coordinates: [number, number];
  routeCoordinates?: [number, number][];
  mapX: number;
  mapY: number;
  tags: string[];
};

export type TrailReview = {
  id: string;
  trail_id: string;
  user_id: string;
  rating: number;
  title?: string | null;
  content: string;
  created_at: string;
  photos?: Array<{ id: string; url: string; created_at?: string }>;
};

export type TrailPhoto = {
  id: string;
  url: string;
  caption?: string | null;
  is_primary?: boolean;
  created_at?: string;
  uploaded_by?: string | null;
  source?: 'direct' | 'review';
};

export type ReactNativeFile = {
  uri: string;
  name: string;
  type: string;
};

export type TrailCondition = {
  id: string;
  trail_id: string;
  user_id: string;
  condition_type: ConditionType;
  severity?: ConditionSeverity | null;
  description?: string | null;
  reported_at: string;
  is_resolved?: boolean;
};

export type HourlyWeatherHour = {
  timestamp: string;
  temperatureC: number;
  feelsLikeC?: number;
  precipitationProbability: number;
  windSpeedKph: number;
  condition: string;
  isDaytime: boolean;
  localTime: string;
  localDate: string;
};

export type ForecastDay = {
  date: string;
  dayLabel: string;
  summary: string;
  hours: HourlyWeatherHour[];
};

export type TrailStatsResponse = {
  length_meters: number;
  elevation_gain_meters: number;
  estimated_duration_minutes: number;
  difficulty: TrailDifficultyApi;
};

export type ElevationProfile = {
  elevations: number[];
  distances: number[];
  total_gain: number;
  total_loss: number;
  min_elevation: number;
  max_elevation: number;
  start_elevation: number;
  end_elevation: number;
  warnings?: string[];
};

export type TrailBookmark = {
  saved_id: string;
  trailId: string;
  type: BookmarkType;
  notes?: string | null;
  savedAt: string;
};

type Envelope<T> = {
  data: T;
  message?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
};

type SavedTrailRow = {
  saved_id: string;
  notes?: string | null;
  saved_at: string;
} & Trail;

type SavedStatusResponse = {
  is_saved: boolean;
  saved_id: string | null;
  list_type: BookmarkType;
  notes: string | null;
};

function normalizeDifficulty(value: string | null | undefined): TrailDifficulty {
  switch ((value ?? '').toLowerCase()) {
    case 'moderate':
      return 'Moderate';
    case 'hard':
      return 'Hard';
    case 'expert':
      return 'Expert';
    default:
      return 'Easy';
  }
}

function toApiDifficulty(value: TrailDifficulty): TrailDifficultyApi {
  return value.toLowerCase() as TrailDifficultyApi;
}

function normalizeTrail(trail: Trail): Trail {
  return {
    ...trail,
    difficulty: normalizeDifficulty(trail.difficulty),
    images: Array.isArray(trail.images) ? trail.images : [],
    features: Array.isArray(trail.features) ? trail.features : [],
    featuresAr: Array.isArray(trail.featuresAr) ? trail.featuresAr : [],
    tags: Array.isArray(trail.tags) ? trail.tags : [],
    image: trail.image || trail.images?.[0] || 'https://images.unsplash.com/photo-1511497584788-876760111969?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800',
    checkpointNote: trail.checkpointNote || undefined,
    routeCoordinates: Array.isArray(trail.routeCoordinates) ? trail.routeCoordinates : undefined,
  };
}

export async function createTrail(payload: {
  name: string;
  description?: string;
  coordinates: [number, number][];
  stats: TrailStatsResponse;
}) {
  return apiRequest<Envelope<{ id: string }>>('/api/trails', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function pingTrails() {
  return apiRequest<{ ok: boolean; message?: string }>('/api/trails/ping');
}

export async function getTrails(page?: number, limit?: number) {
  const response = await apiRequest<Envelope<Trail[]>>('/api/trails', {}, { page, limit });
  return response.data.map(normalizeTrail);
}

export async function getTrailById(id: string) {
  const response = await apiRequest<Envelope<Trail>>(`/api/trails/${id}`);
  return normalizeTrail(response.data);
}

export async function getTrailElevationProfile(id: string, params: { points?: number; simplify?: boolean } = {}) {
  const response = await apiRequest<Envelope<ElevationProfile>>(`/api/trails/${id}/elevation-profile`, {}, params);
  return response.data;
}

export async function updateTrail(id: string, payload: Partial<{
  name: string;
  description: string;
  region: string;
  difficulty: TrailDifficultyApi;
  features: string[];
  tags: string[];
}>) {
  return apiRequest<Envelope<Record<string, unknown>>>(`/api/trails/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteTrail(id: string) {
  return apiRequest<{ message: string }>(`/api/trails/${id}`, { method: 'DELETE' });
}

export async function publishTrail(id: string) {
  return apiRequest<Envelope<{ id: string; status: string; published_at: string }>>(`/api/trails/${id}/publish`, {
    method: 'PATCH',
  });
}

export async function getTrailStats(payload: { coordinates: [number, number][] }) {
  const response = await apiRequest<Envelope<TrailStatsResponse>>('/api/trails/calculate', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return response.data;
}

export async function searchTrails(params: {
  q?: string;
  difficulty?: TrailDifficulty | 'all';
  minLength?: number;
  maxLength?: number;
}) {
  const response = await apiRequest<Envelope<Trail[]>>('/api/trails/search', {}, {
    q: params.q,
    difficulty: params.difficulty && params.difficulty !== 'all' ? toApiDifficulty(params.difficulty) : undefined,
    minLength: params.minLength,
    maxLength: params.maxLength,
  });
  return response.data.map(normalizeTrail);
}

export async function getNearbyTrails(params: { lat: number; lng: number; radius?: number }) {
  const response = await apiRequest<Envelope<Trail[]>>('/api/trails/nearby', {}, params);
  return response.data.map(normalizeTrail);
}

export async function addTrailReview(id: string, payload: { rating: number; content: string; title?: string; photos?: ReactNativeFile[] }) {
  if (payload.photos?.length) {
    const formData = new FormData();
    formData.append('rating', String(payload.rating));
    formData.append('content', payload.content);

    if (payload.title) {
      formData.append('title', payload.title);
    }

    payload.photos.forEach((photo) => {
      formData.append('photos', photo as unknown as Blob);
    });

    return apiRequest<Envelope<{ id: string; photos?: TrailReview['photos'] }>>(`/api/trails/${id}/reviews`, {
      method: 'POST',
      body: formData,
    });
  }

  return apiRequest<Envelope<{ id: string }>>(`/api/trails/${id}/reviews`, {
    method: 'POST',
    body: JSON.stringify({
      rating: payload.rating,
      content: payload.content,
      ...(payload.title ? { title: payload.title } : {}),
    }),
  });
}

export async function getTrailReviews(id: string) {
  const response = await apiRequest<Envelope<TrailReview[]>>(`/api/trails/${id}/reviews`);
  return response.data;
}

export async function addTrailCondition(
  id: string,
  payload: { condition_type: ConditionType; severity?: ConditionSeverity; description?: string },
) {
  return apiRequest<Envelope<TrailCondition>>(`/api/trails/${id}/conditions`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getTrailConditions(id: string) {
  const response = await apiRequest<Envelope<TrailCondition[]>>(`/api/trails/${id}/conditions`);
  return response.data;
}

export async function saveBookmark(payload: { trailId: string; type: BookmarkType; notes?: string }) {
  return apiRequest<Envelope<{ id: string }>>(`/api/trails/${payload.trailId}/save`, {
    method: 'POST',
    body: JSON.stringify({ list_type: payload.type, notes: payload.notes }),
  });
}

export async function removeBookmark(payload: { trailId: string; type: BookmarkType }) {
  return apiRequest<{ message: string }>(`/api/trails/${payload.trailId}/save`, {
    method: 'DELETE',
    body: JSON.stringify({ list_type: payload.type }),
  });
}

export async function getBookmarks(params: { type: BookmarkType; page?: number; limit?: number }) {
  const response = await apiRequest<Envelope<SavedTrailRow[]>>('/api/trails/saved', {}, {
    list_type: params.type,
    page: params.page,
    limit: params.limit,
  });

  return {
    items: response.data.map((item) => ({
      saved_id: item.saved_id,
      trailId: item.id,
      type: params.type,
      notes: item.notes,
      savedAt: item.saved_at,
    })),
    pagination: response.pagination,
  };
}

export async function getSavedTrails(params: { type: BookmarkType; page?: number; limit?: number }) {
  const response = await apiRequest<Envelope<SavedTrailRow[]>>('/api/trails/saved', {}, {
    list_type: params.type,
    page: params.page,
    limit: params.limit,
  });

  return {
    items: response.data.map((item) => ({
      trail: normalizeTrail(item),
      savedAt: item.saved_at,
      notes: item.notes,
      savedId: item.saved_id,
      type: params.type,
    })),
    pagination: response.pagination,
  };
}

export async function getBookmarkStatus(trailId: string, type: BookmarkType) {
  return apiRequest<SavedStatusResponse>(`/api/trails/${trailId}/saved-status`, {}, { list_type: type });
}

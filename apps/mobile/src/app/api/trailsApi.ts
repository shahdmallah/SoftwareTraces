// Updated to centralize typed frontend access for trail, review, condition, bookmark, and nearby APIs with mobile-friendly normalization.
import { apiRequest } from './client';

export type TrailDifficulty = 'Easy' | 'Moderate' | 'Hard' | 'Expert';
export type TrailDifficultyApi = 'easy' | 'moderate' | 'hard' | 'expert';
export type TrailStatus = 'draft' | 'published' | 'private' | string;
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
  status?: TrailStatus;
  isPublic?: boolean;
  publishedAt?: string | null;
  userId?: string | null;
};

export type TrailReview = {
  id: string;
  trail_id: string;
  user_id: string;
  rating: number;
  title?: string | null;
  content: string;
  created_at: string;
  photos?: Array<{
    id: string;
    url: string;
    created_at?: string;
    approved_for_trail_page?: boolean;
    helpful_score?: number;
    flag_count?: number;
  }>;
  user?: {
    id?: string;
    full_name?: string | null;
    avatar_url?: string | null;
  } | null;
  profile?: {
    id?: string;
    full_name?: string | null;
    avatar_url?: string | null;
  } | null;
  full_name?: string | null;
  user_name?: string | null;
  username?: string | null;
  avatar_url?: string | null;
};

export type TrailPhoto = {
  id: string;
  url: string;
  thumbnail_url?: string | null;
  caption?: string | null;
  is_primary?: boolean;
  created_at?: string;
  uploaded_by?: string | null;
  source?: 'direct' | 'review' | 'media' | 'activity_media';
  approved_for_trail_page?: boolean;
  manual_review_required?: boolean;
  helpful_score?: number;
  flag_count?: number;
  quality_score?: number | null;
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

export type TrailAnalysisResponse = TrailStatsResponse & {
  region?: string | null;
  ai_name?: string | null;
  ai_description?: string | null;
  ai_labels?: string[];
};

export type TrailReviewStatsResponse = {
  average_rating: number;
  total_reviews: number;
  rating: number;
  reviews: number;
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

export type GeneratedTrailSuggestion = {
  coordinates: [number, number][];
  length_meters: number;
  elevation_gain_meters: number;
  estimated_duration_minutes: number;
  difficulty: TrailDifficultyApi;
  name_suggestion: string | null;
  description_suggestion: string | null;
  labels: string[];
};

export type ExistingTrailSuggestion = {
  id: string;
  name: string;
  region?: string | null;
  match_score?: number;
  distance_km?: number;
  difficulty?: TrailDifficultyApi | string | null;
  labels?: string[];
};

export type TrailSearchOrGenerateResult = {
  parsed: {
    length_km: number | null;
    difficulty: TrailDifficultyApi | null;
    region: string | null;
    duration_minutes: number | null;
    labels: string[];
    name_suggestion: string | null;
    description_suggestion: string | null;
  };
  existing_trails: ExistingTrailSuggestion[];
  generated_trail: GeneratedTrailSuggestion | null;
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

const WEST_BANK_LNG_MIN = 34;
const WEST_BANK_LNG_MAX = 36.8;
const WEST_BANK_LAT_MIN = 29;
const WEST_BANK_LAT_MAX = 33.8;

function isLikelyWestBankLngLat(point: [number, number]) {
  const [lng, lat] = point;
  return lng >= WEST_BANK_LNG_MIN && lng <= WEST_BANK_LNG_MAX && lat >= WEST_BANK_LAT_MIN && lat <= WEST_BANK_LAT_MAX;
}

function isLikelyWestBankLatLng(point: [number, number]) {
  const [lat, lng] = point;
  return lat >= WEST_BANK_LAT_MIN && lat <= WEST_BANK_LAT_MAX && lng >= WEST_BANK_LNG_MIN && lng <= WEST_BANK_LNG_MAX;
}

function normalizeRoutePoint(point: [number, number]): [number, number] {
  if (isLikelyWestBankLatLng(point) && !isLikelyWestBankLngLat(point)) {
    return [point[1], point[0]];
  }

  return point;
}

function normalizeRouteCoordinates(routeCoordinates?: [number, number][]) {
  if (!Array.isArray(routeCoordinates)) {
    return undefined;
  }

  return routeCoordinates.map(normalizeRoutePoint);
}

function toApiDifficulty(value: TrailDifficulty): TrailDifficultyApi {
  return value.toLowerCase() as TrailDifficultyApi;
}

export function normalizeTrail(trail: Trail): Trail {
  return {
    ...trail,
    difficulty: normalizeDifficulty(trail.difficulty),
    images: Array.isArray(trail.images) ? trail.images : [],
    features: Array.isArray(trail.features) ? trail.features : [],
    featuresAr: Array.isArray(trail.featuresAr) ? trail.featuresAr : [],
    tags: Array.isArray(trail.tags) ? trail.tags : [],
    image: trail.image || trail.images?.[0] || 'https://images.unsplash.com/photo-1511497584788-876760111969?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800',
    checkpointNote: trail.checkpointNote || undefined,
    routeCoordinates: normalizeRouteCoordinates(trail.routeCoordinates),
    status: typeof trail.status === 'string' ? trail.status : undefined,
    isPublic: typeof trail.isPublic === 'boolean' ? trail.isPublic : typeof (trail as any).is_public === 'boolean' ? (trail as any).is_public : undefined,
    publishedAt: typeof trail.publishedAt === 'string' ? trail.publishedAt : typeof (trail as any).published_at === 'string' ? (trail as any).published_at : null,
    userId: typeof trail.userId === 'string' ? trail.userId : typeof (trail as any).user_id === 'string' ? (trail as any).user_id : null,
  };
}

export async function createTrail(payload: {
  name: string;
  nameAr?: string;
  description?: string;
  descriptionAr?: string;
  region?: string;
  regionAr?: string;
  features?: string[];
  featuresAr?: string[];
  tags?: string[];
  status?: 'draft' | 'published';
  coordinates: [number, number][];
  stats: TrailStatsResponse;
}) {
  return apiRequest<Envelope<Trail>>('/api/trails', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function uploadTrailPhoto(trailId: string, uri: string) {
  const filename = uri.split('/').pop() ?? `trail-${Date.now()}.jpg`;
  const match = filename.match(/\.([a-zA-Z0-9]+)$/);
  const type = match ? `image/${match[1].toLowerCase()}` : 'image/jpeg';

  const formData = new FormData();
  formData.append('photo', {
    uri,
    name: filename,
    type,
  } as any);

  return apiRequest<Envelope<{ id: string; url: string }>>(`/api/trails/${trailId}/photos`, {
    method: 'POST',
    body: formData,
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

export async function analyzeTrailRoute(payload: { coordinates: [number, number][] }) {
  const response = await apiRequest<Envelope<TrailAnalysisResponse>>('/api/trails/analyze-route', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return {
    ...response.data,
    ai_labels: Array.isArray(response.data.ai_labels) ? response.data.ai_labels : [],
  };
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

export async function searchOrGenerateTrail(description: string) {
  const response = await apiRequest<Envelope<TrailSearchOrGenerateResult>>('/api/trails/search-or-generate', {
    method: 'POST',
    body: JSON.stringify({ description }),
  });
  return {
    ...response.data,
    existing_trails: Array.isArray(response.data.existing_trails) ? response.data.existing_trails : [],
    generated_trail: response.data.generated_trail
      ? {
          ...response.data.generated_trail,
          coordinates: normalizeRouteCoordinates(response.data.generated_trail.coordinates) ?? [],
          labels: Array.isArray(response.data.generated_trail.labels) ? response.data.generated_trail.labels : [],
        }
      : null,
  };
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

export async function recalculateTrailReviewStats(id: string) {
  const response = await apiRequest<Envelope<TrailReviewStatsResponse>>(`/api/trails/${id}/reviews/recalculate`, {
    method: 'POST',
  });
  return response.data;
}

export async function getTrailReviews(id: string) {
  const response = await apiRequest<Envelope<TrailReview[]>>(`/api/trails/${id}/reviews`);
  return response.data;
}

export async function deleteTrailReview(reviewId: string) {
  return apiRequest<{ message: string }>(`/api/trails/reviews/${reviewId}`, { method: 'DELETE' });
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

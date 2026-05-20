import { apiRequest } from './client';

export type TrailDifficulty = 'Easy' | 'Moderate' | 'Hard' | 'Expert';

export type Trail = {
  id: string;
  name: string;
  nameAr?: string;
  region: string;
  regionAr?: string;
  description?: string;
  descriptionAr?: string;
  distance: number;
  duration: string;
  elevationGain: number;
  elevationMin?: number;
  elevationMax?: number;
  difficulty: TrailDifficulty;
  rating: number;
  reviews: number;
  image: string;
  images?: string[];
  features?: string[];
  featuresAr?: string[];
  tags?: string[];
  coordinates: [number, number];
  routeCoordinates?: [number, number][];
};

export type TrailReview = {
  id: string;
  rating: number;
  title?: string | null;
  content: string;
  created_at: string;
  user?: { full_name?: string | null; avatar_url?: string | null } | null;
  profile?: { full_name?: string | null; avatar_url?: string | null } | null;
  full_name?: string | null;
};

export type TrailCondition = {
  id: string;
  condition_type: string;
  severity?: string | null;
  description?: string | null;
  reported_at: string;
};

type Envelope<T> = {
  data: T;
  pagination?: { page: number; limit: number; total: number; pages: number };
};

type SavedTrailRow = Trail & {
  saved_id: string;
  saved_at: string;
  notes?: string | null;
};

function normalizeDifficulty(value: unknown): TrailDifficulty {
  switch (String(value ?? '').toLowerCase()) {
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

function normalizePoint(point: [number, number]): [number, number] {
  const [a, b] = point;
  const looksLatLng = a >= 29 && a <= 33.8 && b >= 34 && b <= 36.8;
  const looksLngLat = a >= 34 && a <= 36.8 && b >= 29 && b <= 33.8;
  return looksLatLng && !looksLngLat ? [b, a] : point;
}

export function normalizeTrail(raw: Trail): Trail {
  const images = Array.isArray(raw.images) ? raw.images : [];
  return {
    ...raw,
    difficulty: normalizeDifficulty(raw.difficulty),
    image: raw.image || images[0] || 'https://images.unsplash.com/photo-1511497584788-876760111969?w=900&auto=format&fit=crop',
    images,
    features: Array.isArray(raw.features) ? raw.features : [],
    featuresAr: Array.isArray(raw.featuresAr) ? raw.featuresAr : [],
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    coordinates: raw.coordinates ? normalizePoint(raw.coordinates) : [35.24, 31.78],
    routeCoordinates: Array.isArray(raw.routeCoordinates) ? raw.routeCoordinates.map(normalizePoint) : undefined,
  };
}

export async function getTrails(page = 1, limit = 50) {
  const response = await apiRequest<Envelope<Trail[]>>('/api/trails', {}, { page, limit });
  return response.data.map(normalizeTrail);
}

export async function searchTrails(params: {
  q?: string;
  difficulty?: TrailDifficulty | 'all';
  minLength?: number;
  maxLength?: number;
}) {
  const response = await apiRequest<Envelope<Trail[]>>('/api/trails/search', {}, {
    q: params.q,
    difficulty: params.difficulty && params.difficulty !== 'all' ? params.difficulty.toLowerCase() : undefined,
    minLength: params.minLength,
    maxLength: params.maxLength,
  });
  return response.data.map(normalizeTrail);
}

export async function getNearbyTrails(params: { lat: number; lng: number; radius?: number }) {
  const response = await apiRequest<Envelope<Trail[]>>('/api/trails/nearby', {}, params);
  return response.data.map(normalizeTrail);
}

export async function getTrailById(id: string) {
  const response = await apiRequest<Envelope<Trail>>(`/api/trails/${id}`);
  return normalizeTrail(response.data);
}

export async function getTrailReviews(id: string) {
  const response = await apiRequest<Envelope<TrailReview[]>>(`/api/trails/${id}/reviews`);
  return response.data;
}

export async function getTrailConditions(id: string) {
  const response = await apiRequest<Envelope<TrailCondition[]>>(`/api/trails/${id}/conditions`);
  return response.data;
}

export async function getTrailPhotos(id: string) {
  const response = await apiRequest<Envelope<Array<{ id: string; url: string; is_primary?: boolean }>>>(`/api/trails/${id}/photos`);
  return response.data;
}

export async function getTrailStats(coordinates: [number, number][]) {
  const response = await apiRequest<Envelope<{
    length_meters: number;
    elevation_gain_meters: number;
    estimated_duration_minutes: number;
    difficulty: string;
  }>>('/api/trails/calculate', {
    method: 'POST',
    body: JSON.stringify({ coordinates }),
  });
  return response.data;
}

export async function createTrail(payload: { name: string; description?: string; coordinates: [number, number][]; stats: unknown }) {
  const response = await apiRequest<Envelope<Trail>>('/api/trails', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return normalizeTrail(response.data);
}

export async function updateTrail(id: string, payload: { name?: string; description?: string }) {
  return apiRequest(`/api/trails/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
}

export async function publishTrail(id: string) {
  return apiRequest(`/api/trails/${id}/publish`, { method: 'PATCH' });
}

export async function deleteTrail(id: string) {
  return apiRequest(`/api/trails/${id}`, { method: 'DELETE' });
}

export async function getMyTrailDrafts(limit = 100) {
  const response = await apiRequest<Envelope<Trail[]>>('/api/trails/drafts', {}, { limit });
  return response.data.map(normalizeTrail);
}

export async function getSavedTrails() {
  const response = await apiRequest<Envelope<SavedTrailRow[]>>('/api/trails/saved', {}, { list_type: 'favorites', limit: 100 });
  return response.data.map((row) => normalizeTrail(row));
}

export async function saveTrail(id: string) {
  return apiRequest(`/api/trails/${id}/save`, {
    method: 'POST',
    body: JSON.stringify({ list_type: 'favorites' }),
  });
}

export async function unsaveTrail(id: string) {
  return apiRequest(`/api/trails/${id}/save`, {
    method: 'DELETE',
    body: JSON.stringify({ list_type: 'favorites' }),
  });
}

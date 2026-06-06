import { apiRequest } from './client';
import type { PhotoType } from './mediaApi';
import type { SpeciesIdentification, SpeciesLanguage } from './speciesApi';

type Envelope<T> = {
  data: T;
};

export type NatureSighting = {
  id: string;
  trail_id?: string | null;
  activity_id?: string | null;
  user_id?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  category?: string | null;
  species?: string | null;
  common_name?: string | null;
  confidence?: number | null;
  photo_url?: string | null;
  photo_id?: string | null;
  photo_type?: PhotoType | null;
  media_id?: string | null;
  activity_media_id?: string | null;
  classification?: SpeciesIdentification | null;
  language?: SpeciesLanguage;
  source?: string;
  created_at?: string;
  updated_at?: string | null;
};

export async function getTrailNatureSightings(trailId: string) {
  const response = await apiRequest<Envelope<NatureSighting[]>>(`/api/trails/${trailId}/nature-sightings`);
  return response.data;
}

export async function getActivityNatureSightings(activityId: string) {
  const response = await apiRequest<Envelope<NatureSighting[]>>(`/api/activities/${activityId}/nature-sightings`);
  return response.data;
}

export async function saveNatureSighting(
  payload: {
    trail_id?: string | null;
    activity_id?: string | null;
    photo_id?: string | null;
    photo_type?: PhotoType | null;
    photo_url?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    language: SpeciesLanguage;
    classification: SpeciesIdentification;
  },
) {
  const response = await apiRequest<Envelope<NatureSighting>>('/api/nature-sightings', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  return response.data;
}

export async function saveTrailNatureSighting(
  trailId: string,
  payload: Omit<Parameters<typeof saveNatureSighting>[0], 'trail_id'>,
) {
  const response = await apiRequest<Envelope<NatureSighting>>(`/api/trails/${trailId}/nature-sightings`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  return response.data;
}

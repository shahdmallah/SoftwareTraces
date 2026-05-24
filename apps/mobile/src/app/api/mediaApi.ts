import { apiRequest } from './client';

type Envelope<T> = {
  data: T;
};

export type TrailPhoto = {
  id: string;
  url: string;
  caption?: string | null;
  is_primary?: boolean;
  created_at?: string;
  uploaded_by?: string | null;
  user_id?: string | null;
  uploader_id?: string | null;
  source?: 'direct' | 'review';
};

export type ReactNativeFile = {
  uri: string;
  name: string;
  type: string;
};

export async function getTrailPhotos(id: string) {
  const response = await apiRequest<Envelope<TrailPhoto[]>>(`/api/trails/${id}/photos`);
  return response.data;
}

export async function uploadTrailPhoto(id: string, payload: { photo: ReactNativeFile; caption?: string }) {
  const formData = new FormData();
  formData.append('photo', payload.photo as unknown as Blob);

  if (payload.caption) {
    formData.append('caption', payload.caption);
  }

  const response = await apiRequest<Envelope<{ id: string; url: string }>>(`/api/trails/${id}/photos`, {
    method: 'POST',
    body: formData,
  });

  return response.data;
}

export async function uploadMedia(payload: {
  file: ReactNativeFile;
  caption?: string;
  latitude?: number | null;
  longitude?: number | null;
  locationName?: string | null;
}) {
  const formData = new FormData();
  formData.append('file', payload.file as unknown as Blob);

  if (payload.caption) formData.append('caption', payload.caption);
  if (typeof payload.latitude === 'number') formData.append('latitude', String(payload.latitude));
  if (typeof payload.longitude === 'number') formData.append('longitude', String(payload.longitude));
  if (payload.locationName) formData.append('location_name', payload.locationName);
  formData.append('is_public', 'true');

  const response = await apiRequest<Envelope<{ id: string; url: string; thumbnail_url?: string }>>('/api/media', {
    method: 'POST',
    body: formData,
  });

  return response.data;
}

export async function deleteReviewPhoto(photoId: string) {
  return apiRequest<{ message: string }>(`/api/trails/review-photos/${photoId}`, { method: 'DELETE' });
}

export async function deleteTrailPhoto(photoId: string) {
  return apiRequest<{ message: string }>(`/api/trails/photos/${photoId}`, { method: 'DELETE' });
}

export async function setPrimaryTrailPhoto(photoId: string) {
  return apiRequest<{ message: string }>(`/api/trails/photos/${photoId}/primary`, { method: 'PATCH' });
}

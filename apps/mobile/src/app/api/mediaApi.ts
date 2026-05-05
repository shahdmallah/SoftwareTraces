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

export async function deleteReviewPhoto(photoId: string) {
  return apiRequest<{ message: string }>(`/api/trails/review-photos/${photoId}`, { method: 'DELETE' });
}

export async function deleteTrailPhoto(photoId: string) {
  return apiRequest<{ message: string }>(`/api/trails/photos/${photoId}`, { method: 'DELETE' });
}

export async function setPrimaryTrailPhoto(photoId: string) {
  return apiRequest<{ message: string }>(`/api/trails/photos/${photoId}/primary`, { method: 'PATCH' });
}

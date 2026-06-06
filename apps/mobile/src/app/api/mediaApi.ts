import { apiRequest } from './client';

type Envelope<T> = {
  data: T;
};

export type TrailPhoto = {
  id: string;
  url: string;
  thumbnail_url?: string | null;
  caption?: string | null;
  is_primary?: boolean;
  created_at?: string;
  uploaded_by?: string | null;
  user_id?: string | null;
  uploader_id?: string | null;
  source?: 'direct' | 'review' | 'media' | 'activity_media';
  approved_for_trail_page?: boolean;
  manual_review_required?: boolean;
  helpful_score?: number;
  flag_count?: number;
  quality_score?: number | null;
};

export type PhotoType = 'media' | 'trail_photo' | 'review_photo' | 'activity_media';
export type PhotoFlagReason = 'irrelevant' | 'spam' | 'offensive' | 'copyright' | 'other';

export type PhotoStatus = {
  photo_id: string;
  photo_type: PhotoType;
  approved_for_trail_page: boolean;
  manual_review_required: boolean;
  helpful_score: number;
  flag_count: number;
  quality_score?: number | null;
  ai_classification?: unknown;
  ai_verified_at?: string | null;
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

export function getPhotoTypeForTrailPhoto(photo: TrailPhoto): PhotoType {
  switch (photo.source) {
    case 'review':
      return 'review_photo';
    case 'media':
      return 'media';
    case 'activity_media':
      return 'activity_media';
    default:
      return 'trail_photo';
  }
}

export async function votePhoto(photoId: string, photoType: PhotoType, vote: -1 | 0 | 1) {
  const response = await apiRequest<Envelope<PhotoStatus>>(`/api/photos/${photoId}/vote`, {
    method: 'POST',
    body: JSON.stringify({ photo_type: photoType, vote }),
  });
  return response.data;
}

export async function flagPhoto(photoId: string, photoType: PhotoType, reason: PhotoFlagReason, note?: string) {
  const response = await apiRequest<Envelope<PhotoStatus>>(`/api/photos/${photoId}/flag`, {
    method: 'POST',
    body: JSON.stringify({ photo_type: photoType, reason, ...(note ? { note } : {}) }),
  });
  return response.data;
}

export async function getPhotoStatus(photoId: string, photoType: PhotoType) {
  const response = await apiRequest<Envelope<PhotoStatus>>(`/api/photos/${photoId}/status`, {}, { photo_type: photoType });
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
  tripId?: string | null;
}) {
  const formData = new FormData();
  formData.append('file', payload.file as unknown as Blob);

  if (payload.caption) formData.append('caption', payload.caption);
  if (typeof payload.latitude === 'number') formData.append('latitude', String(payload.latitude));
  if (typeof payload.longitude === 'number') formData.append('longitude', String(payload.longitude));
  if (payload.locationName) formData.append('location_name', payload.locationName);
  if (payload.tripId) formData.append('trip_id', payload.tripId);
  formData.append('is_public', 'true');

  const response = await apiRequest<Envelope<{ id: string; url: string; thumbnail_url?: string; source?: 'media'; nature_sighting?: unknown }>>('/api/media', {
    method: 'POST',
    body: formData,
  });

  return response.data;
}

export async function deleteReviewPhoto(photoId: string) {
  return apiRequest<{ message: string }>(`/api/trails/review-photos/${photoId}`, { method: 'DELETE' });
}

export async function updateReviewPhotoCaption(photoId: string, payload: { caption?: string | null }) {
  const response = await apiRequest<Envelope<{ id: string; caption: string | null }>>(`/api/trails/review-photos/${photoId}`, {
    method: 'PATCH',
    body: JSON.stringify({ caption: payload.caption ?? null }),
  });
  return response.data;
}

export async function deleteTrailPhoto(photoId: string) {
  return apiRequest<{ message: string }>(`/api/trails/photos/${photoId}`, { method: 'DELETE' });
}

export async function updateTrailPhotoCaption(photoId: string, payload: { caption?: string | null }) {
  const response = await apiRequest<Envelope<{ id: string; caption: string | null }>>(`/api/trails/photos/${photoId}`, {
    method: 'PATCH',
    body: JSON.stringify({ caption: payload.caption ?? null }),
  });
  return response.data;
}

export async function setPrimaryTrailPhoto(photoId: string) {
  return apiRequest<{ message: string }>(`/api/trails/photos/${photoId}/primary`, { method: 'PATCH' });
}

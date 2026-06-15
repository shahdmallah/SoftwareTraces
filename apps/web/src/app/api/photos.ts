import { apiRequest } from './client';

type Envelope<T> = {
  data: T;
  message?: string;
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

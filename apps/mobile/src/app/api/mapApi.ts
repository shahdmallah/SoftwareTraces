import { apiRequest } from './client';

type Envelope<T> = {
  data: T;
};

export type MapBubble = {
  id?: string;
  lat: number;
  lng: number;
  count: number;
  media_ids: string[];
  preview_images: string[];
};

export type MapBubblePhoto = {
  id: string;
  url?: string | null;
  thumbnail_url?: string | null;
  public_url?: string | null;
  caption?: string | null;
  uploader_name?: string | null;
  uploaded_by?: string | null;
  user?: {
    id?: string;
    full_name?: string | null;
    avatar_url?: string | null;
  };
  created_at?: string | null;
  captured_at?: string | null;
  likes_count?: number;
  comments_count?: number;
  is_liked?: boolean;
  is_saved?: boolean;
};

type RawMapBubble = Partial<MapBubble> & {
  cluster_lat?: number | string | null;
  cluster_lng?: number | string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  mediaIds?: string[] | string | null;
  preview_images?: string[] | string | null;
  previewImages?: string[] | string | null;
};

function normalizeIds(value: RawMapBubble['media_ids'] | RawMapBubble['mediaIds']) {
  if (Array.isArray(value)) {
    return value.map(String).filter(Boolean);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();

    if (!trimmed) {
      return [];
    }

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map(String).filter(Boolean);
      }
    } catch {
      // Fall through to comma splitting for APIs that return "id,id,id".
    }

    return trimmed.split(',').map((id) => id.trim()).filter(Boolean);
  }

  return [];
}

function normalizeBubble(raw: RawMapBubble): MapBubble | null {
  const lat = Number(raw.lat ?? raw.cluster_lat ?? raw.latitude);
  const lng = Number(raw.lng ?? raw.cluster_lng ?? raw.longitude);
  const media_ids = normalizeIds(raw.media_ids ?? raw.mediaIds);
  const preview_images = normalizeIds(raw.preview_images ?? raw.previewImages);

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || media_ids.length === 0) {
    return null;
  }

  return {
    id: raw.id,
    lat,
    lng,
    count: Number(raw.count ?? media_ids.length),
    media_ids,
    preview_images,
  };
}

export async function getMapBubbles(params: {
  ne_lat: number;
  ne_lng: number;
  sw_lat: number;
  sw_lng: number;
  zoom: number;
}) {
  const response = await apiRequest<Envelope<RawMapBubble[]>>('/api/media/map/bubbles', {}, params);
  return response.data.map(normalizeBubble).filter((bubble): bubble is MapBubble => Boolean(bubble));
}

export async function getMapBubblePhotos(ids: string[]) {
  const response = await apiRequest<Envelope<MapBubblePhoto[]>>('/api/media/map/bubbles/photos', {}, {
    ids: ids.join(','),
  });
  return response.data;
}

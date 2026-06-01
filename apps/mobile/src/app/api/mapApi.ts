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
  photos?: MapBubblePhoto[];
};

export type MapBubblePhoto = {
  id: string;
  url?: string | null;
  thumbnail_url?: string | null;
  public_url?: string | null;
  caption?: string | null;
  source?: 'media' | 'activity_media';
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
  mediaIds?: unknown;
  media_id?: unknown;
  mediaId?: unknown;
  activity_media_ids?: unknown;
  activityMediaIds?: unknown;
  activity_media_id?: unknown;
  activityMediaId?: unknown;
  ids?: unknown;
  preview_images?: unknown;
  previewImages?: unknown;
  preview_image?: unknown;
  previewImage?: unknown;
  thumbnail_url?: unknown;
  thumbnailUrl?: unknown;
  public_url?: unknown;
  publicUrl?: unknown;
  url?: unknown;
  photos?: unknown;
  media?: unknown;
};

type RawMapBubbleResponse = RawMapBubble[] | {
  bubbles?: RawMapBubble[];
  items?: RawMapBubble[];
  data?: RawMapBubble[] | {
    bubbles?: RawMapBubble[];
    items?: RawMapBubble[];
  };
};

function stringFromUnknown(value: unknown) {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return '';
}

function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .flatMap((item) => {
        if (item && typeof item === 'object') {
          const record = item as Record<string, unknown>;
          return [
            record.id,
            record.media_id,
            record.mediaId,
            record.activity_media_id,
            record.activityMediaId,
            record.url,
            record.public_url,
            record.publicUrl,
            record.thumbnail_url,
            record.thumbnailUrl,
          ];
        }

        return [item];
      })
      .map(stringFromUnknown)
      .filter(Boolean);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();

    if (!trimmed) {
      return [];
    }

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return normalizeStringArray(parsed);
      }
    } catch {
      // Fall through to comma splitting for APIs that return "id,id,id".
    }

    const postgresArrayMatch = trimmed.match(/^\{(.*)\}$/);
    const list = postgresArrayMatch ? postgresArrayMatch[1] : trimmed;

    return list
      .split(',')
      .map((item) => item.trim().replace(/^"|"$/g, ''))
      .filter(Boolean);
  }

  const single = stringFromUnknown(value);
  if (single) {
    return [single];
  }

  return [];
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function normalizeRawBubbles(response: Envelope<RawMapBubbleResponse>) {
  const payload = response.data;

  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.data)) {
    return payload.data;
  }

  if (Array.isArray(payload?.bubbles)) {
    return payload.bubbles;
  }

  if (Array.isArray(payload?.items)) {
    return payload.items;
  }

  if (payload?.data && !Array.isArray(payload.data)) {
    return payload.data.bubbles ?? payload.data.items ?? [];
  }

  return [];
}

function normalizeBubble(raw: RawMapBubble): MapBubble | null {
  const lat = Number(raw.lat ?? raw.cluster_lat ?? raw.latitude);
  const lng = Number(raw.lng ?? raw.cluster_lng ?? raw.longitude);
  const media_ids = uniqueStrings([
    ...normalizeStringArray(raw.media_ids),
    ...normalizeStringArray(raw.mediaIds),
    ...normalizeStringArray(raw.media_id),
    ...normalizeStringArray(raw.mediaId),
    ...normalizeStringArray(raw.activity_media_ids),
    ...normalizeStringArray(raw.activityMediaIds),
    ...normalizeStringArray(raw.activity_media_id),
    ...normalizeStringArray(raw.activityMediaId),
    ...normalizeStringArray(raw.ids),
    ...normalizeStringArray(raw.media),
    ...normalizeStringArray(raw.photos),
    ...normalizeStringArray(raw.id),
  ]);
  const preview_images = uniqueStrings([
    ...normalizeStringArray(raw.preview_images),
    ...normalizeStringArray(raw.previewImages),
    ...normalizeStringArray(raw.preview_image),
    ...normalizeStringArray(raw.previewImage),
    ...normalizeStringArray(raw.thumbnail_url),
    ...normalizeStringArray(raw.thumbnailUrl),
    ...normalizeStringArray(raw.public_url),
    ...normalizeStringArray(raw.publicUrl),
    ...normalizeStringArray(raw.url),
    ...normalizeStringArray(raw.media),
    ...normalizeStringArray(raw.photos),
  ]);

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
  limit?: number;
}) {
  const response = await apiRequest<Envelope<RawMapBubbleResponse>>('/api/media/map/bubbles', {}, params);
  return normalizeRawBubbles(response).map(normalizeBubble).filter((bubble): bubble is MapBubble => Boolean(bubble));
}

export async function getMapBubblePhotos(ids: string[]) {
  const response = await apiRequest<Envelope<MapBubblePhoto[]>>('/api/media/map/bubbles/photos', {}, {
    ids: ids.join(','),
  });
  return response.data;
}

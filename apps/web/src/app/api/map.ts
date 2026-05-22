import { apiRequest } from './client';

type Envelope<T> = { data: T };

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
  created_at?: string | null;
};

type RawMapBubble = Record<string, unknown>;
type RawMapBubbleResponse = RawMapBubble[] | {
  bubbles?: RawMapBubble[];
  items?: RawMapBubble[];
  data?: RawMapBubble[] | {
    bubbles?: RawMapBubble[];
    items?: RawMapBubble[];
  };
};

function stringFromUnknown(value: unknown) {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

function toArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .flatMap((item) => {
        if (item && typeof item === 'object') {
          const record = item as RawMapBubble;
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
    if (!trimmed) return [];

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return toArray(parsed);
    } catch {
      const postgresArrayMatch = trimmed.match(/^\{(.*)\}$/);
      const list = postgresArrayMatch ? postgresArrayMatch[1] : trimmed;
      return list.split(',').map((item) => item.trim().replace(/^"|"$/g, '')).filter(Boolean);
    }
  }

  const single = stringFromUnknown(value);
  if (single) return [single];

  return [];
}

function unique(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function getRawBubbles(response: Envelope<RawMapBubbleResponse>) {
  const payload = response.data;

  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.bubbles)) return payload.bubbles;
  if (Array.isArray(payload?.items)) return payload.items;
  if (payload?.data && !Array.isArray(payload.data)) return payload.data.bubbles ?? payload.data.items ?? [];

  return [];
}

export async function getMapBubbles(params: { ne_lat: number; ne_lng: number; sw_lat: number; sw_lng: number; zoom: number }) {
  const response = await apiRequest<Envelope<RawMapBubbleResponse>>('/api/media/map/bubbles', {}, params);
  return getRawBubbles(response)
    .map((raw): MapBubble | null => {
      const lat = Number(raw.lat ?? raw.cluster_lat ?? raw.latitude);
      const lng = Number(raw.lng ?? raw.cluster_lng ?? raw.longitude);
      const mediaIds = unique([
        ...toArray(raw.media_ids),
        ...toArray(raw.mediaIds),
        ...toArray(raw.media_id),
        ...toArray(raw.mediaId),
        ...toArray(raw.activity_media_ids),
        ...toArray(raw.activityMediaIds),
        ...toArray(raw.activity_media_id),
        ...toArray(raw.activityMediaId),
        ...toArray(raw.ids),
        ...toArray(raw.media),
        ...toArray(raw.photos),
        ...toArray(raw.id),
      ]);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || mediaIds.length === 0) return null;
      return {
        id: stringFromUnknown(raw.id) || undefined,
        lat,
        lng,
        count: Number(raw.count ?? mediaIds.length),
        media_ids: mediaIds,
        preview_images: unique([
          ...toArray(raw.preview_images),
          ...toArray(raw.previewImages),
          ...toArray(raw.preview_image),
          ...toArray(raw.previewImage),
          ...toArray(raw.thumbnail_url),
          ...toArray(raw.thumbnailUrl),
          ...toArray(raw.public_url),
          ...toArray(raw.publicUrl),
          ...toArray(raw.url),
          ...toArray(raw.media),
          ...toArray(raw.photos),
        ]),
      };
    })
    .filter((bubble): bubble is MapBubble => Boolean(bubble));
}

export async function getMapBubblePhotos(ids: string[]) {
  const response = await apiRequest<Envelope<MapBubblePhoto[]>>('/api/media/map/bubbles/photos', {}, { ids: ids.join(',') });
  return response.data;
}

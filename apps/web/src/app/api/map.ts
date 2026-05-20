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

function toArray(value: unknown) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
    } catch {
      return value.split(',').map((item) => item.trim()).filter(Boolean);
    }
  }
  return [];
}

export async function getMapBubbles(params: { ne_lat: number; ne_lng: number; sw_lat: number; sw_lng: number; zoom: number }) {
  const response = await apiRequest<Envelope<any[]>>('/api/media/map/bubbles', {}, params);
  return response.data
    .map((raw): MapBubble | null => {
      const lat = Number(raw.lat ?? raw.cluster_lat ?? raw.latitude);
      const lng = Number(raw.lng ?? raw.cluster_lng ?? raw.longitude);
      const mediaIds = toArray(raw.media_ids ?? raw.mediaIds);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || mediaIds.length === 0) return null;
      return {
        id: raw.id,
        lat,
        lng,
        count: Number(raw.count ?? mediaIds.length),
        media_ids: mediaIds,
        preview_images: toArray(raw.preview_images ?? raw.previewImages),
      };
    })
    .filter((bubble): bubble is MapBubble => Boolean(bubble));
}

export async function getMapBubblePhotos(ids: string[]) {
  const response = await apiRequest<Envelope<MapBubblePhoto[]>>('/api/media/map/bubbles/photos', {}, { ids: ids.join(',') });
  return response.data;
}

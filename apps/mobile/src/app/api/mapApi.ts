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
};

export type MapBubblePhoto = {
  id: string;
  url?: string | null;
  public_url?: string | null;
  caption?: string | null;
  uploader_name?: string | null;
  uploaded_by?: string | null;
  created_at?: string | null;
  captured_at?: string | null;
  likes_count?: number;
  comments_count?: number;
  is_liked?: boolean;
  is_saved?: boolean;
};

export async function getMapBubbles(params: {
  ne_lat: number;
  ne_lng: number;
  sw_lat: number;
  sw_lng: number;
  zoom: number;
}) {
  const response = await apiRequest<Envelope<MapBubble[]>>('/api/map/bubbles', {}, params);
  return response.data;
}

export async function getMapBubblePhotos(ids: string[]) {
  const response = await apiRequest<Envelope<MapBubblePhoto[]>>('/api/map/bubbles/photos', {}, {
    ids: ids.join(','),
  });
  return response.data;
}

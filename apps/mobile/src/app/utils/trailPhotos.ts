import { getMapBubblePhotos, getMapBubbles, type MapBubblePhoto } from '../api/mapApi';
import {
  getPhotoStatus,
  getPhotoTypeForTrailPhoto,
  getTrailPhotos,
  type TrailPhoto,
} from '../api/mediaApi';
import type { Trail } from '../api/trailsApi';

const WEST_BANK_LAT_MIN = 29;
const WEST_BANK_LAT_MAX = 33.8;
const WEST_BANK_LNG_MIN = 34;
const WEST_BANK_LNG_MAX = 36.8;

type TrailPhotoSource = NonNullable<TrailPhoto['source']>;

function trailPointToLatLng(point: [number, number]): { lat: number; lng: number } | null {
  const [a, b] = point;

  if (a >= WEST_BANK_LAT_MIN && a <= WEST_BANK_LAT_MAX && b >= WEST_BANK_LNG_MIN && b <= WEST_BANK_LNG_MAX) {
    return { lat: a, lng: b };
  }

  if (a >= WEST_BANK_LNG_MIN && a <= WEST_BANK_LNG_MAX && b >= WEST_BANK_LAT_MIN && b <= WEST_BANK_LAT_MAX) {
    return { lat: b, lng: a };
  }

  if (Math.abs(a) <= 90 && Math.abs(b) <= 180) {
    return { lat: a, lng: b };
  }

  if (Math.abs(b) <= 90 && Math.abs(a) <= 180) {
    return { lat: b, lng: a };
  }

  return null;
}

function getTrailMediaBounds(trail: Trail) {
  const points = [
    ...(Array.isArray(trail.routeCoordinates) ? trail.routeCoordinates : []),
    trail.coordinates,
  ]
    .map(trailPointToLatLng)
    .filter((point): point is { lat: number; lng: number } => Boolean(point));

  if (!points.length) {
    return null;
  }

  const lats = points.map((point) => point.lat);
  const lngs = points.map((point) => point.lng);
  const latPadding = Math.max((Math.max(...lats) - Math.min(...lats)) * 0.08, 0.003);
  const lngPadding = Math.max((Math.max(...lngs) - Math.min(...lngs)) * 0.08, 0.003);

  return {
    ne_lat: Math.min(90, Math.max(...lats) + latPadding),
    ne_lng: Math.min(180, Math.max(...lngs) + lngPadding),
    sw_lat: Math.max(-90, Math.min(...lats) - latPadding),
    sw_lng: Math.max(-180, Math.min(...lngs) - lngPadding),
  };
}

function normalizeRouteMediaPhoto(photo: MapBubblePhoto): TrailPhoto | null {
  const raw = photo as MapBubblePhoto & { full_name?: string | null; avatar_url?: string | null; user_id?: string | null };
  const url = photo.url?.trim() || photo.public_url?.trim() || photo.thumbnail_url?.trim() || '';

  if (!url) {
    return null;
  }

  const source: TrailPhotoSource = photo.source === 'activity_media' ? 'activity_media' : 'media';

  return {
    id: photo.id,
    url,
    thumbnail_url: photo.thumbnail_url ?? photo.public_url ?? photo.url ?? null,
    caption: photo.caption ?? null,
    created_at: photo.created_at ?? photo.captured_at ?? undefined,
    uploaded_by: photo.uploaded_by ?? photo.uploader_name ?? photo.user?.full_name ?? raw.full_name ?? null,
    user_id: photo.user?.id ?? raw.user_id ?? null,
    source,
    helpful_score: photo.likes_count,
  };
}

function dedupePhotos(photos: TrailPhoto[]) {
  const seen = new Set<string>();
  return photos.filter((photo) => {
    const key = `${photo.source ?? 'direct'}:${photo.id || photo.url}`;
    if (!photo.url || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

export async function filterTrailPhotosByAiStatus(photos: TrailPhoto[]) {
  const checked = await Promise.all(
    photos.map(async (photo) => {
      try {
        const status = await getPhotoStatus(photo.id, getPhotoTypeForTrailPhoto(photo));
        const hasAiDecision = Boolean(status.ai_verified_at || status.ai_classification);

        if (status.manual_review_required || (hasAiDecision && !status.approved_for_trail_page)) {
          return null;
        }

        return {
          ...photo,
          approved_for_trail_page: status.approved_for_trail_page,
          manual_review_required: status.manual_review_required,
          helpful_score: status.helpful_score,
          flag_count: status.flag_count,
          quality_score: status.quality_score,
        };
      } catch {
        if (photo.manual_review_required === true || photo.approved_for_trail_page === false) {
          return null;
        }

        return photo;
      }
    }),
  );

  return checked.filter((photo): photo is TrailPhoto => Boolean(photo));
}

export async function getTrailRouteMediaPhotos(trail: Trail, limit = 100) {
  const bounds = getTrailMediaBounds(trail);
  if (!bounds) {
    return [];
  }

  const bubbles = await getMapBubbles({ ...bounds, zoom: 17, limit });
  const mediaIds = Array.from(new Set(bubbles.flatMap((bubble) => bubble.media_ids))).slice(0, limit);
  if (!mediaIds.length) {
    return [];
  }

  const mediaPhotos = await getMapBubblePhotos(mediaIds);
  return mediaPhotos.map(normalizeRouteMediaPhoto).filter((photo): photo is TrailPhoto => Boolean(photo));
}

export async function getApprovedTrailPhotos(trailId: string, trail?: Trail, routeMediaLimit = 0) {
  const [trailPhotos, routeMediaPhotos] = await Promise.all([
    getTrailPhotos(trailId).catch(() => []),
    trail && routeMediaLimit > 0 ? getTrailRouteMediaPhotos(trail, routeMediaLimit).catch(() => []) : Promise.resolve([]),
  ]);

  return filterTrailPhotosByAiStatus(dedupePhotos([...trailPhotos, ...routeMediaPhotos]));
}

export function getTrailPhotoUrls(photos: TrailPhoto[]) {
  return photos
    .map((photo) => photo.url)
    .filter((url, index, collection): url is string => Boolean(url) && collection.indexOf(url) === index);
}

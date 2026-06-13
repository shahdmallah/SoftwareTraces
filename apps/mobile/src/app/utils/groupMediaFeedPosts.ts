import type { SocialFeedItem, SocialFeedMediaItem } from '../api/socialApi';

function getPublishWindowKey(value: string) {
  const timestamp = new Date(value).getTime();

  if (!Number.isFinite(timestamp)) {
    return value;
  }

  return String(Math.floor(timestamp / (5 * 60 * 1000)));
}

function getMediaPostGroupKey(item: SocialFeedMediaItem): string {
  const trailOrLocationId = item.trail.id ?? '';
  const trailOrLocationName = (item.trail.name ?? '').trim().toLowerCase();

  if (!trailOrLocationId && !trailOrLocationName) {
    return item.id;
  }

  return [
    item.user.id,
    trailOrLocationId,
    trailOrLocationName,
    getPublishWindowKey(item.created_at),
  ].join('|');
}

function mergeMediaPosts(primary: SocialFeedMediaItem, next: SocialFeedMediaItem): SocialFeedMediaItem {
  const seenPhotoIds = new Set(primary.photos.map((photo) => photo.id));
  const mergedPhotos = [
    ...primary.photos,
    ...next.photos.filter((photo) => !seenPhotoIds.has(photo.id)),
  ];

  const primaryCreatedAt = new Date(primary.created_at).getTime();
  const nextCreatedAt = new Date(next.created_at).getTime();
  const createdAt =
    Number.isFinite(primaryCreatedAt) && Number.isFinite(nextCreatedAt)
      ? new Date(Math.min(primaryCreatedAt, nextCreatedAt)).toISOString()
      : primary.created_at;

  return {
    ...primary,
    created_at: createdAt,
    photo_url: primary.photo_url || next.photo_url || mergedPhotos[0]?.url || null,
    photos: mergedPhotos,
  };
}

export function groupSocialMediaPosts(items: SocialFeedItem[]): SocialFeedItem[] {
  const grouped: SocialFeedItem[] = [];
  const groupIndexByKey = new Map<string, number>();

  for (const item of items) {
    if (item.type !== 'media') {
      grouped.push(item);
      continue;
    }

    const key = getMediaPostGroupKey(item);
    const existingIndex = groupIndexByKey.get(key);

    if (existingIndex !== undefined) {
      grouped[existingIndex] = mergeMediaPosts(grouped[existingIndex] as SocialFeedMediaItem, item);
      continue;
    }

    groupIndexByKey.set(key, grouped.length);
    grouped.push(item);
  }

  return grouped;
}

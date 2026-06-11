import type { SocialFeedItem, SocialFeedMediaItem } from '../api/socialApi';

const MEDIA_GROUP_WINDOW_MS = 2 * 60 * 1000;

function getMediaPostGroupKey(item: SocialFeedMediaItem): string {
  const createdAt = new Date(item.created_at).getTime();
  const timeBucket = Number.isFinite(createdAt) ? Math.floor(createdAt / MEDIA_GROUP_WINDOW_MS) : 0;

  return [
    item.user.id,
    item.trail.id ?? '',
    (item.caption ?? '').trim(),
    (item.trail.name ?? '').trim(),
    timeBucket,
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

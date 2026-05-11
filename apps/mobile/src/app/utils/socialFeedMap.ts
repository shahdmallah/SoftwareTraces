import type { SocialFeedItem } from '../api/socialApi';
import type { FeedItem } from '../data/activitySocial';

export function formatFeedRelativeTime(value: string) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) {
    return 'recently';
  }

  const diffMs = Math.max(0, Date.now() - timestamp);
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(timestamp));
}

function handleFromName(userName: string) {
  return `@${userName.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '') || 'traces'}`;
}

function formatDistanceKmFromMeters(meters: number | null | undefined): string {
  if (meters == null || !Number.isFinite(Number(meters))) {
    return '—';
  }
  return `${(Number(meters) / 1000).toFixed(1)} km`;
}

export function mapSocialFeedItemToFeedItem(item: SocialFeedItem): FeedItem {
  const userName = item.user.full_name || 'Trail friend';
  const handle = handleFromName(userName);
  const relEn = formatFeedRelativeTime(item.created_at);
  const relAr = relEn;

  if (item.type === 'review') {
    const photo = item.photo_url || item.photos[0]?.url || item.trail.image || '';
    const trailId = item.trail.id ?? '';
    const ratingLabel = item.rating != null ? `${item.rating}/5` : '—';
    return {
      id: item.id,
      kind: 'recap',
      sourceType: 'review',
      userId: item.user.id,
      isLiked: item.is_liked_by_user,
      trailId,
      completionDraft: trailId
        ? {
            trailId,
            trailName: item.trail.name ?? 'Trail',
            trailImage: photo || item.trail.image || undefined,
            rating: item.rating ?? 0,
            review: item.content ?? '',
            photoUris: item.photos.map((photoItem) => photoItem.url).filter(Boolean),
            completedAtIso: item.created_at,
            durationMs: item.activity?.elapsed_time_seconds ? item.activity.elapsed_time_seconds * 1000 : 0,
            stepCount: 0,
            routePointCount: 0,
          }
        : undefined,
      user: userName,
      handle,
      avatar: item.user.avatar_url || '',
      image: photo,
      trailNameEn: item.trail.name ?? '',
      trailNameAr: item.trail.name ?? '',
      regionEn: 'Trail review',
      regionAr: 'Trail review',
      captionEn: item.content ?? '',
      captionAr: item.content ?? '',
      timeEn: relEn,
      timeAr: relAr,
      likes: item.likes_count,
      comments: item.comments_count,
      distance: ratingLabel,
    };
  }

  const caption = item.caption?.trim() || '';
  const trailImage = item.trail.image || '';
  const distanceLabel = formatDistanceKmFromMeters(item.activity?.distance_meters ?? null);
  const trailId = item.trail.id ?? '';

  return {
    id: item.id,
    kind: 'recap',
    sourceType: 'activity',
    userId: item.user.id,
    isLiked: item.is_liked_by_user,
    activityId: item.activity.id ?? undefined,
    trailId,
    completionDraft: trailId
      ? {
          activityId: item.activity.id ?? undefined,
          trailId,
          trailName: item.trail.name ?? 'Trail',
          trailImage: trailImage || undefined,
          rating: item.rating ?? 0,
          review: caption,
          photoUris: item.photos.map((photoItem) => photoItem.url).filter(Boolean),
          completedAtIso: item.created_at,
          durationMs: item.activity.elapsed_time_seconds ? item.activity.elapsed_time_seconds * 1000 : 0,
          stepCount: 0,
          routePointCount: 0,
          trailDistanceKm: item.activity.distance_meters != null ? Number(item.activity.distance_meters) / 1000 : undefined,
          trailElevationGainM: item.activity.elevation_gain_meters != null ? Number(item.activity.elevation_gain_meters) : undefined,
        }
      : undefined,
    user: userName,
    handle,
    avatar: item.user.avatar_url || '',
    image: trailImage,
    trailNameEn: item.trail.name ?? '',
    trailNameAr: item.trail.name ?? '',
    regionEn: item.visibility ? `Activity · ${item.visibility}` : 'Activity',
    regionAr: item.visibility ? `نشاط · ${item.visibility}` : 'نشاط',
    captionEn: caption,
    captionAr: caption,
    timeEn: relEn,
    timeAr: relAr,
    likes: item.likes_count,
    comments: item.comments_count,
    distance: distanceLabel,
  };
}

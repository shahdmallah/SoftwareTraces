import type { SocialFeedComment, SocialFeedItem } from '../api/socialApi';
import type { PhotoType } from '../api/mediaApi';
import type { FeedCommentPreview, FeedItem } from '../data/activitySocial';

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

function calculateAvgSpeedKph(distanceMeters: number | null | undefined, elapsedSeconds: number | null | undefined) {
  if (distanceMeters == null || elapsedSeconds == null || !Number.isFinite(distanceMeters) || !Number.isFinite(elapsedSeconds) || distanceMeters <= 0 || elapsedSeconds <= 0) {
    return undefined;
  }

  return (distanceMeters / 1000) / (elapsedSeconds / 3600);
}

function calculateAvgPaceMinPerKm(distanceMeters: number | null | undefined, elapsedSeconds: number | null | undefined) {
  if (distanceMeters == null || elapsedSeconds == null || !Number.isFinite(distanceMeters) || !Number.isFinite(elapsedSeconds) || distanceMeters <= 0 || elapsedSeconds <= 0) {
    return undefined;
  }

  return (elapsedSeconds / 60) / (distanceMeters / 1000);
}

function mapRecentComments(comments: SocialFeedComment[] | undefined): FeedCommentPreview[] {
  return (comments ?? []).map((comment) => ({
    id: comment.id,
    userId: comment.user.id,
    user: comment.user.full_name || 'Trail friend',
    avatar: comment.user.avatar_url || '',
    body: comment.body,
    createdAt: comment.created_at,
  }));
}

function getFeedPhotoType(item: SocialFeedItem): PhotoType {
  if (item.type === 'review') {
    return 'review_photo';
  }

  if (item.type === 'activity') {
    return 'activity_media';
  }

  return 'media';
}

function mapFeedPhotoEntries(item: SocialFeedItem) {
  const photoType = getFeedPhotoType(item);
  const entries = item.photos
    .map((photo) => ({
      id: photo.id,
      uri: photo.url,
      photoType,
      natureSighting: photo.nature_sighting ?? null,
    }))
    .filter((entry) => Boolean(entry.uri));

  if (entries.length) {
    return entries;
  }

  if (item.photo_url) {
    return [
      {
        id: item.id,
        uri: item.photo_url,
        photoType,
        natureSighting: null,
      },
    ];
  }

  return [];
}

export function mapSocialFeedItemToFeedItem(item: SocialFeedItem): FeedItem {
  const userName = item.user.full_name || 'Trail friend';
  const handle = handleFromName(userName);
  const relEn = formatFeedRelativeTime(item.created_at);
  const relAr = relEn;
  const photoEntries = mapFeedPhotoEntries(item);
  const photoUris = photoEntries.map((entry) => entry.uri).filter(Boolean);
  const natureSightings = item.photos
    .map((photo) => photo.nature_sighting)
    .filter((sighting): sighting is NonNullable<typeof sighting> => Boolean(sighting));

  if (item.type === 'review') {
    const photo = item.photo_url || photoUris[0] || item.trail.image || '';
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
            publisherId: item.user.id,
            publisherName: userName,
            publisherHandle: handle,
            publisherAvatar: item.user.avatar_url || '',
            trailName: item.trail.name ?? 'Trail',
            trailImage: photo || item.trail.image || undefined,
            rating: item.rating ?? 0,
            review: item.content ?? '',
            photoUris,
            natureSightings,
            completedAtIso: item.created_at,
            durationMs: item.activity?.elapsed_time_seconds ? item.activity.elapsed_time_seconds * 1000 : 0,
            stepCount: 0,
            routePointCount: 0,
            activityDistanceKm: item.activity?.distance_meters != null ? Number(item.activity.distance_meters) / 1000 : undefined,
            avgSpeedKph: calculateAvgSpeedKph(item.activity?.distance_meters, item.activity?.elapsed_time_seconds),
            avgPaceMinPerKm: calculateAvgPaceMinPerKm(item.activity?.distance_meters, item.activity?.elapsed_time_seconds),
          }
        : undefined,
      user: userName,
      handle,
      avatar: item.user.avatar_url || '',
      image: photo,
      photoEntries,
      photoUris,
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
      previewComments: mapRecentComments(item.recent_comments),
      natureSightings,
      distance: ratingLabel,
    };
  }

  if (item.type === 'media') {
    const photo = item.photo_url || photoUris[0] || item.trail.image || '';
    const trailId = item.trail.id ?? '';
    const caption = item.caption?.trim() || item.content?.trim() || '';
    const label = item.trail.name ?? (trailId ? 'Trail media' : 'Location media');

    return {
      id: item.id,
      kind: 'recap',
      sourceType: 'media',
      userId: item.user.id,
      isLiked: item.is_liked_by_user,
      photoId: item.id,
      photoType: 'media',
      trailId,
      completionDraft: undefined,
      user: userName,
      handle,
      avatar: item.user.avatar_url || '',
      image: photo,
      photoEntries,
      photoUris,
      trailNameEn: label,
      trailNameAr: label,
      regionEn: trailId ? 'Trail recap' : 'Location media',
      regionAr: trailId ? 'Trail recap' : 'Location media',
      captionEn: caption,
      captionAr: caption,
      timeEn: relEn,
      timeAr: relAr,
      likes: item.likes_count,
      comments: item.comments_count,
      previewComments: mapRecentComments(item.recent_comments),
      natureSightings,
      distance: item.photos.length > 1 ? `${item.photos.length} photos` : 'Photo',
    };
  }

  const caption = item.caption?.trim() || '';
  const trailImage = item.trail.image || '';
  const activityPhotoUris = photoUris;
  const activityCover = item.photo_url || activityPhotoUris[0] || trailImage;
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
          publisherId: item.user.id,
          publisherName: userName,
          publisherHandle: handle,
          publisherAvatar: item.user.avatar_url || '',
          trailName: item.trail.name ?? 'Trail',
          trailImage: trailImage || undefined,
          rating: item.rating ?? 0,
          review: caption,
          photoUris: activityPhotoUris,
          natureSightings,
          completedAtIso: item.created_at,
          durationMs: item.activity.elapsed_time_seconds ? item.activity.elapsed_time_seconds * 1000 : 0,
          stepCount: 0,
          routePointCount: 0,
          activityDistanceKm: item.activity.distance_meters != null ? Number(item.activity.distance_meters) / 1000 : undefined,
          avgSpeedKph: calculateAvgSpeedKph(item.activity.distance_meters, item.activity.elapsed_time_seconds),
          avgPaceMinPerKm: calculateAvgPaceMinPerKm(item.activity.distance_meters, item.activity.elapsed_time_seconds),
          trailDistanceKm: item.activity.distance_meters != null ? Number(item.activity.distance_meters) / 1000 : undefined,
          trailElevationGainM: item.activity.elevation_gain_meters != null ? Number(item.activity.elevation_gain_meters) : undefined,
        }
      : undefined,
    user: userName,
    handle,
    avatar: item.user.avatar_url || '',
    image: activityCover,
    photoEntries,
    photoUris: activityPhotoUris,
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
    previewComments: mapRecentComments(item.recent_comments),
    natureSightings,
    distance: distanceLabel,
  };
}

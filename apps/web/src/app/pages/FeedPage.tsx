import { useEffect, useState } from 'react';
import { Heart, MessageCircle, Route, Timer, Users } from 'lucide-react';
import { Link } from 'react-router';
import {
  getSocialFeed,
  likeActivity,
  likeReview,
  unlikeActivity,
  unlikeReview,
  type SocialFeedItem,
} from '../api/social';
import { getProfile } from '../api/profiles';
import { getTrailPhotos, getTrailReviews, getTrails, type Trail, type TrailPhoto, type TrailReview } from '../api/trails';
import { Carousel, CarouselContent, CarouselItem } from '../components/ui/carousel';

type FeedCardItem = {
  id: string;
  source: 'social' | 'public';
  type: 'review' | 'activity' | 'media';
  user: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
  trail: {
    id: string | null;
    name: string | null;
    image: string | null;
  };
  rating: number | null;
  title: string | null;
  content: string | null;
  caption: string | null;
  visibility: string | null;
  photo_url: string | null;
  photos: Array<{ id: string; url: string; created_at: string }>;
  activity: SocialFeedItem['activity'];
  created_at: string;
  likes_count: number;
  comments_count: number;
  is_liked_by_user: boolean;
  interactive: boolean;
  metricsAvailable: boolean;
};

type PublicProfileSummary = {
  full_name: string;
  avatar_url: string | null;
};

function displayName(value?: string | null) {
  return value?.trim() || 'Trail friend';
}

function initials(name?: string | null) {
  const letters = name?.trim().slice(0, 2).toUpperCase();
  return letters || 'TR';
}

function mapSocialItem(item: SocialFeedItem): FeedCardItem {
  return {
    ...item,
    source: 'social',
    interactive: item.type === 'review' || item.type === 'activity',
    metricsAvailable: true,
  };
}

function formatDistance(meters: number | null | undefined) {
  if (meters == null || !Number.isFinite(Number(meters))) {
    return null;
  }

  return `${(Number(meters) / 1000).toFixed(1)} km`;
}

function formatDuration(seconds: number | null | undefined) {
  if (seconds == null || !Number.isFinite(Number(seconds))) {
    return null;
  }

  const totalMinutes = Math.max(0, Math.round(Number(seconds) / 60));
  if (totalMinutes < 60) {
    return `${totalMinutes} min`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
}

function mapReviewToFeedItem(
  review: TrailReview,
  trail: Trail,
  profile: PublicProfileSummary | null,
): FeedCardItem {
  const reviewPhotos = (review.photos ?? [])
    .map((photo) => ({
      id: photo.id,
      url: photo.url,
      created_at: photo.created_at ?? review.created_at,
    }))
    .filter((photo) => Boolean(photo.url));
  const userName =
    review.user?.full_name ||
    review.profile?.full_name ||
    review.full_name ||
    profile?.full_name ||
    'Trail friend';

  return {
    id: review.id,
    source: 'public',
    type: 'review',
    user: {
      id: review.user_id ?? '',
      full_name: displayName(userName),
      avatar_url: review.user?.avatar_url ?? review.profile?.avatar_url ?? profile?.avatar_url ?? null,
    },
    trail: {
      id: trail.id,
      name: trail.name,
      image: trail.image,
    },
    rating: review.rating,
    title: review.title ?? null,
    content: review.content,
    caption: null,
    visibility: 'public',
    photo_url: reviewPhotos[0]?.url ?? null,
    photos: reviewPhotos,
    activity: null,
    created_at: review.created_at,
    likes_count: 0,
    comments_count: 0,
    is_liked_by_user: false,
    interactive: false,
    metricsAvailable: false,
  };
}

function mapPhotoToFeedItem(
  photo: TrailPhoto,
  trail: Trail,
  profile: PublicProfileSummary | null,
): FeedCardItem | null {
  const url = photo.url?.trim() || photo.thumbnail_url?.trim() || '';
  if (!url) {
    return null;
  }

  return {
    id: photo.id,
    source: 'public',
    type: 'media',
    user: {
      id: photo.uploader_id ?? photo.user_id ?? '',
      full_name: displayName(photo.uploaded_by ?? profile?.full_name),
      avatar_url: profile?.avatar_url ?? null,
    },
    trail: {
      id: trail.id,
      name: trail.name,
      image: trail.image,
    },
    rating: null,
    title: null,
    content: photo.caption ?? null,
    caption: photo.caption ?? null,
    visibility: 'public',
    photo_url: url,
    photos: [
      {
        id: photo.id,
        url,
        created_at: photo.created_at ?? new Date(0).toISOString(),
      },
    ],
    activity: null,
    created_at: photo.created_at ?? new Date(0).toISOString(),
    likes_count: 0,
    comments_count: 0,
    is_liked_by_user: false,
    interactive: false,
    metricsAvailable: false,
  };
}

async function buildPublicFeed(limit = 30): Promise<FeedCardItem[]> {
  const trails = await getTrails(1, 8);
  const trailPayloads = await Promise.all(
    trails.map(async (trail) => {
      const [reviews, photos] = await Promise.all([
        getTrailReviews(trail.id).catch(() => [] as TrailReview[]),
        getTrailPhotos(trail.id).catch(() => [] as TrailPhoto[]),
      ]);

      return { trail, reviews, photos };
    }),
  );

  const profileIds = Array.from(
    new Set(
      trailPayloads.flatMap(({ reviews, photos }) => [
        ...reviews.map((review) => review.user_id).filter((value): value is string => Boolean(value)),
        ...photos.map((photo) => photo.uploader_id ?? photo.user_id).filter((value): value is string => Boolean(value)),
      ]),
    ),
  );

  const profileEntries = await Promise.all(
    profileIds.map(async (profileId) => {
      try {
        const profile = await getProfile(profileId);
        return [
          profileId,
          {
            full_name: displayName(profile.full_name),
            avatar_url: profile.avatar_url ?? null,
          },
        ] as const;
      } catch {
        return [profileId, null] as const;
      }
    }),
  );

  const profilesById = new Map<string, PublicProfileSummary | null>(profileEntries);
  const items: FeedCardItem[] = [];

  trailPayloads.forEach(({ trail, reviews, photos }) => {
    reviews.forEach((review) => {
      items.push(mapReviewToFeedItem(review, trail, profilesById.get(review.user_id ?? '') ?? null));
    });

    photos
      .filter((photo) => photo.source !== 'review')
      .forEach((photo) => {
        const item = mapPhotoToFeedItem(photo, trail, profilesById.get(photo.uploader_id ?? photo.user_id ?? '') ?? null);
        if (item) {
          items.push(item);
        }
      });
  });

  return items
    .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
    .slice(0, limit);
}

export function FeedPage() {
  const [items, setItems] = useState<FeedCardItem[]>([]);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let cancelled = false;

    const loadFeed = async () => {
      setErrorMessage('');

      try {
        const response = await getSocialFeed({ page: 1, limit: 30, filter: 'all' });
        const socialItems = response.data.map(mapSocialItem);

        if (socialItems.length > 0) {
          if (!cancelled) {
            setItems(socialItems);
          }
          return;
        }
      } catch {
        // Fall back to public reviews and trail media when the personalized feed is unavailable.
      }

      try {
        const publicItems = await buildPublicFeed(30);
        if (!cancelled) {
          setItems(publicItems);
        }
      } catch (error) {
        if (!cancelled) {
          setItems([]);
          setErrorMessage(error instanceof Error ? error.message : 'Unable to load feed.');
        }
      }
    };

    void loadFeed();

    return () => {
      cancelled = true;
    };
  }, []);

  const toggleLike = async (item: FeedCardItem) => {
    if (!item.interactive) {
      return;
    }

    const liked = item.is_liked_by_user;

    try {
      if (item.type === 'review') {
        await (liked ? unlikeReview(item.id) : likeReview(item.id));
      } else if (item.type === 'activity' && item.activity?.id) {
        await (liked ? unlikeActivity(item.activity.id) : likeActivity(item.activity.id));
      } else {
        return;
      }

      setItems((current) =>
        current.map((row) =>
          row.source === item.source && row.id === item.id
            ? {
                ...row,
                is_liked_by_user: !liked,
                likes_count: Math.max(0, row.likes_count + (liked ? -1 : 1)),
              }
            : row,
        ),
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to update like.');
    }
  };

  const renderMedia = (item: FeedCardItem) => {
    const photoUrls = Array.from(
      new Set(
        [item.photo_url, ...item.photos.map((photo) => photo.url)].filter((url): url is string => Boolean(url)),
      ),
    );

    if (photoUrls.length === 0) {
      return null;
    }

    if (photoUrls.length === 1) {
      return <img src={photoUrls[0]} alt="" className="mb-3 h-56 w-full rounded-lg object-cover" />;
    }

    return (
      <div className="mb-3">
        <Carousel opts={{ loop: photoUrls.length > 1 }}>
          <CarouselContent className="-ml-3">
            {photoUrls.map((url, index) => (
              <CarouselItem key={`${item.source}-${item.id}-${url}-${index}`} className="basis-full pl-3">
                <img src={url} alt="" className="h-56 w-full rounded-lg object-cover" />
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-8">
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <div className="mb-6">
          <h1 className="mb-2">Community Feed</h1>
          <p className="text-secondary">Public posts, reviews, and trail media from the community.</p>
        </div>

        {errorMessage && <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{errorMessage}</div>}

        <div className="space-y-4">
          {items.length === 0 && (
            <div className="rounded-xl border border-border bg-card p-6">
              <p className="font-medium text-foreground">No feed posts yet.</p>
              <p className="mt-1 text-sm text-secondary">
                Public community reviews and trail media will appear here as soon as they are available.
              </p>
            </div>
          )}

          {items.map((item) => (
            <article key={`${item.source}-${item.id}`} className="rounded-xl border border-border bg-card p-5">
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-sm font-semibold">
                  {initials(item.user.full_name)}
                </div>
                <div>
                  <p className="font-medium text-foreground">{item.user.full_name}</p>
                  <p className="text-xs text-secondary">{new Date(item.created_at).toLocaleString()}</p>
                </div>
              </div>

              {renderMedia(item)}

              {(item.type === 'review' ? item.content : item.caption || item.content) && (
                <p className="mb-2 text-sm text-foreground">
                  {item.type === 'review' ? item.content : item.caption || item.content}
                </p>
              )}

              {item.type === 'activity' && item.activity && (
                <div className="mb-2 flex flex-wrap gap-2 text-xs text-secondary">
                  {formatDistance(item.activity.distance_meters) && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted/30 px-2.5 py-1">
                      <Route className="h-3.5 w-3.5" />
                      {formatDistance(item.activity.distance_meters)}
                    </span>
                  )}
                  {formatDuration(item.activity.elapsed_time_seconds) && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted/30 px-2.5 py-1">
                      <Timer className="h-3.5 w-3.5" />
                      {formatDuration(item.activity.elapsed_time_seconds)}
                    </span>
                  )}
                </div>
              )}

              {item.trail.id && (
                <Link to={`/trail/${item.trail.id}`} className="text-sm text-primary hover:underline">
                  {item.trail.name || 'View trail'}
                </Link>
              )}

              <div className="mt-4 flex items-center gap-4 text-sm text-secondary">
                {item.metricsAvailable ? (
                  <>
                    {item.type === 'review' || item.type === 'activity' ? (
                      <button
                        type="button"
                        onClick={() => void toggleLike(item)}
                        className="inline-flex items-center gap-1 hover:text-foreground"
                      >
                        <Heart className={`h-4 w-4 ${item.is_liked_by_user ? 'fill-primary text-primary' : ''}`} />
                        {item.likes_count}
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        <Heart className="h-4 w-4" />
                        {item.likes_count}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1">
                      <MessageCircle className="h-4 w-4" />
                      {item.comments_count}
                    </span>
                  </>
                ) : (
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    {item.type === 'review' ? 'Community review' : 'Public media'}
                  </span>
                )}

                {item.type === 'media' && (
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    Public media
                  </span>
                )}

                {item.type === 'activity' && (
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    Activity recap
                  </span>
                )}
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}

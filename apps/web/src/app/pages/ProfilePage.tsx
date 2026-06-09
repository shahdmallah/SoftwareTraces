import { useEffect, useMemo, useState } from 'react';
import { MapPin, Award, FileText, Clock, Bookmark, Download, Settings, ChevronRight, Edit, Sparkles, Heart, Shield } from 'lucide-react';
import { Link } from 'react-router';
import { StatCard } from '../components/StatCard';
import { getMe, type AuthUser } from '../api/auth';
import { getMyActivities, type Activity } from '../api/activities';
import { getMyTrailDrafts, getMyTrails, getSavedTrails } from '../api/trails';
import { getUserOfflineMaps } from '../api/offline';
import {
  getProfile,
  getProfilePhotos,
  getProfileReviews,
  type Profile,
  type ProfilePhoto,
  type ProfileReview,
} from '../api/profiles';
import { getLeaderboard, getMyAchievements, type Achievement, type LeaderboardEntry } from '../api/achievements';
import { getMyBadges, type Badge } from '../api/badges';
import {
  getRecommendationPreferences,
  updateRecommendationPreferences,
  type RecommendationPreferences,
} from '../api/recommendations';
import { getAccessToken } from '../api/client';

export function ProfilePage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [draftCount, setDraftCount] = useState(0);
  const [savedCount, setSavedCount] = useState(0);
  const [trailCount, setTrailCount] = useState(0);
  const [downloadCount, setDownloadCount] = useState(0);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [reviews, setReviews] = useState<ProfileReview[]>([]);
  const [photos, setPhotos] = useState<ProfilePhoto[]>([]);
  const [preferences, setPreferences] = useState<RecommendationPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const isGuest = !getAccessToken();

  useEffect(() => {
    if (isGuest) {
      setUser(null);
      setProfile(null);
      setActivities([]);
      setDraftCount(0);
      setSavedCount(0);
      setTrailCount(0);
      setDownloadCount(0);
      setAchievements([]);
      setErrorMessage('');
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    const loadProfile = async () => {
      setIsLoading(true);
      setErrorMessage('');

      try {
        const me = await getMe();
        const [
          profileData,
          activityList,
          drafts,
          savedTrails,
          offlineMaps,
          myTrailsResult,
          achievementsData,
          badgesData,
          leaderboardData,
          reviewsData,
          photosData,
          preferencesData,
        ] = await Promise.all([
            getProfile(me.id),
            getMyActivities(),
            getMyTrailDrafts(),
            getSavedTrails(),
            getUserOfflineMaps(),
            getMyTrails(1, 1),
            getMyAchievements(),
            getMyBadges().catch(() => []),
            getLeaderboard(10).catch(() => []),
            getProfileReviews(me.id, { limit: 6 }).catch(() => []),
            getProfilePhotos(me.id, { limit: 6 }).catch(() => []),
            getRecommendationPreferences().catch(() => null),
          ]);

        if (cancelled) return;

        setUser(me);
        setProfile(profileData);
        setActivities(activityList);
        setDraftCount(drafts.length);
        setSavedCount(savedTrails.length);
        setDownloadCount(offlineMaps.length);
        setTrailCount(myTrailsResult.pagination?.total ?? myTrailsResult.trails.length);
        setAchievements(achievementsData);
        setBadges(badgesData);
        setLeaderboard(leaderboardData);
        setReviews(reviewsData);
        setPhotos(photosData);
        setPreferences(preferencesData);
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof Error ? error.message : 'Unable to load profile information.');
        setUser(null);
        setProfile(null);
        setActivities([]);
        setDraftCount(0);
        setSavedCount(0);
        setTrailCount(0);
        setDownloadCount(0);
        setAchievements([]);
        setBadges([]);
        setLeaderboard([]);
        setReviews([]);
        setPhotos([]);
        setPreferences(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void loadProfile();
    return () => {
      cancelled = true;
    };
  }, [isGuest]);

  const displayName = profile?.full_name || user?.full_name || user?.email || (isGuest ? 'Guest explorer' : 'Traces user');
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'TR';
  const avatarUrl = profile?.avatar_url?.trim() || user?.avatar_url?.trim() || '';
  const locationText = profile?.location || user?.location || 'Location not set';
  const bioText = profile?.bio || user?.bio || '';

  const totalDistance = useMemo(() => {
    return activities.reduce((sum, activity) => sum + Number(activity.distance_km ?? (activity.distance_meters ? activity.distance_meters / 1000 : 0)), 0);
  }, [activities]);

  const totalElevation = useMemo(() => {
    return activities.reduce((sum, activity) => sum + Number(activity.elevation_gain_m ?? activity.elevation_gain_meters ?? 0), 0);
  }, [activities]);

  const stats = profile?.stats;
  const reviewCount = stats?.total_reviews ?? 0;
  const photoCount = stats?.total_photos ?? 0;
  const likesCount = stats?.total_likes_received ?? 0;
  const followerCount = stats?.total_followers ?? 0;
  const achievementCount = stats?.achievements_count ?? achievements.length;

  const earnedCount = achievements.filter((achievement) => achievement.earned || Boolean(achievement.earned_at)).length;

  const menuSections = [
    {
      title: 'My Content',
      items: [
        { icon: MapPin, label: 'Published Trails', count: trailCount, link: '/mine' },
        { icon: FileText, label: 'Drafts', count: draftCount, link: '/drafts' },
        { icon: Bookmark, label: 'Saved Trails', count: savedCount, link: '/saved' },
        { icon: Clock, label: 'History', count: activities.length, link: '/activity' },
      ],
    },
    {
      title: 'Data & Settings',
      items: [
        { icon: Download, label: 'Offline Downloads', count: downloadCount, link: '/downloads' },
        { icon: Shield, label: 'Safety Center', link: '/safety' },
        { icon: Settings, label: 'Settings', link: '#' },
      ],
    },
  ];

  const achievementCards = achievements.length
    ? achievements.slice(0, 4).map((achievement) => ({
        id: achievement.id,
        title: achievement.name,
        subtitle: achievement.description ?? '',
        earned: achievement.earned || Boolean(achievement.earned_at),
        points: achievement.points,
      }))
    : [
        { id: 'distance', title: 'Total Distance', subtitle: `${totalDistance.toFixed(1)} km logged`, earned: true, points: 0 },
        { id: 'elevation', title: 'Elevation Gain', subtitle: `${Math.round(totalElevation)} m climbed`, earned: true, points: 0 },
        { id: 'saved', title: 'Saved Trails', subtitle: `${savedCount} bookmarked`, earned: true, points: 0 },
        { id: 'offline', title: 'Offline Packs', subtitle: `${downloadCount} downloaded`, earned: true, points: 0 },
      ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pb-20 md:pb-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="bg-card rounded-xl border border-border p-12 text-center text-muted-foreground">Loading profile...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-gradient-to-br from-primary/10 to-success/10 rounded-xl border border-border p-6 mb-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
            <div className="relative flex items-center justify-center w-28 h-28 rounded-full bg-primary/10 border border-primary/20 overflow-hidden">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Profile avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="text-4xl font-semibold text-primary">{initials}</span>
              )}
              <button className="absolute bottom-0 right-0 translate-x-1/2 translate-y-1/2 rounded-full bg-primary text-white p-2 shadow-lg border border-white">
                <Edit className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-4">
                <div>
                  <h2 className="text-2xl font-semibold text-foreground">{displayName}</h2>
                  {bioText ? <p className="text-sm text-muted-foreground mt-2">{bioText}</p> : null}
                </div>
                <button className="w-full sm:w-auto px-4 py-2 bg-white border border-border rounded-lg text-sm font-medium hover:bg-muted/20 transition-colors">
                  View public profile
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-secondary text-sm mb-4">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  <span>{locationText}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  <span>{achievementCount} achievements</span>
                </div>
                <div className="flex items-center gap-2">
                  <Heart className="w-4 h-4" />
                  <span>{followerCount} followers</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="p-4 bg-white/70 rounded-2xl border border-white/60">
                  <p className="text-3xl font-semibold text-foreground">{reviewCount}</p>
                  <p className="text-xs text-secondary uppercase tracking-[0.12em]">Reviews</p>
                </div>
                <div className="p-4 bg-white/70 rounded-2xl border border-white/60">
                  <p className="text-3xl font-semibold text-foreground">{photoCount}</p>
                  <p className="text-xs text-secondary uppercase tracking-[0.12em]">Photos</p>
                </div>
                <div className="p-4 bg-white/70 rounded-2xl border border-white/60">
                  <p className="text-3xl font-semibold text-foreground">{likesCount}</p>
                  <p className="text-xs text-secondary uppercase tracking-[0.12em]">Likes</p>
                </div>
                <div className="p-4 bg-white/70 rounded-2xl border border-white/60">
                  <p className="text-3xl font-semibold text-foreground">{trailCount}</p>
                  <p className="text-xs text-secondary uppercase tracking-[0.12em]">Published</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Award className="w-5 h-5 text-accent" />
            <h3 className="text-lg font-semibold text-foreground">Achievements</h3>
            <span className="text-sm text-secondary">{earnedCount}/{achievementCount} earned</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {achievementCards.map((item) => (
              <div
                key={item.id}
                className={`border rounded-2xl p-4 transition-colors ${item.earned ? 'border-border bg-background' : 'border-muted/50 bg-muted/10'}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-foreground">{item.title}</p>
                  <span className="text-xs text-muted">{item.points ? `${item.points} pts` : ''}</span>
                </div>
                <p className="text-sm text-secondary">{item.subtitle}</p>
              </div>
            ))}
          </div>
        </div>

        {errorMessage ? (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-6">{errorMessage}</div>
        ) : null}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard icon={<MapPin className="w-4 h-4" />} label="Drafts" value={draftCount} />
          <StatCard icon={<Bookmark className="w-4 h-4" />} label="Saved" value={savedCount} />
          <StatCard icon={<Download className="w-4 h-4" />} label="Offline Packs" value={downloadCount} />
          <StatCard icon={<Clock className="w-4 h-4" />} label="Activities" value={activities.length} />
        </div>

        {badges.length > 0 && (
          <div className="bg-card rounded-xl border border-border p-6 mb-6">
            <h3 className="mb-4 text-lg font-semibold text-foreground">Earned badges</h3>
            <div className="flex flex-wrap gap-2">
              {badges.map((badge) => (
                <span key={badge.id} className="px-3 py-1 rounded-full bg-muted/30 text-sm">
                  {badge.name || badge.code}
                </span>
              ))}
            </div>
          </div>
        )}

        {leaderboard.length > 0 && (
          <div className="bg-card rounded-xl border border-border p-6 mb-6">
            <h3 className="mb-4 text-lg font-semibold text-foreground">Leaderboard</h3>
            <div className="space-y-2">
              {leaderboard.slice(0, 5).map((entry, index) => (
                <div key={entry.user_id} className="flex items-center justify-between text-sm">
                  <span>{index + 1}. {entry.full_name}</span>
                  <span className="text-secondary">{entry.total_points} pts</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {(reviews.length > 0 || photos.length > 0) && (
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            {reviews.length > 0 && (
              <div className="bg-card rounded-xl border border-border p-6">
                <h3 className="mb-4 text-lg font-semibold text-foreground">Recent reviews</h3>
                <div className="space-y-3">
                  {reviews.map((review) => (
                    <div key={review.id} className="text-sm">
                      <p className="font-medium">{review.rating}/5</p>
                      <p className="text-secondary line-clamp-2">{review.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {photos.length > 0 && (
              <div className="bg-card rounded-xl border border-border p-6">
                <h3 className="mb-4 text-lg font-semibold text-foreground">Recent photos</h3>
                <div className="grid grid-cols-3 gap-2">
                  {photos.map((photo) => (
                    <img key={photo.id} src={photo.url} alt="" className="h-20 w-full object-cover rounded-lg" />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {preferences && (
          <div className="bg-card rounded-xl border border-border p-6 mb-6">
            <h3 className="mb-4 text-lg font-semibold text-foreground">Recommendation preferences</h3>
            <div className="grid md:grid-cols-2 gap-3 text-sm">
              <label className="space-y-1">
                <span className="text-secondary">Preferred difficulties (comma-separated)</span>
                <input
                  defaultValue={preferences.preferred_difficulties.join(', ')}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2"
                  onBlur={(event) => {
                    void updateRecommendationPreferences({
                      preferred_difficulties: event.target.value.split(',').map((value) => value.trim()).filter(Boolean),
                    }).then(setPreferences);
                  }}
                />
              </label>
              <label className="space-y-1">
                <span className="text-secondary">Preferred regions (comma-separated)</span>
                <input
                  defaultValue={preferences.preferred_regions.join(', ')}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2"
                  onBlur={(event) => {
                    void updateRecommendationPreferences({
                      preferred_regions: event.target.value.split(',').map((value) => value.trim()).filter(Boolean),
                    }).then(setPreferences);
                  }}
                />
              </label>
            </div>
          </div>
        )}

        {menuSections.map((section) => (
          <div key={section.title} className="bg-card rounded-xl border border-border p-6 mb-6">
            <h3 className="mb-4 text-lg font-semibold text-foreground">{section.title}</h3>
            <div className="space-y-2">
              {section.items.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.label}
                    to={item.link}
                    className="flex items-center justify-between gap-3 p-3 rounded-2xl border border-border/70 bg-background hover:border-primary/60 hover:shadow-sm transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-5 h-5 text-secondary" />
                      <div>
                        <p className="font-medium text-foreground">{item.label}</p>
                        {item.count !== undefined ? (
                          <p className="text-xs text-muted">{item.count} items</p>
                        ) : null}
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted" />
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

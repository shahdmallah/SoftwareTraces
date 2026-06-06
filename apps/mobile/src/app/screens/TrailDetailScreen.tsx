// Updated to restore the previous trail detail layout while loading trail data from the API and syncing saved state through backend bookmarks.
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable, useWindowDimensions, Alert, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '../contexts/LanguageContext';
import { AnimatedBlock, AnimatedScreen } from '../components/AnimatedUI';
import {
  getBookmarkStatus,
  getTrailConditions,
  getTrailById,
  getTrailReviews,
  removeBookmark,
  saveBookmark,
  type Trail,
  type ConditionSeverity,
  type ConditionType,
  type TrailCondition,
  type TrailReview,
} from '../api/trailsApi';
import { useAuth } from '../contexts/AuthContext';
import { buildMapImageUri } from '../config/mapConfig';
import { buildForecast } from '../utils/weatherUtils';
import { buildMiniRoutePreviewPoints, buildSmoothPath } from '../utils/trailUtils';
import { TrailHeroSection } from '../components/TrailHeroSection';
import { TrailSummaryCard } from '../components/TrailSummaryCard';
import { TrailMapPreview } from '../components/TrailMapPreview';
import { WeatherSection } from '../components/WeatherSection';
import { ReviewsSection } from '../components/ReviewsSection';
import { CommunityPostsSection } from '../components/CommunityPostsSection';
import { useTrailTracking } from '../contexts/TrailTrackingContext';
import { getMyActivities, type Activity } from '../api/activitiesApi';
import { getSocialFeed } from '../api/socialApi';
import { downloadOfflineMap } from '../api/offlineApi';
import { getProfile, type Profile } from '../api/profilesApi';
import { formatSafetyDistance, getSafetyBand, getTrailSafety, type TrailSafety } from '../api/safetyApi';
import { type FeedItem } from '../data/activitySocial';
import { mapSocialFeedItemToFeedItem } from '../utils/socialFeedMap';
import { getApprovedTrailPhotos, getTrailPhotoUrls } from '../utils/trailPhotos';
import { getOfflineMapPacks, saveOfflineMapPack, type OfflineMapPack } from '../state/offlineMaps';

type TrailDetailScreenRouteProp = RouteProp<RootStackParamList, 'TrailDetail'>;
type TrailDetailNavigationProp = StackNavigationProp<RootStackParamList>;

const CONDITION_OPTIONS: Array<{ type: ConditionType; icon: keyof typeof Ionicons.glyphMap; label: string }> = [
  { type: 'good', icon: 'checkmark-circle-outline', label: 'Good' },
  { type: 'fair', icon: 'partly-sunny-outline', label: 'Fair' },
  { type: 'mud', icon: 'water-outline', label: 'Mud' },
  { type: 'flood', icon: 'rainy-outline', label: 'Flood' },
  { type: 'fallen_trees', icon: 'leaf-outline', label: 'Fallen trees' },
  { type: 'closure', icon: 'close-circle-outline', label: 'Closure' },
  { type: 'snow', icon: 'snow-outline', label: 'Snow' },
  { type: 'ice', icon: 'diamond-outline', label: 'Ice' },
  { type: 'wildfire', icon: 'flame-outline', label: 'Wildfire' },
];

function conditionLabel(type: ConditionType) {
  return CONDITION_OPTIONS.find((option) => option.type === type)?.label ?? type.replace(/_/g, ' ');
}

function conditionIcon(type: ConditionType): keyof typeof Ionicons.glyphMap {
  return CONDITION_OPTIONS.find((option) => option.type === type)?.icon ?? 'alert-circle-outline';
}

function conditionTone(type: ConditionType, severity?: ConditionSeverity | null) {
  if (type === 'good') return '#2E7D32';
  if (type === 'fair') return '#8A6D1D';
  if (severity === 'extreme' || type === 'closure' || type === 'wildfire' || type === 'flood') return '#9B1C1C';
  if (severity === 'high') return '#B34A2E';
  return '#630E13';
}

function formatConditionDate(value?: string) {
  if (!value) return 'Recently';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Recently';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
}

type OfflineSafetySnapshot = {
  generated_at?: string | null;
  confidence?: string | null;
  freshness?: string | null;
  report_count?: number | null;
  latest_report_at?: string | null;
  summary?: string | null;
};

function buildOfflineTrail(pack: OfflineMapPack): Trail {
  if (pack.trail) {
    return {
      ...pack.trail,
      coordinates: pack.coordinates ?? pack.trail.coordinates,
      routeCoordinates: pack.routeCoordinates?.length ? pack.routeCoordinates : pack.trail.routeCoordinates,
    };
  }

  return {
    id: pack.trailId,
    name: pack.trailName,
    nameAr: pack.trailNameAr || pack.trailName,
    region: pack.region ?? '',
    regionAr: pack.regionAr ?? pack.region ?? '',
    description: '',
    descriptionAr: '',
    distance: 0,
    duration: '',
    elevationGain: 0,
    elevationMin: 0,
    elevationMax: 0,
    difficulty: 'Easy',
    rating: 0,
    reviews: 0,
    image: '',
    images: [],
    features: [],
    featuresAr: [],
    hasCheckpoint: false,
    coordinates: pack.coordinates ?? [31.78, 35.24],
    routeCoordinates: pack.routeCoordinates,
    mapX: 0,
    mapY: 0,
    tags: [],
  };
}

function getOfflineSnapshot(pack?: OfflineMapPack | null): OfflineSafetySnapshot | null {
  if (!pack?.safetySnapshot || typeof pack.safetySnapshot !== 'object') {
    return null;
  }

  return pack.safetySnapshot as OfflineSafetySnapshot;
}

function formatRelativeUpdate(value?: string | null) {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  const diffMinutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
  if (diffMinutes < 2) return 'Updated just now';
  if (diffMinutes < 60) return `Updated ${diffMinutes} minutes ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `Updated ${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  const diffDays = Math.round(diffHours / 24);
  if (diffDays === 1) return 'Updated yesterday';
  if (diffDays < 7) return `Updated ${diffDays} days ago`;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
}

function formatLocalTime(value?: string | null) {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function countOfflineArray(value: unknown) {
  return Array.isArray(value) ? value.length : 0;
}

async function hydrateReviewProfiles(reviews: TrailReview[]): Promise<TrailReview[]> {
  const userIds = Array.from(new Set(reviews.map((review) => review.user_id).filter(Boolean)));
  if (!userIds.length) {
    return reviews;
  }

  const profileEntries = await Promise.all(
    userIds.map(async (userId) => {
      try {
        const profile = await getProfile(userId);
        return [userId, profile] as const;
      } catch {
        return [userId, null] as const;
      }
    }),
  );
  const profilesByUserId = new Map<string, Profile | null>(profileEntries);

  return reviews.map((review) => {
    const profile = profilesByUserId.get(review.user_id);
    if (!profile) {
      return review;
    }

    return {
      ...review,
      user: {
        id: profile.user_id ?? profile.id ?? review.user_id,
        full_name: profile.full_name,
        avatar_url: profile.avatar_url ?? null,
      },
      full_name: profile.full_name,
      avatar_url: profile.avatar_url ?? null,
    };
  });
}

export function TrailDetailScreen() {
  const route = useRoute<TrailDetailScreenRouteProp>();
  const navigation = useNavigation<TrailDetailNavigationProp>();
  const { trailId } = route.params;
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { t, language } = useLanguage();
  const { isAuthenticated, user } = useAuth();
  const { activeSessionTrailId, startTrailSession } = useTrailTracking();
  const isArabic = language === 'ar';
  const [trail, setTrail] = useState<Trail | null>(null);
  const [reviews, setReviews] = useState<TrailReview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [isWeatherLoading, setIsWeatherLoading] = useState(true);
  const [selectedForecastDate, setSelectedForecastDate] = useState<string | null>(null);
  const [communityPosts, setCommunityPosts] = useState<FeedItem[]>([]);
  const [trailMediaImages, setTrailMediaImages] = useState<string[]>([]);
  const [trailSafety, setTrailSafety] = useState<TrailSafety | null>(null);
  const [trailConditions, setTrailConditions] = useState<TrailCondition[]>([]);
  const [ongoingTrailActivity, setOngoingTrailActivity] = useState<Activity | null>(null);
  const [offlinePack, setOfflinePack] = useState<OfflineMapPack | null>(null);
  const [isOfflineModalVisible, setIsOfflineModalVisible] = useState(false);
  const [isDownloadingOffline, setIsDownloadingOffline] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadTrail = async () => {
      setIsLoading(true);
      setLoadError(null);

      try {
        const nextTrail = await getTrailById(trailId);
        const localPacks = await getOfflineMapPacks().catch(() => [] as OfflineMapPack[]);
        const nextOfflinePack = localPacks.find((pack) => pack.trailId === trailId) ?? null;
        const [rawReviews, nextPhotos, nextConditions] = await Promise.all([
          getTrailReviews(trailId).catch(() => []),
          getApprovedTrailPhotos(trailId, nextTrail).catch(() => []),
          getTrailConditions(trailId).catch(() => []),
        ]);
        const nextSafety = await getTrailSafety(trailId).catch(() => null);
        const nextReviews = await hydrateReviewProfiles(rawReviews);

        if (!cancelled) {
          setTrail(nextTrail);
          setOfflinePack(nextOfflinePack);
          setTrailSafety(nextSafety);
          setReviews(nextReviews);
          setTrailConditions(nextConditions);
          setTrailMediaImages(getTrailPhotoUrls(nextPhotos));
        }

        if (isAuthenticated && !cancelled) {
          try {
            const [savedStatus, completedStatus] = await Promise.all([
              getBookmarkStatus(trailId, 'favorites'),
              getBookmarkStatus(trailId, 'completed'),
            ]);
            if (!cancelled) {
              setIsSaved(savedStatus.is_saved);
              setIsCompleted(completedStatus.is_saved);
            }
          } catch {
            if (!cancelled) {
              setIsSaved(false);
              setIsCompleted(false);
            }
          }
        } else if (!isAuthenticated && !cancelled) {
          setIsSaved(false);
          setIsCompleted(false);
        }
      } catch (error) {
        const localPack = (await getOfflineMapPacks().catch(() => [] as OfflineMapPack[])).find((pack) => pack.trailId === trailId);

        if (!cancelled) {
          if (localPack) {
            const offlineTrail = buildOfflineTrail(localPack);
            setTrail(offlineTrail);
            setOfflinePack(localPack);
            setLoadError(null);
            setReviews([]);
            setTrailMediaImages(offlineTrail.image ? [offlineTrail.image] : []);
            setTrailConditions([]);
            setTrailSafety(null);
            return;
          }

          setLoadError(error instanceof Error ? error.message : 'Unable to load trail details.');
          setOfflinePack(null);
          setReviews([]);
          setTrailMediaImages([]);
          setTrailConditions([]);
          setTrailSafety(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadTrail();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, trailId]);

  useEffect(() => {
    let cancelled = false;

    const loadOngoingTrailActivity = async () => {
      if (!isAuthenticated) {
        setOngoingTrailActivity(null);
        return;
      }

      try {
        const [recordingActivities, pausedActivities] = await Promise.all([
          getMyActivities({ status: 'recording', limit: 50 }),
          getMyActivities({ status: 'paused', limit: 50 }),
        ]);
        if (cancelled) return;

        const matchingActivity = [...recordingActivities, ...pausedActivities].find(
          (activity) => activity.trail_id === trailId,
        );
        setOngoingTrailActivity(matchingActivity ?? null);
      } catch {
        if (!cancelled) {
          setOngoingTrailActivity(null);
        }
      }
    };

    void loadOngoingTrailActivity();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, trailId]);

  useEffect(() => {
    let cancelled = false;

    const loadCommunityPosts = async () => {
      try {
        const response = await getSocialFeed({ page: 1, limit: 50 });
        if (!cancelled) {
          const posts = response.data
            .filter((item) => item.type === 'activity' && item.trail.id != null && String(item.trail.id) === String(trailId))
            .map(mapSocialFeedItemToFeedItem);
          setCommunityPosts(posts);
        }
      } catch {
        if (!cancelled) {
          setCommunityPosts([]);
        }
      }
    };

    void loadCommunityPosts();

    return () => {
      cancelled = true;
    };
  }, [trailId]);

  const weeklyForecast = useMemo(() => buildForecast(trail, language), [language, trail]);
  const trailImages = useMemo(() => {
    return trailMediaImages.filter(
      (imageUri, index, collection): imageUri is string =>
        Boolean(imageUri) && collection.indexOf(imageUri) === index,
    );
  }, [trailMediaImages]);
  const miniRoutePoints = useMemo(() => buildMiniRoutePreviewPoints(trail?.routeCoordinates), [trail?.routeCoordinates]);
  const miniRoutePath = useMemo(() => buildSmoothPath(miniRoutePoints), [miniRoutePoints]);
  const mapImageUri = useMemo(() => {
    if (!trail) return '';
    const [lat, lng] = trail.coordinates;
    return buildMapImageUri(lng, lat);
  }, [trail]);
  const offlineSnapshot = useMemo(() => getOfflineSnapshot(offlinePack), [offlinePack]);
  const offlineUpdatedAt = offlineSnapshot?.generated_at ?? offlinePack?.generatedAt ?? offlinePack?.downloadedAt ?? null;
  const offlineCheckpointCount = countOfflineArray(offlinePack?.checkpointReports);
  const offlineDangerZoneCount = countOfflineArray(offlinePack?.safetyMarkers ?? offlinePack?.safetyAlerts);
  const offlineConfidence = offlineSnapshot?.confidence
    ? offlineSnapshot.confidence.charAt(0).toUpperCase() + offlineSnapshot.confidence.slice(1)
    : 'Unknown';

  useEffect(() => {
    setActiveImageIndex(0);
  }, [trailImages]);

  useEffect(() => {
    setIsWeatherLoading(true);
    setWeatherError(null);

    if (!trail) {
      setIsWeatherLoading(false);
      setWeatherError('Trail not found.');
      return;
    }

    if (!weeklyForecast.length) {
      setIsWeatherLoading(false);
      setWeatherError('No hourly forecast available.');
      return;
    }

    setSelectedForecastDate((current) => {
      if (current && weeklyForecast.some((day) => day.date === current)) {
        return current;
      }
      return weeklyForecast[0]?.date ?? null;
    });
    setIsWeatherLoading(false);
  }, [trail, weeklyForecast]);

  const openMapPreview = () => {
    navigation.navigate('AppTabs', {
      screen: 'Map',
      params: { selectedTrailId: trail!.id },
    });
  };

  const handleDownloadOfflinePackage = async () => {
    if (!isAuthenticated) {
      setIsOfflineModalVisible(false);
      navigation.navigate('Auth', { mode: 'signin' });
      return;
    }

    if (!trail || isDownloadingOffline) {
      return;
    }

    setIsDownloadingOffline(true);

    try {
      const map = await downloadOfflineMap(trail.id);
      const nextPack: OfflineMapPack = {
        trailId: map.trailId,
        trailName: map.trailName ?? trail.name,
        trailNameAr: map.trailNameAr ?? trail.nameAr,
        region: map.region ?? trail.region,
        regionAr: map.regionAr ?? trail.regionAr,
        coordinates: map.coordinates ?? trail.coordinates,
        routeCoordinates: map.routeCoordinates?.length ? map.routeCoordinates : trail.routeCoordinates,
        tileRegion: map.tileRegion,
        tileUrlTemplate: map.tileUrlTemplate,
        downloadedAt: new Date().toISOString(),
        trail: map.trail ?? trail,
        safetyAlerts: map.safetyAlerts,
        safetyMarkers: map.safetyMarkers,
        checkpointReports: map.checkpointReports,
        accessRoute: map.accessRoute,
        elevationProfile: map.elevationProfile,
        safetySnapshot: map.safetySnapshot,
        generatedAt: map.generatedAt,
      };

      await saveOfflineMapPack(nextPack);
      setOfflinePack(nextPack);
      setIsOfflineModalVisible(false);
      Alert.alert('Saved Offline', 'Trail and safety context are now available without internet.');
    } catch (error) {
      Alert.alert(
        isArabic ? '\u062a\u0639\u0630\u0631 \u0627\u0644\u062a\u062d\u0645\u064a\u0644' : 'Unable to download',
        error instanceof Error ? error.message : isArabic ? '\u062d\u0627\u0648\u0644 \u0645\u0631\u0629 \u0623\u062e\u0631\u0649.' : 'Please try again.',
      );
    } finally {
      setIsDownloadingOffline(false);
    }
  };

  const openMediaGallery = () => {
    navigation.navigate('TrailMedia', { trailId: trail!.id });
  };

  const openAllReviews = () => {
    navigation.navigate('AllReviews', {
      trailId: trail!.id,
      trailName: isArabic ? trail!.nameAr || trail!.name : trail!.name,
    });
  };

  const openTrailRecording = async () => {
    if (activeSessionTrailId === trail!.id) {
      navigation.navigate('Recording', { trailId: trail!.id });
      return;
    }

    if (ongoingTrailActivity?.trail_id === trail!.id) {
      navigation.navigate('Recording', { trailId: trail!.id, activityId: ongoingTrailActivity.id });
      return;
    }

    if (trailSafety && trailSafety.safety_score < 60) {
      const band = getSafetyBand(trailSafety.safety_score);
      Alert.alert(
        `${band.label} safety warning`,
        `This trail has a safety score of ${trailSafety.safety_score}/100. Review the warnings before starting.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Start anyway',
            style: 'destructive',
            onPress: () => {
              void (async () => {
                if (activeSessionTrailId !== trail!.id) {
                  await startTrailSession(trail!.id);
                }
                navigation.navigate('Recording', { trailId: trail!.id });
              })();
            },
          },
        ],
      );
      return;
    }

    if (activeSessionTrailId !== trail!.id) {
      await startTrailSession(trail!.id);
    }
    navigation.navigate('Recording', { trailId: trail!.id });
  };

  const toggleSaved = async () => {
    if (!isAuthenticated) {
      navigation.navigate('Auth', { mode: 'signin' });
      return;
    }

    setIsSaving(true);
    try {
      if (isSaved) {
        await removeBookmark({ trailId: trail!.id, type: 'favorites' });
        setIsSaved(false);
      } else {
        await saveBookmark({ trailId: trail!.id, type: 'favorites' });
        setIsSaved(true);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const toggleCompleted = async () => {
    if (!isAuthenticated) {
      navigation.navigate('Auth', { mode: 'signin' });
      return;
    }

    setIsCompleting(true);
    try {
      if (isCompleted) {
        await removeBookmark({ trailId: trail!.id, type: 'completed' });
        setIsCompleted(false);
      } else {
        await saveBookmark({ trailId: trail!.id, type: 'completed' });
        setIsCompleted(true);
      }
    } finally {
      setIsCompleting(false);
    }
  };

  const handleImageScroll = (event: any) => {
    setActiveImageIndex(Math.round(event.nativeEvent.contentOffset.x / windowWidth));
  };

  if (isLoading) {
    return (
      <AnimatedScreen style={styles.container}>
        <View style={styles.weatherLoading}>
          <ActivityIndicator color='#630E13' />
        </View>
      </AnimatedScreen>
    );
  }

  if (!trail) {
    return (
      <AnimatedScreen style={styles.container}>
        <Text style={styles.notFound}>{loadError ?? t('trailNotFound')}</Text>
      </AnimatedScreen>
    );
  }

  const posts = communityPosts;
  const isThisTrailActive = activeSessionTrailId === trail.id || ongoingTrailActivity?.trail_id === trail.id;
  const safetyBand = trailSafety ? getSafetyBand(trailSafety.safety_score) : null;
  const canOpenTrailThread = isAuthenticated;
  const planTripButton = (
    <Pressable
      style={styles.planTripButton}
      onPress={() => navigation.navigate('ActivityShareComposer', {
        type: 'plan',
        trailId: trail.id,
        trailName: isArabic ? trail.nameAr || trail.name : trail.name,
        initialMeetingLat: trail.coordinates[0],
        initialMeetingLng: trail.coordinates[1],
      })}
    >
      <View style={styles.planTripIcon}>
        <Ionicons name="calendar-outline" size={20} color="#FFF" />
      </View>
      <View style={styles.planTripCopy}>
        <Text style={[styles.planTripLabel, isArabic ? { textAlign: 'right' } : null]}>
          {isArabic ? 'خطط لرحلة هذا المسار' : 'Plan a trip for this trail'}
        </Text>
       
      </View>
    </Pressable>
  );

  return (
    <AnimatedScreen style={styles.container}>
      <ScrollView
        style={styles.container}
        nestedScrollEnabled
        contentContainerStyle={{ paddingBottom: Math.max(150, insets.bottom + 138) }}
        showsVerticalScrollIndicator={false}
      >
        <AnimatedBlock delay={40}>
          <TrailHeroSection
            trailImages={trailImages}
            activeImageIndex={activeImageIndex}
            onImageScroll={handleImageScroll}
            onBackPress={() => navigation.goBack()}
            onSavePress={toggleSaved}
            onGalleryPress={openMediaGallery}
            onMapPress={openMapPreview}
            isSaved={isSaved}
            isSaving={isSaving}
            miniRoutePath={miniRoutePath}
            mapImageUri={mapImageUri}
          />
        </AnimatedBlock>

        <View style={styles.content}>
          <AnimatedBlock delay={110}>
            <TrailSummaryCard trail={trail} isArabic={isArabic} />
          </AnimatedBlock>

          <AnimatedBlock delay={130}>
            <View style={[styles.offlineSafetyCard, offlinePack && styles.offlineSafetyCardReady]}>
              <View style={[styles.offlineSafetyHeader, isArabic ? { flexDirection: 'row-reverse' } : null]}>
                <View style={[styles.offlineSafetyIcon, offlinePack && styles.offlineSafetyIconReady]}>
                  <Ionicons name={offlinePack ? 'cloud-done-outline' : 'shield-checkmark-outline'} size={21} color={offlinePack ? '#1E7A46' : '#630E13'} />
                </View>
                <View style={styles.offlineSafetyCopy}>
                  <Text style={[styles.offlineSafetyTitle, isArabic ? { textAlign: 'right' } : null]}>
                    {offlinePack ? 'Available Offline' : 'Download Offline Safety Map'}
                  </Text>
                  <Text style={[styles.offlineSafetySub, isArabic ? { textAlign: 'right' } : null]}>
                    {offlinePack
                      ? `Safety Snapshot: ${formatRelativeUpdate(offlineUpdatedAt)}`
                      : 'Preserve trail access and safety context for weak connectivity areas.'}
                  </Text>
                  {offlinePack ? (
                    <Text style={[styles.offlineSafetyMeta, isArabic ? { textAlign: 'right' } : null]}>
                      Confidence: {offlineConfidence}
                    </Text>
                  ) : null}
                </View>
              </View>

              {offlinePack ? (
                <View style={styles.offlineSnapshotGrid}>
                  <View style={styles.offlineSnapshotItem}>
                    <Text style={styles.offlineSnapshotValue}>{offlineCheckpointCount}</Text>
                    <Text style={styles.offlineSnapshotLabel}>Checkpoints</Text>
                  </View>
                  <View style={styles.offlineSnapshotItem}>
                    <Text style={styles.offlineSnapshotValue}>{offlineDangerZoneCount}</Text>
                    <Text style={styles.offlineSnapshotLabel}>Danger zones</Text>
                  </View>
                </View>
              ) : null}

              <Pressable
                style={[styles.offlineDownloadButton, isDownloadingOffline && styles.offlineDownloadButtonDisabled]}
                onPress={() => setIsOfflineModalVisible(true)}
                disabled={isDownloadingOffline}
              >
                {isDownloadingOffline ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Ionicons name={offlinePack ? 'refresh-outline' : 'download-outline'} size={17} color="#fff" />
                )}
                <Text style={styles.offlineDownloadButtonText}>
                  {isDownloadingOffline
                    ? 'Saving trail and safety data...'
                    : offlinePack
                    ? 'Update Offline Snapshot'
                    : 'Download Offline Safety Map'}
                </Text>
              </Pressable>
            </View>
          </AnimatedBlock>

          {trailSafety && safetyBand ? (
            <AnimatedBlock delay={145}>
              <View style={[styles.safetyCard, { borderColor: `${safetyBand.color}33` }]}>
                <View style={styles.safetyHeader}>
                  <View style={[styles.safetyIcon, { backgroundColor: safetyBand.color }]}>
                    <Ionicons name="shield-checkmark-outline" size={20} color="#fff" />
                  </View>
                  <View style={styles.safetyHeaderCopy}>
                    <Text style={styles.safetyTitle}>Safety score</Text>
                    <Text style={[styles.safetyScore, { color: safetyBand.color }]}>
                      {trailSafety.safety_score}/100 ({safetyBand.label})
                    </Text>
                  </View>
                </View>

                {trailSafety.warnings.length ? (
                  <View style={styles.safetyWarnings}>
                    {trailSafety.warnings.slice(0, 3).map((warning) => (
                      <View key={warning} style={styles.safetyWarningRow}>
                        <Ionicons name="alert-circle-outline" size={15} color={safetyBand.color} />
                        <Text style={styles.safetyWarningText}>{warning}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}

                <View style={styles.safetyMetaGrid}>
                  <View style={styles.safetyMetaItem}>
                    <Text style={styles.safetyMetaLabel}>Nearest settlement</Text>
                    <Text style={styles.safetyMetaValue}>
                      {trailSafety.nearest_settlement
                        ? `${trailSafety.nearest_settlement.name} (${formatSafetyDistance(trailSafety.nearest_settlement.distance_meters)})`
                        : 'None nearby'}
                    </Text>
                  </View>
                  <View style={styles.safetyMetaItem}>
                    <Text style={styles.safetyMetaLabel}>Nearest checkpoint</Text>
                    <Text style={styles.safetyMetaValue}>
                      {trailSafety.nearest_checkpoint
                        ? `${trailSafety.nearest_checkpoint.name} (${formatSafetyDistance(trailSafety.nearest_checkpoint.distance_meters)})`
                        : 'None nearby'}
                    </Text>
                  </View>
                  <View style={styles.safetyMetaItem}>
                    <Text style={styles.safetyMetaLabel}>Incidents in 48h</Text>
                    <Text style={styles.safetyMetaValue}>{trailSafety.incident_count_48h}</Text>
                  </View>
                </View>
                <Pressable
                  style={styles.safetyReportButton}
                  onPress={() => navigation.navigate('ReportIssue', {
                    latitude: trail.coordinates[0],
                    longitude: trail.coordinates[1],
                    locationName: isArabic ? trail.nameAr || trail.name : trail.name,
                  })}
                >
                  <Ionicons name="warning-outline" size={16} color="#630E13" />
                  <Text style={styles.safetyReportButtonText}>Report an incident near this trail</Text>
                </Pressable>
              </View>
            </AnimatedBlock>
          ) : null}

        <AnimatedBlock delay={170}>
  <View style={styles.actionRow}>
    <Pressable
      style={[styles.completedButton, isCompleted && styles.completedButtonActive, isCompleting && styles.completedButtonDisabled]}
      onPress={toggleCompleted}
      disabled={isCompleting}
    >
      <View style={styles.completedButtonHeader}>
        <View style={[styles.completedButtonIcon, isCompleted && styles.completedButtonIconActive]}>
          {isCompleting ? (
            <ActivityIndicator size="small" color={isCompleted ? '#fff' : '#630E13'} />
          ) : (
            <Ionicons name={isCompleted ? 'flag' : 'flag-outline'} size={14} color={isCompleted ? '#fff' : '#630E13'} />
          )}
        </View>
        <Text style={[styles.completedButtonTitle, isCompleted && styles.completedButtonTitleActive, isArabic ? { textAlign: 'right' } : null]}>
          {isCompleted ? (isArabic ? 'تم تحديده كمكتمل' : 'Marked as completed') : isArabic ? 'تحديد المسار كمكتمل' : 'Mark as completed'}
        </Text>
      </View>
      <Text style={[styles.completedButtonSubtitle, isArabic ? { textAlign: 'right' } : null]}>
        {isCompleted
          ? isArabic
            ? 'يمكنك الرجوع وتغيير الحالة في أي وقت.'
            : 'You can change this status any time.'
          : isArabic
          ? 'أضف إلى مجموعة المسارات التي زرتها'
          : 'add to your completed trails.'}
      </Text>
    </Pressable>

    <Pressable style={styles.recordButton} onPress={openTrailRecording}>
      <View style={styles.recordButtonHeader}>
        <View style={styles.recordButtonIcon}>
          <Ionicons name="radio-outline" size={14} color="#fff" />
        </View>
        <Text style={[styles.recordButtonTitle, isArabic ? { textAlign: 'right' } : null]}>
          {isThisTrailActive ? (isArabic ? 'العودة إلى الرحلة' : 'Return to your hike') : isArabic ? 'ابدأ رحلتك' : 'Start your journey'}
        </Text>
      </View>
      <Text style={[styles.recordButtonSubtitle, isArabic ? { textAlign: 'right' } : null]}>
        {isThisTrailActive
          ? isArabic
            ? 'التتبع لا يزال نشطاً ويمكنك العودة إليه في أي وقت.'
            : 'Tracking is still live and you can jump back in any time.'
          : isArabic
          ? 'تتبع الوقت والخطوات والموقع والصور.'
          : 'Track time, steps, live location, and photo pins.'}
      </Text>
    </Pressable>
  </View>
</AnimatedBlock>

          {canOpenTrailThread ? (
            <AnimatedBlock delay={180}>
              <Pressable
                style={styles.askTrailButton}
                onPress={() => navigation.navigate('ActivityThread', {
                  participantName: isArabic ? trail.nameAr || trail.name : trail.name,
                  contextType: 'trail',
                  contextId: trail.id,
                  contextTitle: isArabic ? trail.nameAr || trail.name : trail.name,
                  contextSubtitle: isArabic ? 'نقاش عام حول المسار' : 'Public trail discussion',
                })}
              >
                <View style={styles.askTrailIcon}>
                  <Ionicons name="chatbubble-ellipses-outline" size={18} color="#fff" />
                </View>
                <View style={styles.askTrailCopy}>
                  <Text style={[styles.askTrailTitle, isArabic ? { textAlign: 'right' } : null]}>
                    {isArabic ? 'نقاش المسار' : 'Trail discussion'}
                  </Text>
                  <Text style={[styles.askTrailSubtitle, isArabic ? { textAlign: 'right' } : null]}>
                    {isArabic ? 'افتح محادثة عامة مرتبطة بتفاصيل المسار.' : 'Open the public conversation linked to this trail.'}
                  </Text>
                </View>
                <Ionicons name={isArabic ? 'chevron-back' : 'chevron-forward'} size={18} color="#8A7A6A" />
              </Pressable>
            </AnimatedBlock>
          ) : null}

          <AnimatedBlock delay={190}>
            <Pressable
              style={styles.gettingThereCard}
              onPress={() => navigation.navigate('TrailAccess', {
                trailId: trail.id,
                trailName: isArabic ? trail.nameAr || trail.name : trail.name,
              })}
            >
              <View style={styles.gettingThereIcon}>
                <Ionicons name="car-outline" size={20} color="#630E13" />
              </View>
              <View style={styles.gettingThereCopy}>
                <Text style={[styles.gettingThereTitle, isArabic ? { textAlign: 'right' } : null]}>
                  {isArabic ? 'الوصول إلى بداية المسار' : 'Getting There'}
                </Text>
                <Text style={[styles.gettingThereSubtitle, isArabic ? { textAlign: 'right' } : null]}>
                  {isArabic ? 'اعرض الطريق، الحواجز، والتنبيهات قبل الانطلاق.' : 'Open route, checkpoint, and access safety details.'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#8A7A6A" />
            </Pressable>
          </AnimatedBlock>

          <AnimatedBlock delay={210}>
            <TrailMapPreview
              trail={trail}
              miniRoutePoints={miniRoutePoints}
              miniRoutePath={miniRoutePath}
              mapImageUri={mapImageUri}
              onPress={openMapPreview}
            />
          </AnimatedBlock>

          <AnimatedBlock delay={250}>
            <View style={styles.conditionsCard}>
              <View style={styles.conditionsHeader}>
                <View>
                  <Text style={[styles.conditionsTitle, isArabic ? { textAlign: 'right' } : null]}>
                    {isArabic ? 'حالة المسار' : 'Trail conditions'}
                  </Text>
                  <Text style={[styles.conditionsSub, isArabic ? { textAlign: 'right' } : null]}>
                    {isArabic ? 'تقارير حديثة من المجتمع' : 'Recent community reports'}
                  </Text>
                </View>
                <View style={styles.conditionsCountPill}>
                  <Text style={styles.conditionsCountText}>{trailConditions.length}</Text>
                </View>
              </View>

              {trailConditions.length ? (
                <View style={styles.conditionList}>
                  {trailConditions.slice(0, 4).map((condition) => {
                    const tone = conditionTone(condition.condition_type, condition.severity);
                    return (
                      <View key={condition.id} style={styles.conditionRow}>
                        <View style={[styles.conditionIcon, { backgroundColor: `${tone}18` }]}>
                          <Ionicons name={conditionIcon(condition.condition_type)} size={18} color={tone} />
                        </View>
                        <View style={styles.conditionCopy}>
                          <Text style={[styles.conditionName, isArabic ? { textAlign: 'right' } : null]}>
                            {conditionLabel(condition.condition_type)}
                            {condition.severity ? ` · ${condition.severity}` : ''}
                          </Text>
                          {condition.description ? (
                            <Text style={[styles.conditionDescription, isArabic ? { textAlign: 'right' } : null]} numberOfLines={2}>
                              {condition.description}
                            </Text>
                          ) : null}
                        </View>
                        <Text style={styles.conditionDate}>{formatConditionDate(condition.reported_at)}</Text>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.noConditions}>
                  <Ionicons name="trail-sign-outline" size={24} color="#8A7A6A" />
                  <Text style={[styles.noConditionsText, isArabic ? { textAlign: 'right' } : null]}>
                    {isArabic ? 'لا توجد تقارير حالة بعد.' : 'No condition reports yet.'}
                  </Text>
                </View>
              )}

              <Text style={[styles.conditionsReportHint, isArabic ? { textAlign: 'right' } : null]}>
                {isArabic ? 'يمكنك إضافة تقرير حالة بعد إكمال المسار.' : 'You can report trail conditions after completing this trail.'}
              </Text>
            </View>
          </AnimatedBlock>

          <AnimatedBlock delay={290}>
            <WeatherSection
              weeklyForecast={weeklyForecast}
              selectedForecastDate={selectedForecastDate}
              onSelectForecastDate={setSelectedForecastDate}
              isWeatherLoading={isWeatherLoading}
              weatherError={weatherError}
              trail={trail}
            />
          </AnimatedBlock>

          <AnimatedBlock delay={330}>
            <ReviewsSection
              reviews={reviews}
              trailId={trail.id}
              isArabic={isArabic}
              isAuthenticated={isAuthenticated}
              currentUserId={user?.id}
              onRequireAuth={() => navigation.navigate('Auth', { mode: 'signin' })}
              onViewAllReviews={openAllReviews}
              onOpenProfile={(profileId) => navigation.navigate('PublicProfile', { profileId })}
              onReviewAdded={(review) => setReviews((current) => [review, ...current])}
              onReviewDeleted={(reviewId) => setReviews((current) => current.filter((review) => review.id !== reviewId))}
            />
          </AnimatedBlock>

          <AnimatedBlock delay={370}>
            <CommunityPostsSection
              posts={posts}
              onOpenActivity={() => navigation.navigate('AppTabs', { screen: 'Activity' })}
              onOpenProfile={(profileId) => navigation.navigate('PublicProfile', { profileId })}
            />
          </AnimatedBlock>

          {offlinePack ? (
            <AnimatedBlock delay={390}>
              <View style={styles.emergencyOfflineCard}>
                <View style={styles.emergencyHeader}>
                  <View style={styles.emergencyIcon}>
                    <Ionicons name="medical-outline" size={20} color="#fff" />
                  </View>
                  <Text style={[styles.emergencyTitle, isArabic ? { textAlign: 'right' } : null]}>
                    Emergency Information
                  </Text>
                </View>

                <View style={styles.emergencyRows}>
                  <View style={styles.emergencyRow}>
                    <Text style={styles.emergencyLabel}>Trailhead Coordinates</Text>
                    <Text style={styles.emergencyValue}>{trail.coordinates[0].toFixed(4)}, {trail.coordinates[1].toFixed(4)}</Text>
                  </View>
                  <View style={styles.emergencyRow}>
                    <Text style={styles.emergencyLabel}>Nearest Access Road</Text>
                    <Text style={styles.emergencyValue}>{offlinePack.accessRoute ? 'Saved offline' : 'Trailhead saved offline'}</Text>
                  </View>
                  <View style={styles.emergencyRow}>
                    <Text style={styles.emergencyLabel}>Last Safety Update</Text>
                    <Text style={styles.emergencyValue}>{formatLocalTime(offlineUpdatedAt)}</Text>
                  </View>
                </View>

                <View style={styles.emergencyFooter}>
                  <Ionicons name="lock-closed-outline" size={14} color="#1E7A46" />
                  <Text style={styles.emergencyFooterText}>Offline safety data stored locally</Text>
                </View>
              </View>
            </AnimatedBlock>
          ) : null}

        </View>
      </ScrollView>
      <Modal
        visible={isOfflineModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsOfflineModalVisible(false)}
      >
        <View style={styles.offlineModalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => !isDownloadingOffline && setIsOfflineModalVisible(false)} />
          <View style={styles.offlineModalCard}>
            <View style={styles.offlineModalHandle} />
            <View style={styles.offlineModalIcon}>
              <Ionicons name="shield-checkmark-outline" size={24} color="#630E13" />
            </View>
            <Text style={styles.offlineModalTitle}>Offline Package Includes</Text>
            <View style={styles.offlineModalList}>
              {[
                'Trail geometry',
                'Elevation profile',
                'Safety checkpoints',
                'Danger zones nearby',
                'Access route snapshot',
                'Safety status snapshot',
              ].map((item) => (
                <View key={item} style={styles.offlineModalListItem}>
                  <Ionicons name="checkmark-circle" size={17} color="#1E7A46" />
                  <Text style={styles.offlineModalListText}>{item}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.offlineModalEstimate}>Estimated size: 3.2 MB</Text>
            <Pressable
              style={[styles.offlineModalButton, isDownloadingOffline && styles.offlineDownloadButtonDisabled]}
              onPress={handleDownloadOfflinePackage}
              disabled={isDownloadingOffline}
            >
              {isDownloadingOffline ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Ionicons name="download-outline" size={18} color="#fff" />
              )}
              <Text style={styles.offlineModalButtonText}>
                {isDownloadingOffline ? 'Saving trail and safety data...' : 'Download Package'}
              </Text>
            </Pressable>
            <Pressable style={styles.offlineModalCancel} onPress={() => setIsOfflineModalVisible(false)} disabled={isDownloadingOffline}>
              <Text style={styles.offlineModalCancelText}>Not now</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      <View style={[styles.stickyPlanTripWrap, { paddingBottom: Math.max(insets.bottom + 10, 18) }]}>
        {planTripButton}
      </View>
    </AnimatedScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fefefd',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 20,
  },
  weatherLoading: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stickyPlanTripWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: 'rgba(254,254,253,0.94)',
    shadowColor: '#2C1A0E',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: -8 },
    shadowRadius: 18,
    elevation: 12,
  },
  planTripButton: {
    padding: 18,
    borderRadius: 22,
    backgroundColor: '#630E13',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  planTripIcon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  planTripCopy: {
    flex: 1,
  },
  planTripLabel: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
  },
  planTripSub: {
    marginTop: 4,
    color: 'rgba(255,255,255,0.82)',
    fontSize: 12,
    lineHeight: 18,
  },
  notFound: {
    padding: 16,
    color: '#2C2418',
  },
  offlineSafetyCard: {
    borderRadius: 22,
    padding: 15,
    backgroundColor: '#FFF8F1',
    borderWidth: 1,
    borderColor: '#E8D9C7',
    gap: 14,
  },
  offlineSafetyCardReady: {
    backgroundColor: '#F2FAF3',
    borderColor: '#B9DFC1',
  },
  offlineSafetyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  offlineSafetyIcon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: '#F7EBE8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  offlineSafetyIconReady: {
    backgroundColor: '#E4F4E7',
  },
  offlineSafetyCopy: {
    flex: 1,
  },
  offlineSafetyTitle: {
    color: '#2C2418',
    fontSize: 17,
    fontWeight: '900',
  },
  offlineSafetySub: {
    marginTop: 4,
    color: '#6B5D4E',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  offlineSafetyMeta: {
    marginTop: 5,
    color: '#1E7A46',
    fontSize: 12,
    fontWeight: '900',
  },
  offlineSnapshotGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  offlineSnapshotItem: {
    flex: 1,
    borderRadius: 14,
    padding: 11,
    backgroundColor: 'rgba(255,255,255,0.75)',
  },
  offlineSnapshotValue: {
    color: '#2C2418',
    fontSize: 18,
    fontWeight: '900',
  },
  offlineSnapshotLabel: {
    marginTop: 3,
    color: '#6B5D4E',
    fontSize: 11,
    fontWeight: '800',
  },
  offlineDownloadButton: {
    minHeight: 46,
    borderRadius: 16,
    backgroundColor: '#630E13',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  offlineDownloadButtonDisabled: {
    opacity: 0.72,
  },
  offlineDownloadButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
  offlineModalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(18,4,8,0.46)',
  },
  offlineModalCard: {
    margin: 16,
    borderRadius: 26,
    padding: 18,
    backgroundColor: '#FFFEF9',
  },
  offlineModalHandle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E2D7C8',
    marginBottom: 16,
  },
  offlineModalIcon: {
    width: 50,
    height: 50,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F7EBE8',
  },
  offlineModalTitle: {
    marginTop: 14,
    color: '#2C2418',
    fontSize: 20,
    fontWeight: '900',
  },
  offlineModalList: {
    marginTop: 15,
    gap: 10,
  },
  offlineModalListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  offlineModalListText: {
    color: '#4A4131',
    fontSize: 14,
    fontWeight: '800',
  },
  offlineModalEstimate: {
    marginTop: 18,
    color: '#6B5D4E',
    fontSize: 13,
    fontWeight: '900',
  },
  offlineModalButton: {
    marginTop: 14,
    minHeight: 50,
    borderRadius: 17,
    backgroundColor: '#630E13',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  offlineModalButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  offlineModalCancel: {
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  offlineModalCancelText: {
    color: '#6B5D4E',
    fontSize: 13,
    fontWeight: '800',
  },
  emergencyOfflineCard: {
    borderRadius: 24,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D8E8D9',
  },
  emergencyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  emergencyIcon: {
    width: 40,
    height: 40,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E7A46',
  },
  emergencyTitle: {
    flex: 1,
    color: '#2C2418',
    fontSize: 18,
    fontWeight: '900',
  },
  emergencyRows: {
    gap: 10,
  },
  emergencyRow: {
    borderRadius: 15,
    padding: 12,
    backgroundColor: '#F5FAF6',
  },
  emergencyLabel: {
    color: '#6B5D4E',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  emergencyValue: {
    marginTop: 5,
    color: '#2C2418',
    fontSize: 14,
    fontWeight: '900',
  },
  emergencyFooter: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  emergencyFooterText: {
    color: '#1E7A46',
    fontSize: 12,
    fontWeight: '900',
  },
  safetyCard: {
    borderRadius: 22,
    padding: 15,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
  },
  safetyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  safetyIcon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  safetyHeaderCopy: {
    flex: 1,
  },
  safetyTitle: {
    color: '#2C2418',
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  safetyScore: {
    marginTop: 3,
    fontSize: 19,
    fontWeight: '900',
  },
  safetyWarnings: {
    gap: 8,
    marginTop: 14,
  },
  safetyWarningRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  safetyWarningText: {
    flex: 1,
    color: '#4A4131',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  safetyMetaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14,
  },
  safetyMetaItem: {
    flexGrow: 1,
    flexBasis: '47%',
    borderRadius: 14,
    padding: 11,
    backgroundColor: '#F7F3E7',
  },
  safetyMetaLabel: {
    color: '#7B6D5A',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  safetyMetaValue: {
    marginTop: 5,
    color: '#2C2418',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '800',
  },
  safetyReportButton: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 15,
    paddingVertical: 12,
    backgroundColor: '#F7EBE8',
  },
  safetyReportButtonText: {
    color: '#630E13',
    fontSize: 12,
    fontWeight: '900',
  },
  conditionsCard: {
    borderRadius: 24,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EEE5DA',
  },
  conditionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  conditionsTitle: { color: '#2C2418', fontSize: 18, fontWeight: '900' },
  conditionsSub: { marginTop: 4, color: '#7B6D5A', fontSize: 12, fontWeight: '700' },
  conditionsCountPill: {
    minWidth: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F7EBE8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  conditionsCountText: { color: '#630E13', fontSize: 14, fontWeight: '900' },
  conditionList: { gap: 10 },
  conditionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 18,
    padding: 12,
    backgroundColor: '#FFF8F1',
  },
  conditionIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  conditionCopy: { flex: 1 },
  conditionName: { color: '#2C2418', fontSize: 14, fontWeight: '900', textTransform: 'capitalize' },
  conditionDescription: { marginTop: 3, color: '#6B5D4E', fontSize: 12, lineHeight: 17, fontWeight: '700' },
  conditionDate: { color: '#8A7A6A', fontSize: 11, fontWeight: '800' },
  noConditions: {
    minHeight: 84,
    borderRadius: 18,
    backgroundColor: '#FFF8F1',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
  },
  noConditionsText: { color: '#6B5D4E', fontSize: 13, fontWeight: '800' },
  conditionsReportHint: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F0E5D8',
    paddingTop: 12,
    color: '#7B6D5A',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  gettingThereCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 20,
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EEE5DA',
  },
  gettingThereIcon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F7EBE8',
  },
  gettingThereCopy: {
    flex: 1,
  },
  gettingThereTitle: {
    color: '#2C2418',
    fontSize: 15,
    fontWeight: '900',
  },
  gettingThereSubtitle: {
    marginTop: 4,
    color: '#7B6D5A',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  askTrailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 20,
    padding: 14,
    backgroundColor: '#FFF8F1',
    borderWidth: 1,
    borderColor: '#E8D9C7',
  },
  askTrailIcon: {
    width: 42,
    height: 42,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#630E13',
  },
  askTrailCopy: {
    flex: 1,
  },
  askTrailTitle: {
    color: '#2C2418',
    fontSize: 15,
    fontWeight: '900',
  },
  askTrailSubtitle: {
    marginTop: 3,
    color: '#7B6D5A',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  completedButton: {
  flex: 1,
  flexDirection: 'column',
  backgroundColor: '#FFF8F1',
  borderRadius: 16,
  paddingHorizontal: 12,
  paddingVertical: 10,
  borderWidth: 1,
  borderColor: '#E8D9C7',
},
completedButtonActive: {
  backgroundColor: '#EEF8F0',
  borderColor: '#B9DFC1',
},
completedButtonDisabled: {
  opacity: 0.72,
},
completedButtonIcon: {
  width: 28,
  height: 28,
  borderRadius: 14,
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: '#F7EBE8',
},
completedButtonIconActive: {
  backgroundColor: '#1E7A46',
},
completedButtonHeader: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 8,
},
completedButtonCopy: {
  flex: 1,
},
completedButtonTitle: {
  fontSize: 13,
  fontWeight: '800',
  color: '#2C2418',
},
completedButtonTitleActive: {
  color: '#1E5D34',
},
completedButtonSubtitle: {
  marginTop: 5,
  fontSize: 10,
  lineHeight: 14,
  color: '#7B6D5A',
},
actionRow: {
  flexDirection: 'row',
  alignItems: 'stretch',
  gap: 10,
},
recordButton: {
  flex: 1,
  borderRadius: 16,
  paddingHorizontal: 12,
  paddingVertical: 10,
  backgroundColor: '#630E13',
  shadowColor: '#630E13',
  shadowOpacity: 0.18,
  shadowOffset: { width: 0, height: 6 },
  shadowRadius: 12,
  elevation: 4,
},
recordButtonHeader: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 8,
},
recordButtonIcon: {
  width: 28,
  height: 28,
  borderRadius: 14,
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'rgba(255,255,255,0.18)',
},
recordButtonTitle: {
  color: '#FFFFFF',
  fontSize: 13,
  fontWeight: '800',
  flex: 1,
},
recordButtonSubtitle: {
  marginTop: 4,
  color: 'rgba(255,255,255,0.78)',
  fontSize: 10,
  lineHeight: 14,
},
});

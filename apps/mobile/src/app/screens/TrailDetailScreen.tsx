// Updated to restore the previous trail detail layout while loading trail data from the API and syncing saved state through backend bookmarks.
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable, useWindowDimensions, Alert } from 'react-native';
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
import { getTrailPhotos } from '../api/mediaApi';
import { getProfile, type Profile } from '../api/profilesApi';
import { formatSafetyDistance, getSafetyBand, getTrailSafety, type TrailSafety } from '../api/safetyApi';
import { type FeedItem } from '../data/activitySocial';
import { mapSocialFeedItemToFeedItem } from '../utils/socialFeedMap';

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

  useEffect(() => {
    let cancelled = false;

    const loadTrail = async () => {
      setIsLoading(true);
      setLoadError(null);

      try {
        const [nextTrail, rawReviews, nextPhotos, nextConditions] = await Promise.all([
          getTrailById(trailId),
          getTrailReviews(trailId).catch(() => []),
          getTrailPhotos(trailId).catch(() => []),
          getTrailConditions(trailId).catch(() => []),
        ]);
        const nextSafety = await getTrailSafety(trailId).catch(() => null);
        const nextReviews = await hydrateReviewProfiles(rawReviews);

        if (!cancelled) {
          setTrail(nextTrail);
          setTrailSafety(nextSafety);
          setReviews(nextReviews);
          setTrailConditions(nextConditions);
          setTrailMediaImages(
            nextPhotos
              .map((photo) => photo.url)
              .filter((url, index, collection): url is string => Boolean(url) && collection.indexOf(url) === index),
          );
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
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : 'Unable to load trail details.');
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
            .filter((item) => item.trail.id != null && String(item.trail.id) === String(trailId))
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
    const reviewImages = reviews.flatMap((review) => review.photos?.map((photo) => photo.url).filter(Boolean) ?? []);
    const postImages = communityPosts
      .map((post) => ('image' in post ? post.image : 'cover' in post ? post.cover : undefined))
      .filter(Boolean);

    return [...trailMediaImages, ...reviewImages, ...postImages].filter(
      (imageUri, index, collection): imageUri is string =>
        Boolean(imageUri) && collection.indexOf(imageUri) === index,
    );
  }, [communityPosts, reviews, trailMediaImages]);
  const miniRoutePoints = useMemo(() => buildMiniRoutePreviewPoints(trail?.routeCoordinates), [trail?.routeCoordinates]);
  const miniRoutePath = useMemo(() => buildSmoothPath(miniRoutePoints), [miniRoutePoints]);
  const mapImageUri = useMemo(() => {
    if (!trail) return '';
    const [lat, lng] = trail.coordinates;
    return buildMapImageUri(lng, lat);
  }, [trail]);

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
              onReviewAdded={(review) => setReviews((current) => [review, ...current])}
              onReviewDeleted={(reviewId) => setReviews((current) => current.filter((review) => review.id !== reviewId))}
            />
          </AnimatedBlock>

          <AnimatedBlock delay={370}>
            <CommunityPostsSection
              posts={posts}
              onOpenActivity={() => navigation.navigate('AppTabs', { screen: 'Activity' })}
            />
          </AnimatedBlock>

        </View>
      </ScrollView>
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

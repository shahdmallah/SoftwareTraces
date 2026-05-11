// Updated to restore the previous trail detail layout while loading trail data from the API and syncing saved state through backend bookmarks.
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '../contexts/LanguageContext';
import { AnimatedBlock, AnimatedScreen } from '../components/AnimatedUI';
import {
  getBookmarkStatus,
  getTrailById,
  getTrailReviews,
  removeBookmark,
  saveBookmark,
  type Trail,
  type TrailReview,
} from '../api/trailsApi';
import { useAuth } from '../contexts/AuthContext';
import { buildMapImageUri } from '../config/mapConfig';
import { buildForecast } from '../utils/weatherUtils';
import { buildGalleryImages, buildMiniRoutePreviewPoints, buildSmoothPath } from '../utils/trailUtils';
import { TrailHeroSection } from '../components/TrailHeroSection';
import { TrailSummaryCard } from '../components/TrailSummaryCard';
import { TrailMapPreview } from '../components/TrailMapPreview';
import { WeatherSection } from '../components/WeatherSection';
import { ReviewsSection } from '../components/ReviewsSection';
import { CommunityPostsSection } from '../components/CommunityPostsSection';
import { useTrailTracking } from '../contexts/TrailTrackingContext';
import { getSocialFeed } from '../api/socialApi';
import { type FeedItem } from '../data/activitySocial';
import { mapSocialFeedItemToFeedItem } from '../utils/socialFeedMap';

type TrailDetailScreenRouteProp = RouteProp<RootStackParamList, 'TrailDetail'>;
type TrailDetailNavigationProp = StackNavigationProp<RootStackParamList>;

export function TrailDetailScreen() {
  const route = useRoute<TrailDetailScreenRouteProp>();
  const navigation = useNavigation<TrailDetailNavigationProp>();
  const { trailId } = route.params;
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { t, language } = useLanguage();
  const { isAuthenticated } = useAuth();
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

  useEffect(() => {
    let cancelled = false;

    const loadTrail = async () => {
      setIsLoading(true);
      setLoadError(null);

      try {
        const [nextTrail, nextReviews] = await Promise.all([
          getTrailById(trailId),
          getTrailReviews(trailId).catch(() => []),
        ]);

        if (!cancelled) {
          setTrail(nextTrail);
          setReviews(nextReviews);
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
    if (!trail) {
      return [];
    }

    return buildGalleryImages(trail.images, trail.image);
  }, [trail]);
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
  const isThisTrailActive = activeSessionTrailId === trail.id;

  return (
    <AnimatedScreen style={styles.container}>
      <ScrollView
        style={styles.container}
        nestedScrollEnabled
        contentContainerStyle={{ paddingBottom: Math.max(28, insets.bottom + 16) }}
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
            isSaved={isSaved}
            isSaving={isSaving}
          />
        </AnimatedBlock>

        <View style={styles.content}>
          <AnimatedBlock delay={110}>
            <TrailSummaryCard trail={trail} isArabic={isArabic} />
          </AnimatedBlock>

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
            <WeatherSection
              weeklyForecast={weeklyForecast}
              selectedForecastDate={selectedForecastDate}
              onSelectForecastDate={setSelectedForecastDate}
              isWeatherLoading={isWeatherLoading}
              weatherError={weatherError}
              trail={trail}
            />
          </AnimatedBlock>

          <AnimatedBlock delay={290}>
            <ReviewsSection
              reviews={reviews}
              trailId={trail.id}
              isArabic={isArabic}
              isAuthenticated={isAuthenticated}
              onRequireAuth={() => navigation.navigate('Auth', { mode: 'signin' })}
              onViewAllReviews={openAllReviews}
              onReviewAdded={(review) => setReviews((current) => [review, ...current])}
            />
          </AnimatedBlock>

          <AnimatedBlock delay={330}>
            <CommunityPostsSection
              posts={posts}
              onOpenActivity={() => navigation.navigate('AppTabs', { screen: 'Activity' })}
            />
          </AnimatedBlock>

          <AnimatedBlock delay={370}>
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
                <Text style={[styles.planTripSub, isArabic ? { textAlign: 'right' } : null]}>
                  {isArabic ? 'حدد التاريخ، الدعوات، ونقطة اللقاء.' : 'Set date, invite friends, and choose a meetup point.'}
                </Text>
              </View>
            </Pressable>
          </AnimatedBlock>
        </View>
      </ScrollView>
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
  planTripButton: {
    marginTop: 18,
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

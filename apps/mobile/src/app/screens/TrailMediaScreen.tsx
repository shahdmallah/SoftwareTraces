import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Alert,
  Dimensions,
  Easing,
  GestureResponderEvent,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootStackParamList } from '../navigation/types';
import { getTrailById, getTrailElevationProfile, type ElevationProfile, type Trail } from '../api/trailsApi';
import {
  deleteReviewPhoto,
  deleteTrailPhoto,
  flagPhoto,
  getPhotoTypeForTrailPhoto,
  setPrimaryTrailPhoto,
  votePhoto,
  type TrailPhoto,
} from '../api/mediaApi';
import { useAuth } from '../contexts/AuthContext';
import { theme } from '../theme';
import { getApprovedTrailPhotos } from '../utils/trailPhotos';

type TrailMediaScreenRouteProp = RouteProp<RootStackParamList, 'TrailMedia'>;
type TrailMediaNavigationProp = StackNavigationProp<RootStackParamList>;
type MediaTab = 'latest' | 'sights' | 'seasons' | 'tour';
type GalleryItem = {
  id: string;
  imageUri: string;
  label: string;
  height: number;
  photo?: TrailPhoto;
};

const { width } = Dimensions.get('window');
const GRID_GAP = 8;
const SCREEN_PADDING = 8;
const PANEL_SIDE_PADDING = 20;
const COLUMN_WIDTH = (width - SCREEN_PADDING * 2 - GRID_GAP) / 2;
const PROFILE_WIDTH = width - 72;
const PROFILE_HEIGHT = 104;
const ELEVATION_CHART_POINTS = 128;

const TAB_LABELS: Record<MediaTab, string> = {
  latest: 'Latest',
  sights: 'Sights',
  seasons: 'Seasons',
  tour: 'Tour',
};

const CARD_HEIGHTS = [COLUMN_WIDTH * 1.45, COLUMN_WIDTH * 1.45, COLUMN_WIDTH * 1.18, COLUMN_WIDTH * 1.18, COLUMN_WIDTH * 1.22, COLUMN_WIDTH * 1.22];

function formatDistance(distance: number) {
  if (!Number.isFinite(distance)) {
    return '0 km';
  }

  return `${distance.toFixed(1)} km`;
}

function formatElevation(elevationGain: number) {
  if (!Number.isFinite(elevationGain)) {
    return '0 m';
  }

  return `${Math.round(elevationGain)} m`;
}

type ChartPoint = { x: number; y: number; distM: number; elevM: number };

function buildChartPointsFromProfile(profile: ElevationProfile, chartWidth: number, chartHeight: number): ChartPoint[] {
  const n = Math.min(profile.elevations.length, profile.distances.length);
  if (n < 2) {
    return [];
  }

  const elevations = profile.elevations.slice(0, n);
  const distances = profile.distances.slice(0, n);
  const dMax = distances[n - 1] ?? 0;
  if (dMax <= 0) {
    return [];
  }

  const eMin = Math.min(...elevations);
  const eMax = Math.max(...elevations);
  const eRange = Math.max(35, eMax - eMin);
  const padY = chartHeight * 0.12;
  const plotH = chartHeight - padY * 2;

  return distances.map((d, i) => {
    const e = elevations[i];
    const x = (d / dMax) * chartWidth;
    const yNorm = (e - eMin) / eRange;
    const y = chartHeight - padY - yNorm * plotH;
    return { x, y, distM: d, elevM: e };
  });
}

function polylinePath(points: Pick<ChartPoint, 'x' | 'y'>[]): string {
  if (!points.length) return '';
  return points.reduce((path, pt, index) => {
    const cmd = index === 0 ? 'M' : 'L';
    return `${path}${cmd} ${pt.x.toFixed(2)} ${pt.y.toFixed(2)}`;
  }, '');
}

function buildAreaFillPath(points: ChartPoint[], chartHeight: number): string {
  if (!points.length) return '';
  const stroke = polylinePath(points);
  const first = points[0];
  const last = points[points.length - 1];
  return `${stroke} L ${last.x.toFixed(2)} ${chartHeight} L ${first.x.toFixed(2)} ${chartHeight} Z`;
}

function getPlayheadState(points: ChartPoint[], progress: number): { x: number; y: number; distKm: number; elevM: number } | null {
  if (!points.length) return null;
  const dEnd = points[points.length - 1].distM;
  if (dEnd <= 0) return null;

  const targetM = Math.max(0, Math.min(1, progress)) * dEnd;
  let i = 0;
  while (i < points.length - 1 && points[i + 1].distM < targetM) {
    i += 1;
  }

  if (i >= points.length - 1) {
    const p = points[points.length - 1];
    return { x: p.x, y: p.y, distKm: p.distM / 1000, elevM: p.elevM };
  }

  const a = points[i];
  const b = points[i + 1];
  const span = Math.max(1e-6, b.distM - a.distM);
  const t = (targetM - a.distM) / span;
  const x = a.x + t * (b.x - a.x);
  const y = a.y + t * (b.y - a.y);
  const elevM = a.elevM + t * (b.elevM - a.elevM);
  return { x, y, distKm: targetM / 1000, elevM };
}

function buildTraveledPath(points: ChartPoint[], progress: number): string {
  if (!points.length || progress <= 0) return '';
  const playhead = getPlayheadState(points, progress);
  if (!playhead) return '';

  const dEnd = points[points.length - 1].distM;
  const targetM = Math.max(0, Math.min(1, progress)) * dEnd;
  const included: { x: number; y: number }[] = [];

  for (const p of points) {
    if (p.distM < targetM - 1e-6) {
      included.push({ x: p.x, y: p.y });
    } else {
      break;
    }
  }

  included.push({ x: playhead.x, y: playhead.y });
  return polylinePath(included);
}

function buildAxisLabelsFromProfile(profile: ElevationProfile | null, trailDistanceKm: number) {
  const km =
    profile?.distances?.length && profile.distances[profile.distances.length - 1] > 0
      ? profile.distances[profile.distances.length - 1] / 1000
      : trailDistanceKm;
  const safe = Number.isFinite(km) && km > 0 ? km : 0;
  return ['0 km', `${(safe / 2).toFixed(1)} km`, `${safe.toFixed(1)} km`];
}

function formatPhotoDate(value?: string) {
  if (!value) {
    return 'Unknown date';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'Unknown date';
  }

  return parsed.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function toSeasonName(value?: string) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const month = parsed.getMonth() + 1;
  if (month === 12 || month <= 2) return 'Winter';
  if (month <= 5) return 'Spring';
  if (month <= 8) return 'Summer';
  return 'Autumn';
}

function buildGalleryItems(tab: MediaTab, trail: Trail | null, photos: TrailPhoto[], images: string[]): GalleryItem[] {
  const photosWithUrls = photos.filter((photo) => Boolean(photo.url));

  if (tab === 'latest') {
    if (photosWithUrls.length) {
      const sorted = [...photosWithUrls].sort((a, b) => {
        const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
        return bTime - aTime;
      });

      return sorted.map((photo, index) => ({
        id: `latest-${photo.id}`,
        imageUri: photo.url,
        label: formatPhotoDate(photo.created_at),
        height: CARD_HEIGHTS[index % CARD_HEIGHTS.length],
        photo,
      }));
    }
  }

  if (tab === 'sights') {
    if (photosWithUrls.length) {
      return photosWithUrls.map((photo, index) => ({
        id: `sight-${photo.id}`,
        imageUri: photo.url,
        label: photo.caption?.trim() || trail?.features[index % Math.max(1, trail?.features.length ?? 1)] || formatPhotoDate(photo.created_at),
        height: CARD_HEIGHTS[index % CARD_HEIGHTS.length],
        photo,
      }));
    }

    const dynamicFeatures = trail?.features.filter(Boolean) ?? [];
    return dynamicFeatures.map((feature, index) => ({
      id: `sight-feature-${index}`,
      imageUri: images[index % Math.max(1, images.length)] ?? trail?.image ?? '',
      label: feature,
      height: CARD_HEIGHTS[index % CARD_HEIGHTS.length],
    })).filter((item) => Boolean(item.imageUri));
  }

  if (tab === 'seasons') {
    const bySeason = new Map<string, TrailPhoto>();
    for (const photo of photosWithUrls) {
      const season = toSeasonName(photo.created_at);
      if (season && !bySeason.has(season)) {
        bySeason.set(season, photo);
      }
    }

    const seasonItems = Array.from(bySeason.entries()).map(([season, photo], index) => ({
      id: `season-${season.toLowerCase()}`,
      imageUri: photo.url,
      label: season,
      height: CARD_HEIGHTS[index % CARD_HEIGHTS.length],
      photo,
    }));

    return seasonItems;
  }

  return images.map((imageUri, index) => ({
    id: `${tab}-${index}`,
    imageUri,
    label: formatPhotoDate(photosWithUrls[index]?.created_at),
    height: CARD_HEIGHTS[index % CARD_HEIGHTS.length],
  }));
}

export function TrailMediaScreen() {
  const navigation = useNavigation<TrailMediaNavigationProp>();
  const route = useRoute<TrailMediaScreenRouteProp>();
  const insets = useSafeAreaInsets();
  const { isAuthenticated, user } = useAuth();
  const { trailId } = route.params;
  const [trail, setTrail] = useState<Trail | null>(null);
  const [trailPhotos, setTrailPhotos] = useState<TrailPhoto[]>([]);
  const [elevationProfile, setElevationProfile] = useState<ElevationProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<MediaTab>('latest');
  const [tourProgress, setTourProgress] = useState(0);
  const [tourPlaying, setTourPlaying] = useState(false);
  const [pendingPhotoAction, setPendingPhotoAction] = useState<string | null>(null);
  const [photoVotes, setPhotoVotes] = useState<Record<string, -1 | 0 | 1>>({});

  const imageFade = useRef(new Animated.Value(1)).current;
  const prevPhotoIndexRef = useRef(0);

  useEffect(() => {
    let cancelled = false;

    const loadTrail = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const nextTrail = await getTrailById(trailId);
        const [nextPhotos, profile] = await Promise.all([
          getApprovedTrailPhotos(trailId, nextTrail).catch(() => []),
          getTrailElevationProfile(trailId, { points: ELEVATION_CHART_POINTS, simplify: true }).catch(() => null),
        ]);

        if (!cancelled) {
          setTrail(nextTrail);
          setTrailPhotos(nextPhotos);
          setElevationProfile(profile);
        }
      } catch (nextError) {
        if (!cancelled) {
          setError(nextError instanceof Error ? nextError.message : 'Unable to load trail media.');
          setTrail(null);
          setTrailPhotos([]);
          setElevationProfile(null);
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
  }, [trailId]);

  const refreshTrailPhotos = useCallback(async () => {
    try {
      const nextTrail = await getTrailById(trailId);
      const nextPhotos = await getApprovedTrailPhotos(trailId, nextTrail).catch(() => []);

      setTrail(nextTrail);
      setTrailPhotos(nextPhotos);
    } catch (nextError) {
      Alert.alert('Unable to refresh photos', nextError instanceof Error ? nextError.message : 'Please try again.');
    }
  }, [trailId]);

  const handleSetPrimaryPhoto = useCallback(async (photo: TrailPhoto) => {
    if (!isAuthenticated) {
      navigation.navigate('Auth', { mode: 'signin' });
      return;
    }

    if (photo.source !== 'direct' || photo.is_primary) {
      return;
    }

    setPendingPhotoAction(`primary-${photo.id}`);

    try {
      await setPrimaryTrailPhoto(photo.id);
      await refreshTrailPhotos();
    } catch (nextError) {
      Alert.alert('Unable to set primary photo', nextError instanceof Error ? nextError.message : 'Please try again.');
    } finally {
      setPendingPhotoAction(null);
    }
  }, [isAuthenticated, navigation, refreshTrailPhotos]);

  const handleDeletePhoto = useCallback((photo: TrailPhoto) => {
    if (!isAuthenticated) {
      navigation.navigate('Auth', { mode: 'signin' });
      return;
    }

    Alert.alert('Delete photo?', 'This removes the photo from this trail.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setPendingPhotoAction(`delete-${photo.id}`);

          try {
            if (photo.source === 'review') {
              await deleteReviewPhoto(photo.id);
            } else {
              await deleteTrailPhoto(photo.id);
            }

            await refreshTrailPhotos();
          } catch (nextError) {
            Alert.alert('Unable to delete photo', nextError instanceof Error ? nextError.message : 'Please try again.');
          } finally {
            setPendingPhotoAction(null);
          }
        },
      },
    ]);
  }, [isAuthenticated, navigation, refreshTrailPhotos]);

  const updatePhotoStatus = useCallback((photoId: string, status: { helpful_score?: number; flag_count?: number }) => {
    setTrailPhotos((current) =>
      current.map((photo) =>
        photo.id === photoId
          ? {
              ...photo,
              helpful_score: typeof status.helpful_score === 'number' ? status.helpful_score : photo.helpful_score,
              flag_count: typeof status.flag_count === 'number' ? status.flag_count : photo.flag_count,
            }
          : photo,
      ),
    );
  }, []);

  const handleVotePhoto = useCallback(async (photo: TrailPhoto, vote: -1 | 1) => {
    if (!isAuthenticated) {
      navigation.navigate('Auth', { mode: 'signin' });
      return;
    }

    const currentVote = photoVotes[photo.id] ?? 0;
    const nextVote = currentVote === vote ? 0 : vote;
    const previousVotes = photoVotes;
    const previousScore = Number(photo.helpful_score ?? 0);
    const optimisticScore = previousScore - currentVote + nextVote;

    setPhotoVotes((current) => ({ ...current, [photo.id]: nextVote }));
    setTrailPhotos((current) =>
      current.map((item) => (item.id === photo.id ? { ...item, helpful_score: optimisticScore } : item)),
    );
    setPendingPhotoAction(`vote-${photo.id}`);

    try {
      const status = await votePhoto(photo.id, getPhotoTypeForTrailPhoto(photo), nextVote);
      updatePhotoStatus(photo.id, status);
    } catch (nextError) {
      setPhotoVotes(previousVotes);
      setTrailPhotos((current) =>
        current.map((item) => (item.id === photo.id ? { ...item, helpful_score: previousScore } : item)),
      );
      Alert.alert('Unable to vote on photo', nextError instanceof Error ? nextError.message : 'Please try again.');
    } finally {
      setPendingPhotoAction(null);
    }
  }, [isAuthenticated, navigation, photoVotes, updatePhotoStatus]);

  const handleFlagPhoto = useCallback((photo: TrailPhoto) => {
    if (!isAuthenticated) {
      navigation.navigate('Auth', { mode: 'signin' });
      return;
    }

    Alert.alert('Flag photo?', 'This asks the community team to review the photo.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Flag',
        style: 'destructive',
        onPress: async () => {
          setPendingPhotoAction(`flag-${photo.id}`);
          try {
            const status = await flagPhoto(photo.id, getPhotoTypeForTrailPhoto(photo), 'irrelevant');
            updatePhotoStatus(photo.id, status);
            Alert.alert('Photo flagged', 'Thanks. We will review it.');
          } catch (nextError) {
            Alert.alert('Unable to flag photo', nextError instanceof Error ? nextError.message : 'Please try again.');
          } finally {
            setPendingPhotoAction(null);
          }
        },
      },
    ]);
  }, [isAuthenticated, navigation, updatePhotoStatus]);

  const canManagePhoto = useCallback((photo: TrailPhoto) => {
    if (photo.source !== 'direct' && photo.source !== 'review') {
      return false;
    }

    if (!user?.id) {
      return false;
    }

    const ownerId = photo.user_id ?? photo.uploader_id;
    if (ownerId) {
      return ownerId === user.id;
    }

    return Boolean(user.full_name && photo.uploaded_by && photo.uploaded_by.trim() === user.full_name.trim());
  }, [user?.full_name, user?.id]);

  useEffect(() => {
    setTourProgress(0);
    setTourPlaying(false);
    prevPhotoIndexRef.current = 0;
  }, [trailId]);

  useEffect(() => {
    if (activeTab !== 'tour') {
      setTourPlaying(false);
    }
  }, [activeTab]);

  const tourDurationMs = useMemo(() => {
    const lastM =
      elevationProfile?.distances?.length && elevationProfile.distances.length > 0
        ? elevationProfile.distances[elevationProfile.distances.length - 1]
        : 0;
    const kmFromProfile = lastM > 0 ? lastM / 1000 : 0;
    const km = kmFromProfile > 0 ? kmFromProfile : trail?.distance ?? 5;
    return Math.min(95_000, Math.max(28_000, km * 12_000));
  }, [elevationProfile, trail?.distance]);

  useEffect(() => {
    if (!tourPlaying || activeTab !== 'tour') {
      return;
    }

    let raf = 0;
    let last = performance.now();

    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      setTourProgress((previous) => {
        const next = previous + dt / tourDurationMs;
        if (next >= 1) {
          setTourPlaying(false);
          return 1;
        }
        return next;
      });
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [tourPlaying, activeTab, tourDurationMs]);

  const toggleTourPlayback = useCallback(() => {
    if (tourProgress >= 0.998) {
      setTourProgress(0);
      setTourPlaying(true);
      return;
    }
    setTourPlaying((value) => !value);
  }, [tourProgress]);

  const galleryImages = useMemo(() => {
    const endpointImages = trailPhotos.map((photo) => photo.url).filter(Boolean);
    return endpointImages.filter((imageUri, index, collection): imageUri is string => Boolean(imageUri) && collection.indexOf(imageUri) === index);
  }, [trailPhotos]);

  const tourGallery = useMemo(() => {
    return galleryImages;
  }, [galleryImages]);

  const tourPhotoIndex = useMemo(() => {
    if (tourGallery.length <= 1) {
      return 0;
    }
    const idx = Math.floor(tourProgress * tourGallery.length);
    return Math.min(tourGallery.length - 1, Math.max(0, idx));
  }, [tourProgress, tourGallery.length]);

  useEffect(() => {
    if (prevPhotoIndexRef.current === tourPhotoIndex) {
      return;
    }
    prevPhotoIndexRef.current = tourPhotoIndex;
    imageFade.setValue(0.45);
    Animated.timing(imageFade, {
      toValue: 1,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [tourPhotoIndex, imageFade]);

  const chartPoints = useMemo(() => {
    if (!elevationProfile) {
      return [];
    }
    return buildChartPointsFromProfile(elevationProfile, PROFILE_WIDTH, PROFILE_HEIGHT);
  }, [elevationProfile]);

  const fullStrokePath = useMemo(() => polylinePath(chartPoints), [chartPoints]);
  const fillPath = useMemo(() => buildAreaFillPath(chartPoints, PROFILE_HEIGHT), [chartPoints]);
  const traveledPath = useMemo(() => buildTraveledPath(chartPoints, tourProgress), [chartPoints, tourProgress]);
  const playhead = useMemo(() => getPlayheadState(chartPoints, tourProgress), [chartPoints, tourProgress]);
  const axisLabels = useMemo(() => buildAxisLabelsFromProfile(elevationProfile, trail?.distance ?? 0), [elevationProfile, trail?.distance]);

  const onChartSeek = useCallback((event: GestureResponderEvent) => {
    const x = event.nativeEvent.locationX;
    const next = Math.max(0, Math.min(1, x / PROFILE_WIDTH));
    setTourProgress(next);
  }, []);

  const galleryItems = useMemo(
    () => buildGalleryItems(activeTab, trail, trailPhotos, galleryImages),
    [activeTab, galleryImages, trail, trailPhotos],
  );
  const isTour = activeTab === 'tour';
  const activeColor = theme.colors.buttonPrimary;
  const tourHeroUri = tourGallery[tourPhotoIndex] ?? '';
  const hasPhotos = galleryImages.length > 0;

  if (isLoading) {
    return (
      <View style={styles.stateScreen}>
        <ActivityIndicator color={theme.colors.buttonPrimary} />
      </View>
    );
  }

  if (!trail) {
    return (
      <View style={styles.stateScreen}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={[styles.topButton, { position: 'absolute', top: insets.top + 14, left: 20 }]}
        >
          <Ionicons name="close" size={28} color={theme.colors.textPrimary} />
        </Pressable>
        <Text style={styles.errorTitle}>Trail media unavailable</Text>
        <Text style={styles.errorText}>{error ?? 'We could not load this trail right now.'}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.topButton}>
          <Ionicons name="close" size={28} color={theme.colors.textPrimary} />
        </Pressable>

        <Pressable style={styles.topButton}>
          <Ionicons name="images-outline" size={24} color={theme.colors.textPrimary} />
        </Pressable>
      </View>

      {isTour ? (
        <View style={styles.tourScreen}>
          {hasPhotos && tourHeroUri ? (
            <Animated.View style={[styles.tourHeroImage, { opacity: imageFade }]}>
              <Image source={{ uri: tourHeroUri }} style={styles.tourHeroBackdrop} resizeMode="cover" />
              <Image source={{ uri: tourHeroUri }} style={styles.tourHeroPhoto} resizeMode="contain" />
            </Animated.View>
          ) : (
            <View style={styles.noPhotosTourState}>
              <Ionicons name="images-outline" size={44} color="#8A7A6A" />
              <Text style={styles.noPhotosTitle}>No photos yet</Text>
              <Text style={styles.noPhotosText}>This trail does not have uploaded media.</Text>
            </View>
          )}
          <View style={styles.tourOverlay} />

          {hasPhotos ? (
            <View style={[styles.tourPhotoBadge, { top: Math.max(insets.top + 72, 96) }]}>
              <Text style={styles.tourPhotoBadgeText}>
                {`${tourPhotoIndex + 1} / ${tourGallery.length}`}
              </Text>
            </View>
          ) : null}

          <View style={[styles.tourPanelWrap, { bottom: Math.max(insets.bottom + 96, 108) }]}>
            <BlurView intensity={85} tint="light" style={styles.tourPanel}>
              <View style={styles.metricRow}>
                <View style={styles.metricCopy}>
                  <Text style={styles.metricText}>
                    {formatDistance(trail.distance)}
                    <Text style={styles.metricDivider}>  |  </Text>
                    {formatElevation(trail.elevationGain)}
                  </Text>
                  <Text style={styles.playheadMetrics}>
                    {playhead
                      ? `${playhead.distKm.toFixed(2)} km · ${Math.round(playhead.elevM)} m`
                      : chartPoints.length >= 2
                      ? '…'
                      : elevationProfile
                      ? 'Along-route profile unavailable'
                      : '—'}
                  </Text>
                </View>
                <Pressable
                  onPress={toggleTourPlayback}
                  style={styles.tourPlayButton}
                  accessibilityRole="button"
                  accessibilityLabel={tourProgress >= 0.998 ? 'Restart tour' : tourPlaying ? 'Pause tour' : 'Play tour'}
                >
                  <Ionicons
                    name={tourProgress >= 0.998 ? 'play' : tourPlaying ? 'pause' : 'play'}
                    size={26}
                    color={theme.colors.textPrimary}
                  />
                </Pressable>
              </View>

              <Pressable style={styles.chartBlock} onPress={onChartSeek}>
                {chartPoints.length >= 2 ? (
                  <Svg width={PROFILE_WIDTH} height={PROFILE_HEIGHT} viewBox={`0 0 ${PROFILE_WIDTH} ${PROFILE_HEIGHT}`}>
                    <Defs>
                      <LinearGradient id="tourElevFill" x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0" stopColor="#630E13" stopOpacity="0.14" />
                        <Stop offset="1" stopColor="#630E13" stopOpacity="0.02" />
                      </LinearGradient>
                    </Defs>
                    <Path d={fillPath} fill="url(#tourElevFill)" stroke="none" />
                    <Path
                      d={fullStrokePath}
                      fill="none"
                      stroke="rgba(110,117,112,0.35)"
                      strokeWidth={3.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <Path
                      d={traveledPath}
                      fill="none"
                      stroke="#1C2117"
                      strokeWidth={4}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    {playhead ? (
                      <>
                        <Path
                          d={`M ${playhead.x.toFixed(2)} 0 L ${playhead.x.toFixed(2)} ${PROFILE_HEIGHT}`}
                          stroke="rgba(17,24,15,0.35)"
                          strokeWidth={1.5}
                          strokeDasharray="4 4"
                        />
                        <Circle cx={playhead.x} cy={playhead.y} r={6} fill="#630E13" stroke="#F6F8F5" strokeWidth={2.5} />
                      </>
                    ) : null}
                  </Svg>
                ) : (
                  <View style={styles.chartFallback}>
                    <Text style={styles.chartFallbackText}>
                      {elevationProfile ? 'Not enough elevation samples for this trail.' : 'Could not load elevation profile.'}
                    </Text>
                  </View>
                )}

                <View style={styles.axisLabels}>
                  {axisLabels.map((label) => (
                    <Text key={label} style={styles.axisLabelText}>
                      {label}
                    </Text>
                  ))}
                </View>
                <Text style={styles.chartHint}>Tap the chart to move along the route</Text>
              </Pressable>

            </BlurView>
          </View>

          <View style={[styles.floatingTabsWrap, { bottom: Math.max(insets.bottom, 12) }]}>
            <BlurView intensity={80} tint="light" style={styles.floatingTabs}>
              {(Object.keys(TAB_LABELS) as MediaTab[]).map((tab) => {
                const isActive = tab === activeTab;

                return (
                  <Pressable
                    key={tab}
                    onPress={() => setActiveTab(tab)}
                    style={[styles.floatingTabButton, isActive && { backgroundColor: activeColor }]}
                  >
                    <Text style={[styles.floatingTabText, isActive && styles.tabButtonTextActive]}>
                      {TAB_LABELS[tab]}
                    </Text>
                  </Pressable>
                );
              })}
            </BlurView>
          </View>
        </View>
      ) : (
        <>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.galleryContent,
              { paddingTop: 18, paddingBottom: Math.max(insets.bottom + 120, 160) },
            ]}
          >
            {galleryItems.length ? (
              <View style={styles.galleryGrid}>
                {galleryItems.map((item) => (
                  <View key={item.id} style={[styles.galleryCard, { height: item.height }]}>
                    <Image source={{ uri: item.imageUri }} style={styles.galleryImage} resizeMode="cover" />
                    <View style={styles.galleryGradient} />
                    <Text style={styles.galleryLabel}>{item.label}</Text>
                    {item.photo ? (
                      <View style={styles.photoFeedback}>
                        <Pressable
                          style={[styles.photoVoteButton, photoVotes[item.photo.id] === 1 && styles.photoVoteButtonActive]}
                          disabled={pendingPhotoAction === `vote-${item.photo.id}`}
                          onPress={() => void handleVotePhoto(item.photo!, 1)}
                        >
                          {pendingPhotoAction === `vote-${item.photo.id}` ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <Ionicons name="thumbs-up-outline" size={14} color="#fff" />
                          )}
                        </Pressable>
                        <Text style={styles.photoScoreText}>{Number(item.photo.helpful_score ?? 0)}</Text>
                        <Pressable
                          style={[styles.photoVoteButton, photoVotes[item.photo.id] === -1 && styles.photoVoteButtonActive]}
                          disabled={pendingPhotoAction === `vote-${item.photo.id}`}
                          onPress={() => void handleVotePhoto(item.photo!, -1)}
                        >
                          <Ionicons name="thumbs-down-outline" size={14} color="#fff" />
                        </Pressable>
                        <Pressable
                          style={styles.photoVoteButton}
                          disabled={pendingPhotoAction === `flag-${item.photo.id}`}
                          onPress={() => handleFlagPhoto(item.photo!)}
                        >
                          {pendingPhotoAction === `flag-${item.photo.id}` ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <Ionicons name="flag-outline" size={14} color="#fff" />
                          )}
                        </Pressable>
                      </View>
                    ) : null}
                    {item.photo && canManagePhoto(item.photo) ? (
                      <View style={styles.photoActions}>
                        {item.photo.source === 'direct' ? (
                          <Pressable
                            style={[styles.photoActionButton, item.photo.is_primary && styles.photoActionButtonActive]}
                            disabled={item.photo.is_primary || pendingPhotoAction === `primary-${item.photo.id}`}
                            onPress={() => void handleSetPrimaryPhoto(item.photo!)}
                          >
                            {pendingPhotoAction === `primary-${item.photo.id}` ? (
                              <ActivityIndicator size="small" color="#fff" />
                            ) : (
                              <Ionicons name={item.photo.is_primary ? 'star' : 'star-outline'} size={17} color="#fff" />
                            )}
                          </Pressable>
                        ) : null}

                        <Pressable
                          style={styles.photoActionButton}
                          disabled={pendingPhotoAction === `delete-${item.photo.id}`}
                          onPress={() => handleDeletePhoto(item.photo!)}
                        >
                          {pendingPhotoAction === `delete-${item.photo.id}` ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <Ionicons name="trash-outline" size={17} color="#fff" />
                          )}
                        </Pressable>
                      </View>
                    ) : null}
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.noPhotosState}>
                <Ionicons name="images-outline" size={42} color="#8A7A6A" />
                <Text style={styles.noPhotosTitle}>No photos yet</Text>
                <Text style={styles.noPhotosText}>This trail does not have uploaded media.</Text>
              </View>
            )}
          </ScrollView>

          <View style={[styles.floatingTabsWrap, { bottom: Math.max(insets.bottom, 12) }]}>
            <BlurView intensity={80} tint="light" style={styles.floatingTabs}>
              {(Object.keys(TAB_LABELS) as MediaTab[]).map((tab) => {
                const isActive = tab === activeTab;

                return (
                  <Pressable
                    key={tab}
                    onPress={() => setActiveTab(tab)}
                    style={[styles.floatingTabButton, isActive && { backgroundColor: activeColor }]}
                  >
                    <Text style={[styles.floatingTabText, isActive && styles.tabButtonTextActive]}>
                      {TAB_LABELS[tab]}
                    </Text>
                  </Pressable>
                );
              })}
            </BlurView>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F7F4',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 5,
  },
  topButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.96)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
    elevation: 7,
  },
  galleryContent: {
    paddingHorizontal: SCREEN_PADDING,
  },
  galleryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: GRID_GAP,
    rowGap: GRID_GAP,
  },
  galleryCard: {
    width: COLUMN_WIDTH,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#D9DED6',
  },
  galleryImage: {
    width: '100%',
    height: '100%',
  },
  galleryGradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  galleryLabel: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 18,
    color: theme.colors.textInverse,
    fontSize: 23,
    lineHeight: 28,
    fontWeight: '700',
    letterSpacing: -0.6,
  },
  noPhotosState: {
    minHeight: 420,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 10,
  },
  noPhotosTourState: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    backgroundColor: '#F7F7F4',
    gap: 10,
  },
  noPhotosTitle: {
    color: theme.colors.textPrimary,
    fontSize: 20,
    fontWeight: '800',
  },
  noPhotosText: {
    color: '#6B5D4E',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  photoActions: {
    position: 'absolute',
    top: 54,
    right: 12,
    flexDirection: 'row',
    gap: 8,
  },
  photoFeedback: {
    position: 'absolute',
    top: 12,
    left: 12,
    maxWidth: COLUMN_WIDTH - 24,
    minHeight: 34,
    borderRadius: 999,
    paddingHorizontal: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16,23,14,0.58)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  photoVoteButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoVoteButtonActive: {
    backgroundColor: '#630E13',
  },
  photoScoreText: {
    minWidth: 16,
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  photoActionButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(16,23,14,0.62)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  photoActionButtonActive: {
    backgroundColor: '#630E13',
  },
  floatingTabsWrap: {
    position: 'absolute',
    left: 20,
    right: 20,
  },
  floatingTabs: {
    flexDirection: 'row',
    padding: 8,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: 'rgba(244,245,239,0.88)',
    borderWidth: 1,
    borderColor: 'rgba(215,216,206,0.9)',
  },
  floatingTabButton: {
    flex: 1,
    paddingVertical: 18,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingTabText: {
    color: '#72776E',
    fontSize: 14,
    fontWeight: '700',
  },
  tourScreen: {
    flex: 1,
  },
  tourHeroImage: {
    ...StyleSheet.absoluteFillObject,
    width,
    height: '100%',
    backgroundColor: '#10170E',
  },
  tourHeroBackdrop: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.4,
  },
  tourHeroPhoto: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  tourOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(19, 27, 18, 0.38)',
  },
  tourPanelWrap: {
    position: 'absolute',
    left: PANEL_SIDE_PADDING,
    right: PANEL_SIDE_PADDING,
  },
  tourPanel: {
    borderRadius: 32,
    overflow: 'hidden',
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 12,
    backgroundColor: 'rgba(233, 235, 233, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    paddingHorizontal: 6,
  },
  metricCopy: {
    flex: 1,
    paddingRight: 10,
    gap: 4,
  },
  metricText: {
    color: '#10170E',
    fontSize: 18,
    fontWeight: '700',
  },
  playheadMetrics: {
    color: 'rgba(16,23,14,0.62)',
    fontSize: 13,
    fontWeight: '700',
  },
  tourPlayButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(215,216,206,0.95)',
  },
  metricDivider: {
    color: 'rgba(16,23,14,0.18)',
    fontWeight: '400',
  },
  chartBlock: {
    paddingHorizontal: 6,
  },
  chartFallback: {
    height: PROFILE_HEIGHT,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(215,216,206,0.7)',
  },
  chartFallbackText: {
    textAlign: 'center',
    color: 'rgba(57,65,57,0.85)',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  chartHint: {
    marginTop: 6,
    textAlign: 'center',
    color: 'rgba(57,65,57,0.55)',
    fontSize: 11,
    fontWeight: '600',
  },
  tourPhotoBadge: {
    position: 'absolute',
    right: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(19, 27, 18, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  tourPhotoBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  axisLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  axisLabelText: {
    color: 'rgba(57,65,57,0.7)',
    fontSize: 13,
    fontWeight: '600',
  },
  tabButtonTextActive: {
    color: theme.colors.textInverse,
  },
  stateScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#F7F7F4',
  },
  errorTitle: {
    marginTop: 16,
    color: theme.colors.textPrimary,
    fontSize: 24,
    fontWeight: '700',
  },
  errorText: {
    marginTop: 10,
    textAlign: 'center',
    color: theme.colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
});

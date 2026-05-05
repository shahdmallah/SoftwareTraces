import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
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
import { getTrailPhotos, type TrailPhoto } from '../api/mediaApi';
import { buildGalleryImages } from '../utils/trailUtils';
import { theme } from '../theme';

type TrailMediaScreenRouteProp = RouteProp<RootStackParamList, 'TrailMedia'>;
type TrailMediaNavigationProp = StackNavigationProp<RootStackParamList>;
type MediaTab = 'latest' | 'sights' | 'seasons' | 'tour';
type GalleryItem = {
  id: string;
  imageUri: string;
  label: string;
  height: number;
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

const LATEST_LABELS = [
  '11 Oct 2025',
  '13 Apr 2025',
  '12 Nov 2024',
  '29 Jul 2024',
  '14 May 2024',
  '20 Apr 2024',
];

const SEASON_LABELS = ['Spring', 'Summer', 'Autumn', 'Winter', 'Spring', 'Summer'];
const SIGHT_LABELS = ['River crossing', 'Power trail', 'Reed tunnel', 'Water bend', 'Open marsh', 'Stone house'];
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

function buildGalleryItems(tab: MediaTab, trail: Trail | null, images: string[]): GalleryItem[] {
  const labels =
    tab === 'latest'
      ? LATEST_LABELS
      : tab === 'seasons'
      ? SEASON_LABELS
      : SIGHT_LABELS;

  const sourceImages = images.length ? images : trail?.image ? [trail.image] : [];

  if (!sourceImages.length) {
    return [];
  }

  return labels.map((label, index) => ({
    id: `${tab}-${index}`,
    imageUri: sourceImages[index % sourceImages.length],
    label: tab === 'sights' && trail?.features[index] ? trail.features[index] : label,
    height: CARD_HEIGHTS[index % CARD_HEIGHTS.length],
  }));
}

export function TrailMediaScreen() {
  const navigation = useNavigation<TrailMediaNavigationProp>();
  const route = useRoute<TrailMediaScreenRouteProp>();
  const insets = useSafeAreaInsets();
  const { trailId } = route.params;
  const [trail, setTrail] = useState<Trail | null>(null);
  const [trailPhotos, setTrailPhotos] = useState<TrailPhoto[]>([]);
  const [elevationProfile, setElevationProfile] = useState<ElevationProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<MediaTab>('latest');
  const [tourProgress, setTourProgress] = useState(0);
  const [tourPlaying, setTourPlaying] = useState(false);

  const imageFade = useRef(new Animated.Value(1)).current;
  const prevPhotoIndexRef = useRef(0);

  useEffect(() => {
    let cancelled = false;

    const loadTrail = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const [nextTrail, nextPhotos, profile] = await Promise.all([
          getTrailById(trailId),
          getTrailPhotos(trailId).catch(() => []),
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

    if (endpointImages.length) {
      return endpointImages;
    }

    if (!trail) {
      return [];
    }

    return buildGalleryImages(trail.images, trail.image);
  }, [trail, trailPhotos]);

  const tourGallery = useMemo(() => {
    if (galleryImages.length) {
      return galleryImages;
    }
    return trail?.image ? [trail.image] : [];
  }, [galleryImages, trail?.image]);

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

  const galleryItems = useMemo(() => buildGalleryItems(activeTab, trail, galleryImages), [activeTab, galleryImages, trail]);
  const isTour = activeTab === 'tour';
  const activeColor = theme.colors.buttonPrimary;
  const tourHeroUri = tourGallery[tourPhotoIndex] ?? trail?.image ?? '';

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
          <Animated.View style={[styles.tourHeroImage, { opacity: imageFade }]}>
            <Image source={{ uri: tourHeroUri }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
          </Animated.View>
          <View style={styles.tourOverlay} />

          <View style={[styles.tourPhotoBadge, { top: Math.max(insets.top + 72, 96) }]}>
            <Text style={styles.tourPhotoBadgeText}>
              {tourGallery.length > 1 ? `${tourPhotoIndex + 1} / ${tourGallery.length}` : '1 / 1'}
            </Text>
          </View>

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
            <View style={styles.galleryGrid}>
              {galleryItems.map((item) => (
                <View key={item.id} style={[styles.galleryCard, { height: item.height }]}>
                  <Image source={{ uri: item.imageUri }} style={styles.galleryImage} resizeMode="cover" />
                  <View style={styles.galleryGradient} />
                  <Text style={styles.galleryLabel}>{item.label}</Text>
                </View>
              ))}
            </View>
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

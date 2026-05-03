import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
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
import Svg, { Circle, Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootStackParamList } from '../navigation/types';
import { getTrailById, getTrailPhotos, type Trail, type TrailPhoto } from '../api/trailsApi';
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
const PROFILE_HEIGHT = 86;

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

function buildProfileSeries(trail: Trail | null) {
  const source = trail?.routeCoordinates;

  if (!source?.length) {
    return [28, 48, 34, 54, 36, 44, 30, 62, 40, 38, 56, 42, 35, 47, 33, 50];
  }

  const sampleSize = 42;
  const total = source.length;

  return Array.from({ length: sampleSize }, (_, index) => {
    const sourceIndex = Math.min(total - 1, Math.round((index / Math.max(1, sampleSize - 1)) * (total - 1)));
    const [lng, lat] = source[sourceIndex];
    const prev = source[Math.max(0, sourceIndex - 1)];
    const next = source[Math.min(total - 1, sourceIndex + 1)];
    const slope = Math.abs((next?.[1] ?? lat) - (prev?.[1] ?? lat));
    const base = ((lat * 10000) % 1) * 38;
    const variation = ((lng * 10000) % 1) * 16;
    const spike = slope * 22000;
    return 22 + base + variation + spike;
  });
}

function buildChartPath(values: number[], chartWidth: number, chartHeight: number) {
  if (!values.length) {
    return '';
  }

  const maxValue = Math.max(...values);
  const minValue = Math.min(...values);
  const range = Math.max(1, maxValue - minValue);

  return values.reduce((path, value, index) => {
    const x = values.length === 1 ? 0 : (index / (values.length - 1)) * chartWidth;
    const y = chartHeight - ((value - minValue) / range) * chartHeight;
    return `${path}${index === 0 ? 'M' : ' L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
  }, '');
}

function buildVisiblePath(values: number[], progress: number, chartWidth: number, chartHeight: number) {
  const visibleCount = Math.max(2, Math.round(values.length * progress));
  return buildChartPath(values.slice(0, visibleCount), chartWidth, chartHeight);
}

function buildAxisLabels(distance: number) {
  const safeDistance = Number.isFinite(distance) && distance > 0 ? distance : 0;
  return ['0 km', `${(safeDistance / 2).toFixed(1)} km`, `${safeDistance.toFixed(1)} km`];
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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<MediaTab>('latest');

  useEffect(() => {
    let cancelled = false;

    const loadTrail = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const [nextTrail, nextPhotos] = await Promise.all([
          getTrailById(trailId),
          getTrailPhotos(trailId).catch(() => []),
        ]);

        if (!cancelled) {
          setTrail(nextTrail);
          setTrailPhotos(nextPhotos);
        }
      } catch (nextError) {
        if (!cancelled) {
          setError(nextError instanceof Error ? nextError.message : 'Unable to load trail media.');
          setTrail(null);
          setTrailPhotos([]);
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

  const chartSeries = useMemo(() => buildProfileSeries(trail), [trail]);
  const fullChartPath = useMemo(() => buildChartPath(chartSeries, PROFILE_WIDTH, PROFILE_HEIGHT), [chartSeries]);
  const visibleChartPath = useMemo(() => buildVisiblePath(chartSeries, 0.28, PROFILE_WIDTH, PROFILE_HEIGHT), [chartSeries]);
  const markerIndex = Math.max(1, Math.round((chartSeries.length - 1) * 0.28));
  const markerX = chartSeries.length <= 1 ? 0 : (markerIndex / (chartSeries.length - 1)) * PROFILE_WIDTH;
  const axisLabels = buildAxisLabels(trail?.distance ?? 0);
  const galleryItems = useMemo(() => buildGalleryItems(activeTab, trail, galleryImages), [activeTab, galleryImages, trail]);
  const isTour = activeTab === 'tour';
  const activeColor = theme.colors.buttonPrimary;

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
          <Image
            source={{ uri: galleryImages[0] ?? trail.image }}
            style={styles.tourHeroImage}
            resizeMode="cover"
          />
          <View style={styles.tourOverlay} />

          <View style={[styles.tourPanelWrap, { bottom: Math.max(insets.bottom + 96, 108) }]}>
            <BlurView intensity={85} tint="light" style={styles.tourPanel}>
              <View style={styles.metricRow}>
                <Text style={styles.metricText}>
                  {formatDistance(trail.distance)}
                  <Text style={styles.metricDivider}>  |  </Text>
                  {formatElevation(trail.elevationGain)}
                </Text>
                <Ionicons name="pause" size={28} color={theme.colors.textPrimary} />
              </View>

              <View style={styles.chartBlock}>
                <Svg width={PROFILE_WIDTH} height={PROFILE_HEIGHT} viewBox={`0 0 ${PROFILE_WIDTH} ${PROFILE_HEIGHT}`}>
                  <Path
                    d={fullChartPath}
                    fill="none"
                    stroke="rgba(110,117,112,0.32)"
                    strokeWidth={4}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <Path
                    d={visibleChartPath}
                    fill="none"
                    stroke="#1C2117"
                    strokeWidth={4.2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {chartSeries.map((value, index) => {
                    const x = chartSeries.length <= 1 ? 0 : (index / (chartSeries.length - 1)) * PROFILE_WIDTH;
                    const maxValue = Math.max(...chartSeries);
                    const minValue = Math.min(...chartSeries);
                    const range = Math.max(1, maxValue - minValue);
                    const y = PROFILE_HEIGHT - ((value - minValue) / range) * PROFILE_HEIGHT;
                    const isVisible = index <= markerIndex;
                    return (
                      <Circle
                        key={`${index}-${value}`}
                        cx={x}
                        cy={y}
                        r={index % 5 === 0 ? 3.4 : 0}
                        fill={isVisible ? '#AEB5AE' : '#C7CBC8'}
                        stroke="#F6F8F5"
                        strokeWidth={1.8}
                      />
                    );
                  })}

                  <Path
                    d={`M ${markerX.toFixed(2)} 0 L ${markerX.toFixed(2)} ${PROFILE_HEIGHT}`}
                    stroke="#11180F"
                    strokeWidth={2.2}
                    strokeLinecap="round"
                  />
                </Svg>

                <View style={styles.axisLabels}>
                  {axisLabels.map((label) => (
                    <Text key={label} style={styles.axisLabelText}>
                      {label}
                    </Text>
                  ))}
                </View>
              </View>

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
  metricText: {
    color: '#10170E',
    fontSize: 18,
    fontWeight: '700',
  },
  metricDivider: {
    color: 'rgba(16,23,14,0.18)',
    fontWeight: '400',
  },
  chartBlock: {
    paddingHorizontal: 6,
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

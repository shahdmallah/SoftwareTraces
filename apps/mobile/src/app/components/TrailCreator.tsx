// Updated to support staged trail creation with start, optional middle waypoints, end, and loop routes.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import Mapbox from '@rnmapbox/maps';
import type { Feature, FeatureCollection, LineString, Point } from 'geojson';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createTrail, uploadTrailPhoto, getTrailStats, publishTrail, type TrailStatsResponse } from '../api/trailsApi';
import { setTrailRouteCoordinates } from '../state/trailRoutes';

type LngLat = [number, number];
type DrawingStage = 'start' | 'middle' | 'end';

type SaveTrailBody = {
  name: string;
  description?: string;
  coordinates: LngLat[];
  stats: TrailStatsResponse;
};

type DirectionsResponse = {
  routes?: Array<{
    distance: number;
    duration: number;
    geometry?: {
      coordinates?: LngLat[];
    };
  }>;
};

export type TrailCreatorProps = {
  styleURL?: string;
  initialCenter?: LngLat;
  initialZoom?: number;
  onSaved?: (payload: SaveTrailBody & { id?: string; status: 'draft' | 'published' }) => void;
};

const MAPBOX_ACCESS_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ?? '';

const AVAILABLE_FEATURES = [
  'Water',
  'Historical',
  'Olive',
  'Summit',
  'Scenic',
  'Wildlife',
  'Cultural',
  'Adventure'
];

function formatDuration(minutes: number) {
  if (!Number.isFinite(minutes) || minutes <= 0) return '--';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h <= 0) return `${m}m`;
  return `${h}h ${m}m`;
}

async function pickTrailImage(): Promise<string | null> {
  try {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Media library access is required to choose a trail photo.');
      return null;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
      aspect: [4, 3],
    });

    if (result.canceled || !result.assets.length) {
      return null;
    }

    return result.assets[0].uri;
  } catch (error) {
    console.warn('Trail image picker failed:', error);
    return null;
  }
}

async function reverseGeocodeRegion(coordinate: LngLat): Promise<string> {
  if (!MAPBOX_ACCESS_TOKEN) {
    return '';
  }

  try {
    const url = new URL(`https://api.mapbox.com/geocoding/v5/mapbox.places/${coordinate[0]},${coordinate[1]}.json`);
    url.searchParams.set('access_token', MAPBOX_ACCESS_TOKEN);
    url.searchParams.set('types', 'place,locality,region,neighborhood,district');
    url.searchParams.set('language', 'en');
    url.searchParams.set('limit', '1');

    const res = await fetch(url.toString());
    if (!res.ok) {
      return '';
    }

    const data = await res.json() as {
      features?: Array<{
        text?: string;
        place_name?: string;
        place_type?: string[];
        context?: Array<{ text?: string; id?: string }>;
      }>;
    };
    const feature = data.features?.[0];
    if (!feature) {
      return '';
    }

    const neighborhoodContext = feature.context?.find((item) => item.id?.startsWith('neighborhood'))
      ?? feature.context?.find((item) => item.id?.startsWith('district'))
      ?? (feature.place_type?.includes('neighborhood') || feature.place_type?.includes('district') ? feature : undefined);
    const placeContext = feature.context?.find((item) => item.id?.startsWith('place'))
      ?? feature.context?.find((item) => item.id?.startsWith('locality'))
      ?? (feature.place_type?.includes('place') || feature.place_type?.includes('locality') ? feature : undefined);
    const fallbackRegionContext = feature.context?.find((item) => item.id?.startsWith('region'));

    const neighborhoodName = neighborhoodContext?.text?.trim();
    const cityName = placeContext?.text?.trim() ?? fallbackRegionContext?.text?.trim();

    if (neighborhoodName && cityName && neighborhoodName.toLowerCase() !== cityName.toLowerCase()) {
      return `${neighborhoodName} - ${cityName}`;
    }

    if (neighborhoodName) {
      return neighborhoodName;
    }

    if (cityName) {
      return cityName;
    }

    if (feature.text?.trim()) {
      return feature.text.trim();
    }

    if (feature.place_name?.trim()) {
      return feature.place_name.split(',')[0].trim();
    }

    return '';
  } catch (error) {
    console.warn('Region reverse geocode failed:', error);
    return '';
  }
}

function toLineFeature(routeCoordinates: LngLat[]): FeatureCollection {
  const lineFeature: Feature<LineString>[] =
    routeCoordinates.length >= 2
      ? [
          {
            type: 'Feature',
            properties: {},
            geometry: { type: 'LineString', coordinates: routeCoordinates },
          },
        ]
      : [];

  return {
    type: 'FeatureCollection',
    features: lineFeature,
  };
}

function toPointFeature(coordinate: LngLat | null): FeatureCollection {
  return toPointsFeatureCollection(coordinate ? [coordinate] : []);
}

function toPointsFeatureCollection(coordinates: LngLat[]): FeatureCollection {
  const pointFeatures: Feature<Point>[] = coordinates.map((coordinate, index) => ({
    type: 'Feature',
    properties: { index },
    geometry: { type: 'Point', coordinates: coordinate },
  }));

  return {
    type: 'FeatureCollection',
    features: pointFeatures,
  };
}

function difficultyTone(difficulty: string) {
  switch (difficulty) {
    case 'easy':
    case 'Easy':
      return { bg: 'rgba(122,154,58,0.16)', fg: '#5B7A2C', dot: '#7A9A3A' };
    case 'moderate':
    case 'Moderate':
      return { bg: 'rgba(212,168,67,0.18)', fg: '#8E6A09', dot: '#D4A843' };
    case 'hard':
    case 'Hard':
      return { bg: 'rgba(187,40,35,0.14)', fg: '#BB2823', dot: '#BB2823' };
    case 'expert':
    case 'Expert':
      return { bg: 'rgba(99,14,19,0.14)', fg: '#630E13', dot: '#630E13' };
    default:
      return { bg: 'rgba(44,36,24,0.10)', fg: '#2C2418', dot: '#8A7A6A' };
  }
}

function estimateDifficulty(distanceMeters: number) {
  const distanceKm = distanceMeters / 1000;
  if (distanceKm < 5) return 'easy';
  if (distanceKm < 10) return 'moderate';
  if (distanceKm < 16) return 'hard';
  return 'expert';
}

function toFallbackStats(distanceMeters: number, durationSeconds: number): TrailStatsResponse {
  return {
    length_meters: distanceMeters,
    elevation_gain_meters: 0,
    estimated_duration_minutes: Math.max(1, Math.round(durationSeconds / 60)),
    difficulty: estimateDifficulty(distanceMeters),
  };
}

function buildDirectionsUrl(waypoints: LngLat[]) {
  const coordinates = waypoints.map(([lng, lat]) => `${lng},${lat}`).join(';');
  const params = new URLSearchParams({
    access_token: MAPBOX_ACCESS_TOKEN,
    geometries: 'geojson',
    overview: 'full',
  });

  return `https://api.mapbox.com/directions/v5/mapbox/walking/${coordinates}?${params.toString()}`;
}

export function TrailCreator({
  styleURL,
  initialCenter = [35.24, 31.78],
  initialZoom = 7.8,
  onSaved,
}: TrailCreatorProps) {
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<Mapbox.Camera>(null);

  const [isDrawing, setIsDrawing] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [drawingStage, setDrawingStage] = useState<DrawingStage>('start');
  const [isLoop, setIsLoop] = useState(false);
  const [startCoordinate, setStartCoordinate] = useState<LngLat | null>(null);
  const [middleCoordinates, setMiddleCoordinates] = useState<LngLat[]>([]);
  const [endCoordinate, setEndCoordinate] = useState<LngLat | null>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<LngLat[]>([]);

  const [stats, setStats] = useState<TrailStatsResponse | null>(null);

  useEffect(() => {
    const fetchRegion = async () => {
      if (!startCoordinate) {
        setRegion('');
        return;
      }

      setIsRegionLoading(true);
      const fetchedRegion = await reverseGeocodeRegion(startCoordinate);
      setIsRegionLoading(false);
      setRegion(fetchedRegion || '');
    };

    void fetchRegion();
  }, [startCoordinate]);
  const [isCalculating, setIsCalculating] = useState(false);
  const [calcError, setCalcError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [region, setRegion] = useState('');
  const [isRegionLoading, setIsRegionLoading] = useState(false);
  const [features, setFeatures] = useState<string[]>([]);
  const [trailImage, setTrailImage] = useState<string | null>(null);
  const [isPickingImage, setIsPickingImage] = useState(false);
  const [savingMode, setSavingMode] = useState<'draft' | 'published' | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  const [zoomLevel, setZoomLevel] = useState(initialZoom);
  const [pitch, setPitch] = useState(0); // 0 for 2D, 45 for 3D

  const zoomIn = () => setZoomLevel(prev => Math.min(prev + 1, 20));
  const zoomOut = () => setZoomLevel(prev => Math.max(prev - 1, 0));
  const toggle3D = () => setPitch(prev => prev === 0 ? 45 : 0);

  const routeGeojson = useMemo(() => toLineFeature(routeCoordinates), [routeCoordinates]);
  const startGeojson = useMemo(() => toPointFeature(startCoordinate), [startCoordinate]);
  const middleGeojson = useMemo(() => toPointsFeatureCollection(middleCoordinates), [middleCoordinates]);
  const endGeojson = useMemo(() => toPointFeature(endCoordinate), [endCoordinate]);

  const waypointCount = middleCoordinates.length + (startCoordinate ? 1 : 0) + (endCoordinate ? 1 : 0);
  const canUndo = isDrawing && waypointCount > 0;
  const canMarkEnd = isDrawing && Boolean(startCoordinate) && drawingStage === 'middle';
  const canFinish = isDrawing && Boolean(startCoordinate && endCoordinate) && !isCalculating;

  const begin = () => {
    setSaveSuccess(null);
    setSaveError(null);
    setCalcError(null);
    setStats(null);
    setName('');
    setDescription('');
    setRegion('');
    setFeatures([]);
    setStartCoordinate(null);
    setMiddleCoordinates([]);
    setEndCoordinate(null);
    setRouteCoordinates([]);
    setIsLoop(false);
    setDrawingStage('start');
    setIsDrawing(true);
    setIsFinished(false);
  };

  const clear = () => {
    setName('');
    setDescription('');
    setRegion('');
    setFeatures([]);
    setStartCoordinate(null);
    setMiddleCoordinates([]);
    setEndCoordinate(null);
    setRouteCoordinates([]);
    setIsLoop(false);
    setDrawingStage('start');
    setIsDrawing(false);
    setIsFinished(false);
    setStats(null);
    setCalcError(null);
    setSaveError(null);
    setSaveSuccess(null);
  };

  const undo = () => {
    setSaveSuccess(null);
    setSaveError(null);
    setCalcError(null);
    setStats(null);
    setRouteCoordinates([]);
    setIsFinished(false);

    if (endCoordinate) {
      setEndCoordinate(null);
      setDrawingStage('end');
      return;
    }

    if (middleCoordinates.length) {
      setMiddleCoordinates((current) => current.slice(0, -1));
      setDrawingStage('middle');
      return;
    }

    if (startCoordinate) {
      setStartCoordinate(null);
      setDrawingStage('start');
    }
  };

  const buildManualWaypoints = () => {
    if (!startCoordinate || !endCoordinate) {
      return [];
    }

    const points = [startCoordinate, ...middleCoordinates, endCoordinate];
    return isLoop ? [...points, startCoordinate] : points;
  };

  const fetchTrail = async () => {
    const waypoints = buildManualWaypoints();

    if (waypoints.length < 2) {
      setCalcError('Choose a start and end point first.');
      return;
    }

    setSaveSuccess(null);
    setSaveError(null);
    setIsCalculating(true);
    setCalcError(null);
    setStats(null);

    try {
      if (!MAPBOX_ACCESS_TOKEN) {
        throw new Error('Missing EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN.');
      }

      const res = await fetch(buildDirectionsUrl(waypoints));
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(text || `Directions request failed (${res.status})`);
      }

      const json = (await res.json()) as DirectionsResponse;
      const route = json.routes?.[0];
      const geometryCoordinates = route?.geometry?.coordinates;

      if (!route || !geometryCoordinates || geometryCoordinates.length < 2) {
        throw new Error('No route was returned for those points.');
      }

      setRouteCoordinates(geometryCoordinates);
      setIsDrawing(false);
      setIsFinished(true);

      try {
        const calculateJson = await getTrailStats({ coordinates: geometryCoordinates });
        setStats(calculateJson);
      } catch {
        setStats(toFallbackStats(route.distance, route.duration));
      }
    } catch (e) {
      setRouteCoordinates([]);
      setIsFinished(false);
      setCalcError(e instanceof Error ? e.message : 'Failed to calculate stats.');
    } finally {
      setIsCalculating(false);
    }
  };

  const save = async (status: 'draft' | 'published') => {
    if (!isFinished || !stats) return;
    if (!name.trim()) {
      Alert.alert('Missing name', 'Please enter a trail name.');
      return;
    }
    if (status === 'published' && !description.trim()) {
      Alert.alert('Missing description', 'Please add a description before publishing this trail.');
      return;
    }

    setSavingMode(status);
    setSaveError(null);
    setSaveSuccess(null);
    try {
      const payload: SaveTrailBody = {
        name: name.trim(),
        description: description.trim() || undefined,
        coordinates: routeCoordinates,
        stats,
      };
      const json = await createTrail(payload);
      if (trailImage) {
        try {
          await uploadTrailPhoto(json.data.id, trailImage);
        } catch (uploadError) {
          console.warn('Trail photo upload failed:', uploadError);
          setSaveError('Trail saved, but photo upload failed.');
        }
      }

      if (status === 'published') {
        await publishTrail(json.data.id);
      }

      setTrailRouteCoordinates(json.data.id, routeCoordinates);
      setSaveSuccess(status === 'published' ? 'Published!' : 'Draft saved!');
      onSaved?.({ ...payload, id: json.data.id, status });
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : status === 'published' ? 'Failed to publish trail.' : 'Failed to save draft.');
    } finally {
      setSavingMode(null);
    }
  };

  const handleMapPress = (coord: LngLat | null) => {
    if (!isDrawing || !coord || coord.length !== 2 || isCalculating) {
      return;
    }

    setSaveSuccess(null);
    setSaveError(null);
    setCalcError(null);
    setStats(null);
    setRouteCoordinates([]);
    setIsFinished(false);

    if (drawingStage === 'start') {
      setStartCoordinate(coord);
      setMiddleCoordinates([]);
      setEndCoordinate(null);
      setDrawingStage('middle');
      return;
    }

    if (drawingStage === 'middle') {
      setMiddleCoordinates((current) => [...current, coord]);
      return;
    }

    setEndCoordinate(coord);
  };

  const stageTitle =
    drawingStage === 'start'
      ? 'Tap a starting point'
      : drawingStage === 'middle'
      ? 'Add middle points or switch to the end point'
      : 'Tap the ending point';

  const stageSummary = [
    startCoordinate ? 'Start set' : 'Choose a start',
    middleCoordinates.length ? `${middleCoordinates.length} middle point${middleCoordinates.length === 1 ? '' : 's'}` : 'No middle points',
    endCoordinate ? 'End set' : 'Choose an end',
    isLoop ? 'Loop on' : 'Loop off',
  ].join(' | ');

  return (
    <View style={styles.root}>
      <Mapbox.MapView
        style={styles.map}
        styleURL={styleURL}
        compassEnabled
        scaleBarEnabled={false}
        logoEnabled={false}
        attributionEnabled={false}
        onPress={(e) => {
          const coord = (e.geometry?.coordinates ?? null) as unknown as LngLat | null;
          handleMapPress(coord);
        }}
      >
        <Mapbox.Camera
          ref={cameraRef}
          centerCoordinate={initialCenter}
          zoomLevel={zoomLevel}
          pitch={pitch}
        />

        <Mapbox.ShapeSource id="trail-route-source" shape={routeGeojson}>
          <Mapbox.LineLayer
            id="trail-line"
            style={{
              lineColor: '#1D9E75',
              lineWidth: 5,
              lineJoin: 'round',
              lineCap: 'round',
              lineOpacity: 0.92,
              lineDasharray: [1.2, 1.2],
            }}
          />
        </Mapbox.ShapeSource>

        <Mapbox.ShapeSource id="trail-start-source" shape={startGeojson}>
          <Mapbox.CircleLayer
            id="trail-start-point"
            style={{
              circleColor: '#FFFFFF',
              circleStrokeColor: '#1D9E75',
              circleStrokeWidth: 3,
              circleRadius: 7,
            }}
          />
        </Mapbox.ShapeSource>

        <Mapbox.ShapeSource id="trail-middle-source" shape={middleGeojson}>
          <Mapbox.CircleLayer
            id="trail-middle-points"
            style={{
              circleColor: '#FFFFFF',
              circleStrokeColor: '#D4A843',
              circleStrokeWidth: 2.5,
              circleRadius: 5,
            }}
          />
        </Mapbox.ShapeSource>

        <Mapbox.ShapeSource id="trail-end-source" shape={endGeojson}>
          <Mapbox.CircleLayer
            id="trail-end-point"
            style={{
              circleColor: '#FFFFFF',
              circleStrokeColor: '#D85A30',
              circleStrokeWidth: 3,
              circleRadius: 7,
            }}
          />
        </Mapbox.ShapeSource>
      </Mapbox.MapView>

      <View style={styles.mapControls}>
        <Pressable style={styles.controlButton} onPress={zoomIn}>
          <Ionicons name="add" size={24} color="#2C2418" />
        </Pressable>
        <Pressable style={styles.controlButton} onPress={zoomOut}>
          <Ionicons name="remove" size={24} color="#2C2418" />
        </Pressable>
        <Pressable style={[styles.controlButton, pitch > 0 && styles.controlButtonActive]} onPress={toggle3D}>
          <Ionicons name="cube-outline" size={20} color={pitch > 0 ? "#fff" : "#2C2418"} />
        </Pressable>
      </View>

      <View style={[styles.topBar, { paddingTop: Math.max(12, insets.top + 8) }]}>
        <View style={styles.brandPill}>
          <View style={styles.brandDot} />
          <Text style={styles.brandText}>Trail Creator</Text>
        </View>

        <View style={styles.topActions}>
          {!isDrawing && !isFinished ? (
            <Pressable style={[styles.iconButton, styles.primaryIconButton]} onPress={begin}>
              <Ionicons name="git-compare-outline" size={18} color="#fff" />
              <Text style={styles.primaryIconText}>New trail</Text>
            </Pressable>
          ) : null}

          {isDrawing ? (
            <>
              <Pressable style={styles.iconButton} onPress={undo} disabled={!canUndo}>
                <Ionicons name="arrow-undo-outline" size={18} color={canUndo ? '#2C2418' : '#B0A090'} />
                <Text style={[styles.iconText, !canUndo && styles.iconTextDisabled]}>Undo</Text>
              </Pressable>

              <Pressable
                style={[styles.iconButton, isLoop && styles.loopIconButton]}
                onPress={() => setIsLoop((current) => !current)}
              >
                <Ionicons name="sync-outline" size={18} color={isLoop ? '#FFFFFF' : '#2C2418'} />
                <Text style={[styles.iconText, isLoop && styles.loopText]}>Loop</Text>
              </Pressable>

              <Pressable
                style={[styles.iconButton, !canMarkEnd && styles.iconButtonDisabled]}
                onPress={() => {
                  if (canMarkEnd) {
                    setDrawingStage('end');
                  }
                }}
                disabled={!canMarkEnd}
              >
                <Ionicons name="flag-outline" size={18} color={canMarkEnd ? '#2C2418' : '#B0A090'} />
                <Text style={[styles.iconText, !canMarkEnd && styles.iconTextDisabled]}>Set end</Text>
              </Pressable>

              <Pressable style={[styles.iconButton, styles.dangerIconButton]} onPress={clear}>
                <Ionicons name="trash-outline" size={18} color="#BB2823" />
                <Text style={[styles.iconText, styles.dangerText]}>Clear</Text>
              </Pressable>
            </>
          ) : null}

          {isFinished ? (
            <Pressable style={[styles.iconButton, styles.dangerIconButton]} onPress={clear}>
              <Ionicons name="refresh-outline" size={18} color="#BB2823" />
              <Text style={[styles.iconText, styles.dangerText]}>Start over</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {(isDrawing || isFinished) && (
        <View style={[styles.bottomPanelWrap, { paddingBottom: Math.max(12, insets.bottom + 10) }]}>
          <View style={styles.bottomPanel}>
            <View style={styles.panelHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.panelTitle}>{isDrawing ? stageTitle : 'Trail details'}</Text>
                <Text style={styles.panelSubtitle}>{stageSummary}</Text>
              </View>
              {isCalculating ? <ActivityIndicator /> : null}
            </View>

            {calcError ? <Text style={styles.errorText}>{calcError}</Text> : null}

            {isDrawing ? (
              <View style={styles.drawingActionsRow}>
                <Pressable
                  style={[styles.secondaryActionButton, !canFinish && styles.secondaryActionButtonDisabled]}
                  disabled={!canFinish}
                  onPress={() => void fetchTrail()}
                >
                  <Ionicons name="sparkles-outline" size={16} color={canFinish ? '#2C2418' : '#B0A090'} />
                  <Text style={[styles.secondaryActionText, !canFinish && styles.iconTextDisabled]}>
                    Build route
                  </Text>
                </Pressable>
              </View>
            ) : null}

            {stats ? (
              <View style={styles.statsGrid}>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{(stats.length_meters / 1000).toFixed(2)}</Text>
                  <Text style={styles.statLabel}>km</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{Math.round(stats.elevation_gain_meters)}</Text>
                  <Text style={styles.statLabel}>m gain</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{formatDuration(stats.estimated_duration_minutes)}</Text>
                  <Text style={styles.statLabel}>time</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: difficultyTone(stats.difficulty).bg }]}>
                  <View style={[styles.badgeDot, { backgroundColor: difficultyTone(stats.difficulty).dot }]} />
                  <Text style={[styles.badgeText, { color: difficultyTone(stats.difficulty).fg }]}>
                    {stats.difficulty}
                  </Text>
                </View>
              </View>
            ) : null}

            {isFinished ? (
              <>
                <View style={styles.formRow}>
                  <Text style={styles.inputLabel}>Trail name</Text>
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    placeholder={isLoop ? 'e.g. Wadi Qelt Loop' : 'e.g. Wadi Qelt Traverse'}
                    placeholderTextColor="#9E8E80"
                    style={styles.input}
                  />
                </View>
                <View style={styles.formRow}>
                  <Text style={styles.inputLabel}>Description</Text>
                  <TextInput
                    value={description}
                    onChangeText={setDescription}
                    placeholder="Notes, tips, best season, water sources..."
                    placeholderTextColor="#9E8E80"
                    style={[styles.input, styles.textarea]}
                    multiline
                  />
                </View>
                <View style={styles.formRow}>
                  <Text style={styles.inputLabel}>Region/City</Text>
                  <TextInput
                    value={region}
                    onChangeText={setRegion}
                    placeholder={isRegionLoading ? 'Deriving area and city from start point...' : 'e.g. Old City - Nablus'}
                    placeholderTextColor="#9E8E80"
                    style={styles.input}
                  />
                </View>
                <View style={styles.formRow}>
                  <Text style={styles.inputLabel}>Features</Text>
                  <View style={styles.featuresContainer}>
                    {AVAILABLE_FEATURES.map((feature) => (
                      <Pressable
                        key={feature}
                        style={[
                          styles.featureChip,
                          features.includes(feature) && styles.featureChipSelected,
                        ]}
                        onPress={() => {
                          setFeatures(prev =>
                            prev.includes(feature)
                              ? prev.filter(f => f !== feature)
                              : [...prev, feature]
                          );
                        }}
                      >
                        <Text
                          style={[
                            styles.featureChipText,
                            features.includes(feature) && styles.featureChipTextSelected,
                          ]}
                        >
                          {feature}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                <View style={styles.formRow}>
                  <Text style={styles.inputLabel}>Trail photo</Text>
                  <View style={styles.photoRow}>
                    {trailImage ? (
                      <Image source={{ uri: trailImage }} style={styles.photoPreview} />
                    ) : (
                      <View style={styles.photoPlaceholder}>
                        <Text style={styles.photoPlaceholderText}>No photo selected</Text>
                      </View>
                    )}
                    <View style={styles.photoActions}>
                      <Pressable
                        style={styles.photoButton}
                        onPress={async () => {
                          setIsPickingImage(true);
                          const uri = await pickTrailImage();
                          setIsPickingImage(false);
                          if (uri) setTrailImage(uri);
                        }}
                      >
                        <Text style={styles.photoButtonText}>
                          {isPickingImage ? 'Picking...' : 'Select photo'}
                        </Text>
                      </Pressable>
                      {trailImage ? (
                        <Pressable
                          style={[styles.photoButton, styles.photoRemoveButton]}
                          onPress={() => setTrailImage(null)}
                        >
                          <Text style={[styles.photoButtonText, styles.photoRemoveButtonText]}>Remove</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                </View>

                {saveError ? <Text style={styles.errorText}>{saveError}</Text> : null}
                {saveSuccess ? <Text style={styles.successText}>{saveSuccess}</Text> : null}

                <Pressable
                  style={[styles.saveButton, (!stats || Boolean(savingMode)) && { opacity: 0.7 }]}
                  disabled={!stats || Boolean(savingMode)}
                  onPress={() => void save('draft')}
                >
                  {savingMode === 'draft' ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="document-text-outline" size={18} color="#fff" />
                      <Text style={styles.saveButtonText}>Save draft</Text>
                    </>
                  )}
                </Pressable>
                <Pressable
                  style={[styles.publishButton, (!stats || Boolean(savingMode)) && { opacity: 0.7 }]}
                  disabled={!stats || Boolean(savingMode)}
                  onPress={() => void save('published')}
                >
                  {savingMode === 'published' ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
                      <Text style={styles.saveButtonText}>Publish</Text>
                    </>
                  )}
                </Pressable>
              </>
            ) : (
              <Text style={styles.hint}>
                Tap once to place the start, add as many middle waypoints as you need, switch to end mode, then tap the ending point. Turn on loop to close the route back to the start.
              </Text>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#EAE2CC' },
  map: { ...StyleSheet.absoluteFillObject },
  mapControls: {
    position: 'absolute',
    right: 12,
    bottom: 120, // Above the bottom panel
    flexDirection: 'column',
    gap: 8,
  },
  controlButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderWidth: 1,
    borderColor: 'rgba(44,36,24,0.10)',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlButtonActive: {
    backgroundColor: '#1D9E75',
    borderColor: 'rgba(29,158,117,0.3)',
  },

  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    paddingBottom: 10,
    gap: 10,
  },
  brandPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(44,36,24,0.10)',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
    elevation: 8,
  },
  brandDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#1D9E75' },
  brandText: { color: '#2C2418', fontWeight: '900', fontSize: 14 },

  topActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  iconButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderWidth: 1,
    borderColor: 'rgba(44,36,24,0.12)',
  },
  primaryIconButton: {
    backgroundColor: '#0F5A38',
    borderColor: 'rgba(15,90,56,0.35)',
  },
  dangerIconButton: {
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderColor: 'rgba(187,40,35,0.22)',
  },
  loopIconButton: {
    backgroundColor: '#630E13',
    borderColor: 'rgba(99,14,19,0.28)',
  },
  iconButtonDisabled: {
    opacity: 0.65,
  },
  iconText: { fontSize: 12, fontWeight: '800', color: '#2C2418' },
  iconTextDisabled: { color: '#B0A090' },
  primaryIconText: { fontSize: 12, fontWeight: '900', color: '#fff' },
  loopText: { color: '#fff' },
  dangerText: { color: '#BB2823' },

  bottomPanelWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 12,
  },
  bottomPanel: {
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(44,36,24,0.10)',
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowOffset: { width: 0, height: -8 },
    shadowRadius: 22,
    elevation: 14,
  },
  panelHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  panelTitle: { fontSize: 14, fontWeight: '900', color: '#2C2418' },
  panelSubtitle: { marginTop: 3, fontSize: 11, color: '#8A7A6A', fontWeight: '700' },
  drawingActionsRow: { marginBottom: 10 },
  secondaryActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 11,
    borderRadius: 14,
    backgroundColor: '#F7F3E7',
    borderWidth: 1,
    borderColor: 'rgba(44,36,24,0.08)',
  },
  secondaryActionButtonDisabled: {
    opacity: 0.65,
  },
  secondaryActionText: {
    color: '#2C2418',
    fontWeight: '800',
    fontSize: 13,
  },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8, marginBottom: 10 },
  statCard: {
    flexGrow: 1,
    minWidth: 88,
    backgroundColor: '#F7F3E7',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(44,36,24,0.06)',
  },
  statValue: { fontSize: 16, fontWeight: '900', color: '#2C2418' },
  statLabel: { marginTop: 2, fontSize: 11, fontWeight: '800', color: '#8A7A6A' },

  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(44,36,24,0.06)',
  },
  badgeDot: { width: 10, height: 10, borderRadius: 5 },
  badgeText: { fontSize: 12, fontWeight: '900' },

  formRow: { marginTop: 10 },
  inputLabel: { fontSize: 12, fontWeight: '900', color: '#2C2418', marginBottom: 6 },
  input: {
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(44,36,24,0.12)',
    color: '#2C2418',
    fontSize: 14,
    fontWeight: '600',
  },
  inputDisabled: {
    backgroundColor: '#F5F2EA',
    color: '#8A7A6A',
  },
  textarea: { minHeight: 86, textAlignVertical: 'top' },

  featuresContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  featureChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F7F3E7',
    borderWidth: 1,
    borderColor: 'rgba(44,36,24,0.12)',
  },
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  photoPreview: {
    width: 100,
    height: 100,
    borderRadius: 16,
    backgroundColor: '#EFF7F1',
    borderWidth: 1,
    borderColor: 'rgba(15,90,56,0.18)',
  },
  photoPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 16,
    backgroundColor: '#F1FAF4',
    borderWidth: 1,
    borderColor: 'rgba(15,90,56,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
  },
  photoPlaceholderText: {
    fontSize: 12,
    color: '#8A7A6A',
    textAlign: 'center',
  },
  photoActions: { flex: 1, justifyContent: 'center', gap: 10 },
  photoButton: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: '#0F5A38',
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 120,
  },
  photoButtonText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 12,
  },
  photoRemoveButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(15,90,56,0.18)',
  },
  photoRemoveButtonText: {
    color: '#0F5A38',
  },
  featureChipSelected: {
    backgroundColor: '#0F5A38',
    borderColor: 'rgba(15,90,56,0.3)',
  },
  featureChipText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#2C2418',
  },
  featureChipTextSelected: {
    color: '#fff',
  },

  saveButton: {
    marginTop: 12,
    backgroundColor: '#630E13',
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  publishButton: {
    marginTop: 10,
    backgroundColor: '#0F5A38',
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  saveButtonText: { color: '#fff', fontWeight: '900', fontSize: 14 },

  hint: { marginTop: 10, fontSize: 10, color: '#8A7A6A', fontWeight: '700' },
  errorText: { marginTop: 8, fontSize: 11, color: '#BB2823', fontWeight: '800' },
  successText: { marginTop: 8, fontSize: 11, color: '#1D9E75', fontWeight: '900' },
});

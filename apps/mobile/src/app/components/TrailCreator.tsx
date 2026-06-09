// Updated to support staged trail creation with start, optional middle waypoints, end, and loop routes.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, Alert, ScrollView, useWindowDimensions } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import Mapbox from '@rnmapbox/maps';
import type { Feature, FeatureCollection, LineString, Point } from 'geojson';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  analyzeTrailRoute,
  checkDuplicateTrail,
  createTrail,
  parseTrailDescription,
  uploadTrailPhoto,
  publishTrail,
  type GeneratedTrailSuggestion,
  type DuplicateTrailWarning,
  type TrailAnalysisResponse,
  type TrailStatsResponse,
} from '../api/trailsApi';
import { ApiError } from '../api/client';
import { setTrailRouteCoordinates } from '../state/trailRoutes';
import { translateTrailContentToArabic } from '../utils/translateTrailContent';

type LngLat = [number, number];
type DrawingStage = 'start' | 'middle' | 'end';

type SaveTrailBody = {
  name: string;
  nameAr?: string;
  description?: string;
  descriptionAr?: string;
  region?: string;
  regionAr?: string;
  features?: string[];
  featuresAr?: string[];
  tags?: string[];
  status?: 'draft' | 'published';
  visibility?: 'public' | 'private';
  confirm_duplicate?: boolean;
  confirm_hazard?: boolean;
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
  initialGeneratedTrail?: GeneratedTrailSuggestion;
  onSaved?: (payload: SaveTrailBody & { id?: string; status: 'draft' | 'published' }) => void;
};

const MAPBOX_ACCESS_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ?? '';

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

function getDistanceMeters(left: LngLat, right: LngLat) {
  const earthRadiusMeters = 6371000;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const [leftLng, leftLat] = left;
  const [rightLng, rightLat] = right;
  const deltaLat = toRadians(rightLat - leftLat);
  const deltaLng = toRadians(rightLng - leftLng);
  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(toRadians(leftLat)) *
      Math.cos(toRadians(rightLat)) *
      Math.sin(deltaLng / 2) *
      Math.sin(deltaLng / 2);

  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getPathDistanceMeters(points: LngLat[]) {
  return points.reduce((sum, point, index) => {
    if (index === 0) {
      return sum;
    }

    return sum + getDistanceMeters(points[index - 1], point);
  }, 0);
}

const GPS_MIN_MOVEMENT_METERS = 6;
const GPS_MAX_ACCURACY_METERS = 35;
const GPS_SPIKE_DISTANCE_METERS = 90;
const GPS_SPIKE_RETURN_METERS = 45;
const GPS_SIMPLIFY_TOLERANCE_METERS = 7;
const ROUTE_REVISIT_DISTANCE_METERS = 22;
const ROUTE_REVISIT_PATH_METERS = 180;

function isValidCoordinate(point: LngLat) {
  const [lng, lat] = point;
  return Number.isFinite(lng) && Number.isFinite(lat) && Math.abs(lng) <= 180 && Math.abs(lat) <= 90;
}

function projectToMeters(point: LngLat, origin: LngLat) {
  const metersPerDegreeLat = 111320;
  const metersPerDegreeLng = metersPerDegreeLat * Math.cos((origin[1] * Math.PI) / 180);

  return {
    x: (point[0] - origin[0]) * metersPerDegreeLng,
    y: (point[1] - origin[1]) * metersPerDegreeLat,
  };
}

function estimateWalkingDurationSeconds(distanceMeters: number) {
  const walkingMetersPerSecond = 1.2;
  return Math.max(60, Math.round(distanceMeters / walkingMetersPerSecond));
}

function getPerpendicularDistanceMeters(point: LngLat, start: LngLat, end: LngLat) {
  const projectedPoint = projectToMeters(point, start);
  const projectedEnd = projectToMeters(end, start);
  const segmentLengthSquared = projectedEnd.x * projectedEnd.x + projectedEnd.y * projectedEnd.y;

  if (segmentLengthSquared === 0) {
    return getDistanceMeters(point, start);
  }

  const t = Math.max(0, Math.min(1, (projectedPoint.x * projectedEnd.x + projectedPoint.y * projectedEnd.y) / segmentLengthSquared));
  const projection = {
    x: projectedEnd.x * t,
    y: projectedEnd.y * t,
  };
  const deltaX = projectedPoint.x - projection.x;
  const deltaY = projectedPoint.y - projection.y;

  return Math.sqrt(deltaX * deltaX + deltaY * deltaY);
}

function simplifyRouteSection(points: LngLat[], startIndex: number, endIndex: number, toleranceMeters: number, keep: boolean[]) {
  if (endIndex <= startIndex + 1) {
    return;
  }

  let farthestIndex = -1;
  let farthestDistance = 0;

  for (let index = startIndex + 1; index < endIndex; index += 1) {
    const distance = getPerpendicularDistanceMeters(points[index], points[startIndex], points[endIndex]);
    if (distance > farthestDistance) {
      farthestDistance = distance;
      farthestIndex = index;
    }
  }

  if (farthestIndex !== -1 && farthestDistance > toleranceMeters) {
    keep[farthestIndex] = true;
    simplifyRouteSection(points, startIndex, farthestIndex, toleranceMeters, keep);
    simplifyRouteSection(points, farthestIndex, endIndex, toleranceMeters, keep);
  }
}

function simplifyRouteCoordinates(points: LngLat[], toleranceMeters: number) {
  if (points.length <= 2) {
    return points;
  }

  const keep = points.map(() => false);
  keep[0] = true;
  keep[points.length - 1] = true;
  simplifyRouteSection(points, 0, points.length - 1, toleranceMeters, keep);

  return points.filter((_, index) => keep[index]);
}

function sampleRouteForShapeChecks(points: LngLat[]) {
  if (points.length <= 2) {
    return points;
  }

  const sampled: LngLat[] = [points[0]];
  let lastKept = points[0];

  for (let index = 1; index < points.length - 1; index += 1) {
    const point = points[index];
    if (getDistanceMeters(lastKept, point) >= 18) {
      sampled.push(point);
      lastKept = point;
    }
  }

  const lastPoint = points[points.length - 1];
  if (getDistanceMeters(sampled[sampled.length - 1], lastPoint) > 0) {
    sampled.push(lastPoint);
  }

  if (sampled.length <= 420) {
    return sampled;
  }

  const stride = Math.ceil(sampled.length / 420);
  return sampled.filter((_, index) => index === 0 || index === sampled.length - 1 || index % stride === 0);
}

function getCumulativeDistances(points: LngLat[]) {
  const distances = [0];

  for (let index = 1; index < points.length; index += 1) {
    distances[index] = distances[index - 1] + getDistanceMeters(points[index - 1], points[index]);
  }

  return distances;
}

function findClosestWaypointIndex(point: LngLat, waypoints: LngLat[]) {
  let closestIndex = -1;
  let closestDistance = Number.POSITIVE_INFINITY;

  waypoints.forEach((waypoint, index) => {
    const distance = getDistanceMeters(point, waypoint);
    if (distance < closestDistance) {
      closestDistance = distance;
      closestIndex = index;
    }
  });

  return closestDistance <= 70 ? closestIndex : -1;
}

function getRouteBacktrackIssue(routeCoordinates: LngLat[], waypoints: LngLat[], allowLoop: boolean) {
  const sampled = sampleRouteForShapeChecks(routeCoordinates);
  const cumulativeDistances = getCumulativeDistances(sampled);
  const minIndexGap = Math.max(6, Math.floor(sampled.length * 0.04));

  for (let index = 0; index < sampled.length; index += 1) {
    for (let nextIndex = index + minIndexGap; nextIndex < sampled.length; nextIndex += 1) {
      if (allowLoop && index <= 2 && nextIndex >= sampled.length - 3) {
        continue;
      }

      const pathDistance = cumulativeDistances[nextIndex] - cumulativeDistances[index];
      if (pathDistance < ROUTE_REVISIT_PATH_METERS) {
        continue;
      }

      if (getDistanceMeters(sampled[index], sampled[nextIndex]) <= ROUTE_REVISIT_DISTANCE_METERS) {
        const waypointIndex = findClosestWaypointIndex(sampled[index], waypoints);
        const waypointText = waypointIndex >= 0 ? ` near waypoint ${waypointIndex + 1}` : '';
        return `This route doubles back${waypointText}. Try removing that point or placing it on the trail you want to follow.`;
      }
    }
  }

  return null;
}

function hasSegmentIntersection(a: LngLat, b: LngLat, c: LngLat, d: LngLat) {
  const origin = a;
  const pointA = projectToMeters(a, origin);
  const pointB = projectToMeters(b, origin);
  const pointC = projectToMeters(c, origin);
  const pointD = projectToMeters(d, origin);
  const cross = (left: typeof pointA, middle: typeof pointA, right: typeof pointA) =>
    (middle.x - left.x) * (right.y - left.y) - (middle.y - left.y) * (right.x - left.x);
  const first = cross(pointA, pointB, pointC);
  const second = cross(pointA, pointB, pointD);
  const third = cross(pointC, pointD, pointA);
  const fourth = cross(pointC, pointD, pointB);

  return first * second < 0 && third * fourth < 0;
}

function getRouteShapeIssue(routeCoordinates: LngLat[], waypoints: LngLat[], allowLoop: boolean) {
  const waypointDistance = getPathDistanceMeters(waypoints);
  const routeDistance = getPathDistanceMeters(routeCoordinates);

  if (waypointDistance > 0 && routeDistance > Math.max(waypointDistance * 3.5, waypointDistance + 1500)) {
    return 'This route is much longer than the points you selected. One waypoint may be off the natural walking path.';
  }

  const backtrackIssue = getRouteBacktrackIssue(routeCoordinates, waypoints, allowLoop);
  if (backtrackIssue) {
    return backtrackIssue;
  }

  const sampled = sampleRouteForShapeChecks(routeCoordinates);
  for (let index = 0; index < sampled.length - 3; index += 1) {
    for (let nextIndex = index + 2; nextIndex < sampled.length - 1; nextIndex += 1) {
      if (allowLoop && index === 0 && nextIndex >= sampled.length - 3) {
        continue;
      }

      if (hasSegmentIntersection(sampled[index], sampled[index + 1], sampled[nextIndex], sampled[nextIndex + 1])) {
        return 'This route crosses over itself. Try moving or deleting the waypoint that causes the crossing.';
      }
    }
  }

  return null;
}

function cleanRecordedRouteCoordinates(points: LngLat[]) {
  const validPoints = points.filter(isValidCoordinate);
  if (validPoints.length <= 2) {
    return validPoints;
  }

  const withoutTinyMoves = validPoints.reduce<LngLat[]>((cleaned, point) => {
    const previous = cleaned[cleaned.length - 1];
    if (previous && getDistanceMeters(previous, point) < GPS_MIN_MOVEMENT_METERS) {
      return cleaned;
    }

    cleaned.push(point);
    return cleaned;
  }, []);

  const withoutSpikes = withoutTinyMoves.filter((point, index) => {
    if (index === 0 || index === withoutTinyMoves.length - 1) {
      return true;
    }

    const previous = withoutTinyMoves[index - 1];
    const next = withoutTinyMoves[index + 1];
    const previousDistance = getDistanceMeters(previous, point);
    const nextDistance = getDistanceMeters(point, next);
    const returnDistance = getDistanceMeters(previous, next);

    return !(previousDistance > GPS_SPIKE_DISTANCE_METERS && nextDistance > GPS_SPIKE_DISTANCE_METERS && returnDistance < GPS_SPIKE_RETURN_METERS);
  });

  return simplifyRouteCoordinates(withoutSpikes, GPS_SIMPLIFY_TOLERANCE_METERS);
}

function confirmDuplicateTrail(warning: DuplicateTrailWarning) {
  const strongestMatch = warning.matches[0];
  const matchName = strongestMatch?.name ?? 'an existing public trail';
  const reasons = strongestMatch?.reasons?.length ? `\n\n${strongestMatch.reasons.slice(0, 3).join('\n')}` : '';

  return new Promise<boolean>((resolve) => {
    Alert.alert(
      'Possible duplicate trail',
      `"${matchName}" looks similar to this route. Open the existing trail instead of creating another copy, unless this is intentionally different.${reasons}`,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Create anyway', style: 'destructive', onPress: () => resolve(true) },
      ],
    );
  });
}

function formatHazardWarningItem(warning: unknown) {
  if (typeof warning === 'string') {
    return warning;
  }

  if (warning && typeof warning === 'object') {
    const item = warning as Record<string, unknown>;
    return String(item.warning_en ?? item.warning ?? item.message ?? JSON.stringify(item));
  }

  return String(warning);
}

function confirmHazardWarning(warnings: unknown[]) {
  const messages = warnings.slice(0, 5).map(formatHazardWarningItem).filter(Boolean);
  const messageText = messages.length > 0
    ? `This route passes through hazardous or settlement areas.\n\n${messages.join('\n')}\n\nProceed anyway?`
    : 'This route passes through hazardous or settlement areas.\n\nProceed anyway?';

  return new Promise<boolean>((resolve) => {
    Alert.alert(
      'Route hazard warning',
      messageText,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Create anyway', style: 'destructive', onPress: () => resolve(true) },
      ],
      { cancelable: true },
    );
  });
}

function buildDirectionsUrl(waypoints: LngLat[]) {
  const coordinates = waypoints.map(([lng, lat]) => `${lng},${lat}`).join(';');
  const params = new URLSearchParams({
    access_token: MAPBOX_ACCESS_TOKEN,
    alternatives: 'true',
    geometries: 'geojson',
    overview: 'full',
    steps: 'false',
  });

  return `https://api.mapbox.com/directions/v5/mapbox/walking/${coordinates}?${params.toString()}`;
}

function getRouteBounds(coordinates: LngLat[]) {
  if (coordinates.length < 2) {
    return null;
  }

  const longitudes = coordinates.map((point) => point[0]);
  const latitudes = coordinates.map((point) => point[1]);

  return {
    northEast: [Math.max(...longitudes), Math.max(...latitudes)] as LngLat,
    southWest: [Math.min(...longitudes), Math.min(...latitudes)] as LngLat,
  };
}

export function TrailCreator({
  styleURL,
  initialCenter = [35.24, 31.78],
  initialZoom = 7.8,
  initialGeneratedTrail,
  onSaved,
}: TrailCreatorProps) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const cameraRef = useRef<Mapbox.Camera>(null);
  const locationSubscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const lastAiNameRef = useRef('');
  const lastAiDescriptionRef = useRef('');
  const lastAiRegionRef = useRef('');

  const [isDrawing, setIsDrawing] = useState(false);
  const [isRecordingTrail, setIsRecordingTrail] = useState(false);
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
      setRegion((current) => {
        const trimmedCurrent = current.trim();
        if (!fetchedRegion || (trimmedCurrent && trimmedCurrent !== lastAiRegionRef.current)) {
          return current;
        }

        lastAiRegionRef.current = fetchedRegion;
        return fetchedRegion;
      });
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
  const [featureDraft, setFeatureDraft] = useState('');
  const [trailImage, setTrailImage] = useState<string | null>(null);
  const [isPickingImage, setIsPickingImage] = useState(false);
  const [savingMode, setSavingMode] = useState<'draft' | 'published' | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [recordingStartedAt, setRecordingStartedAt] = useState<number | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [isTrailInfoCollapsed, setIsTrailInfoCollapsed] = useState(false);
  const [isParsingDescription, setIsParsingDescription] = useState(false);

  const [zoomLevel, setZoomLevel] = useState(initialZoom);
  const [pitch, setPitch] = useState(0); // 0 for 2D, 45 for 3D

  const zoomIn = () => setZoomLevel(prev => Math.min(prev + 1, 20));
  const zoomOut = () => setZoomLevel(prev => Math.max(prev - 1, 0));
  const toggle3D = () => setPitch(prev => prev === 0 ? 45 : 0);

  const applyRouteAnalysis = (analysis: TrailAnalysisResponse) => {
    setStats({
      length_meters: analysis.length_meters,
      elevation_gain_meters: analysis.elevation_gain_meters,
      estimated_duration_minutes: analysis.estimated_duration_minutes,
      difficulty: analysis.difficulty,
    });

    const suggestedName = analysis.ai_name?.trim();
    const suggestedDescription = analysis.ai_description?.trim();
    const suggestedRegion = analysis.region?.trim();
    const suggestedLabels = Array.isArray(analysis.ai_labels) ? analysis.ai_labels.filter(Boolean) : [];

    if (suggestedName) {
      setName((current) => {
        const trimmedCurrent = current.trim();
        if (trimmedCurrent && trimmedCurrent !== lastAiNameRef.current) {
          return current;
        }

        lastAiNameRef.current = suggestedName;
        return suggestedName;
      });
    }

    if (suggestedDescription) {
      setDescription((current) => {
        const trimmedCurrent = current.trim();
        if (trimmedCurrent && trimmedCurrent !== lastAiDescriptionRef.current) {
          return current;
        }

        lastAiDescriptionRef.current = suggestedDescription;
        return suggestedDescription;
      });
    }

    if (suggestedRegion) {
      setRegion((current) => {
        const trimmedCurrent = current.trim();
        if (trimmedCurrent && trimmedCurrent !== lastAiRegionRef.current) {
          return current;
        }

        lastAiRegionRef.current = suggestedRegion;
        return suggestedRegion;
      });
    }

    setFeatures(Array.from(new Set(suggestedLabels)));
  };

  const addFeature = () => {
    const nextFeature = featureDraft.trim();
    if (!nextFeature) {
      return;
    }

    setFeatures((current) => {
      const alreadyExists = current.some((feature) => feature.trim().toLowerCase() === nextFeature.toLowerCase());
      return alreadyExists ? current : [...current, nextFeature];
    });
    setFeatureDraft('');
  };

  const handleParseDescription = async () => {
    const source = description.trim();
    if (!source) {
      Alert.alert('Add a description first', 'Write a rough trail description, then parse it for suggestions.');
      return;
    }

    setIsParsingDescription(true);
    try {
      const parsed = await parseTrailDescription(source);
      if (parsed.name_suggestion) {
        setName((current) => current.trim() || parsed.name_suggestion);
      }
      if (parsed.description_suggestion) {
        setDescription(parsed.description_suggestion);
        lastAiDescriptionRef.current = parsed.description_suggestion;
      }
      if (parsed.region) {
        setRegion((current) => current.trim() || parsed.region || current);
      }
      if (parsed.labels?.length) {
        setFeatures((current) => Array.from(new Set([...current, ...parsed.labels])));
      }
      if (parsed.length_km && stats) {
        setStats({
          ...stats,
          length_meters: parsed.length_km * 1000,
          estimated_duration_minutes: parsed.duration_minutes ?? stats.estimated_duration_minutes,
        });
      }
    } catch (error) {
      Alert.alert('Unable to parse description', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setIsParsingDescription(false);
    }
  };

  const removeFeature = (featureToRemove: string) => {
    setFeatures((current) => current.filter((feature) => feature !== featureToRemove));
  };

  const routeGeojson = useMemo(() => toLineFeature(routeCoordinates), [routeCoordinates]);
  const routeKey = useMemo(
    () => routeCoordinates.map(([lng, lat]) => `${lng.toFixed(5)},${lat.toFixed(5)}`).join('|'),
    [routeCoordinates],
  );
  const startGeojson = useMemo(() => toPointFeature(startCoordinate), [startCoordinate]);
  const middleGeojson = useMemo(() => toPointsFeatureCollection(middleCoordinates), [middleCoordinates]);
  const endGeojson = useMemo(() => toPointFeature(endCoordinate), [endCoordinate]);
  const waypointCount = middleCoordinates.length + (startCoordinate ? 1 : 0) + (endCoordinate ? 1 : 0);
  const canUndo = isDrawing && waypointCount > 0;
  const canMarkEnd = isDrawing && Boolean(startCoordinate) && drawingStage === 'middle';
  const canFinish = isDrawing && Boolean(startCoordinate && endCoordinate) && !isCalculating;
  const recordedDistanceMeters = useMemo(() => getPathDistanceMeters(routeCoordinates), [routeCoordinates]);

  useEffect(() => {
    return () => {
      locationSubscriptionRef.current?.remove();
      locationSubscriptionRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!initialGeneratedTrail?.coordinates?.length) {
      return;
    }

    const coordinates = initialGeneratedTrail.coordinates;
    const firstCoordinate = coordinates[0] ?? null;
    const lastCoordinate = coordinates[coordinates.length - 1] ?? null;

    locationSubscriptionRef.current?.remove();
    locationSubscriptionRef.current = null;
    setSaveSuccess('AI route ready. Review the details, then save or publish it.');
    setSaveError(null);
    setCalcError(null);
    lastAiNameRef.current = initialGeneratedTrail.name_suggestion?.trim() || 'Suggested Trail';
    lastAiDescriptionRef.current = initialGeneratedTrail.description_suggestion?.trim() || '';
    lastAiRegionRef.current = '';
    setName(initialGeneratedTrail.name_suggestion?.trim() || 'Suggested Trail');
    setDescription(initialGeneratedTrail.description_suggestion?.trim() || '');
    setFeatures(Array.from(new Set((initialGeneratedTrail.labels ?? []).filter(Boolean))));
    setFeatureDraft('');
    setStartCoordinate(firstCoordinate);
    setMiddleCoordinates(coordinates.slice(1, -1));
    setEndCoordinate(lastCoordinate);
    setRouteCoordinates(coordinates);
    setStats({
      length_meters: initialGeneratedTrail.length_meters,
      elevation_gain_meters: initialGeneratedTrail.elevation_gain_meters,
      estimated_duration_minutes: initialGeneratedTrail.estimated_duration_minutes,
      difficulty: initialGeneratedTrail.difficulty,
    });
    setIsLoop(Boolean(firstCoordinate && lastCoordinate && firstCoordinate[0] === lastCoordinate[0] && firstCoordinate[1] === lastCoordinate[1]));
    setDrawingStage('end');
    setIsDrawing(false);
    setIsRecordingTrail(false);
    setIsFinished(true);
    setRecordingStartedAt(null);
    setIsTrailInfoCollapsed(false);

    if (firstCoordinate) {
      cameraRef.current?.setCamera({
        centerCoordinate: firstCoordinate,
        zoomLevel: 12,
        animationDuration: 650,
      });
    }
  }, [initialGeneratedTrail]);

  useEffect(() => {
    if (!isMapReady || routeCoordinates.length < 2) {
      return;
    }

    const bounds = getRouteBounds(routeCoordinates);
    if (!bounds) {
      return;
    }

    cameraRef.current?.fitBounds(bounds.northEast, bounds.southWest, 80, 800);
  }, [isMapReady, routeKey, routeCoordinates]);

  const begin = () => {
    locationSubscriptionRef.current?.remove();
    locationSubscriptionRef.current = null;
    setSaveSuccess(null);
    setSaveError(null);
    setCalcError(null);
    lastAiNameRef.current = '';
    lastAiDescriptionRef.current = '';
    lastAiRegionRef.current = '';
    setStats(null);
    setName('');
    setDescription('');
    setRegion('');
    setFeatures([]);
    setFeatureDraft('');
    setStartCoordinate(null);
    setMiddleCoordinates([]);
    setEndCoordinate(null);
    setRouteCoordinates([]);
    setIsLoop(false);
    setDrawingStage('start');
    setIsDrawing(true);
    setIsRecordingTrail(false);
    setIsFinished(false);
    setRecordingStartedAt(null);
    setIsTrailInfoCollapsed(false);
  };

  const beginRecordingTrail = async () => {
    locationSubscriptionRef.current?.remove();
    locationSubscriptionRef.current = null;
    setSaveSuccess(null);
    setSaveError(null);
    setCalcError(null);
    lastAiNameRef.current = '';
    lastAiDescriptionRef.current = '';
    lastAiRegionRef.current = '';
    setStats(null);
    setName('');
    setDescription('');
    setRegion('');
    setFeatures([]);
    setFeatureDraft('');
    setStartCoordinate(null);
    setMiddleCoordinates([]);
    setEndCoordinate(null);
    setRouteCoordinates([]);
    setIsLoop(false);
    setDrawingStage('start');
    setIsDrawing(false);
    setIsFinished(false);
    setIsRecordingTrail(false);
    setRecordingStartedAt(null);
    setIsTrailInfoCollapsed(false);

    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Location required', 'Location permission is required to record a trail as you walk.');
        return;
      }

      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation,
      });
      const initialCoordinate: LngLat = [current.coords.longitude, current.coords.latitude];

      setStartCoordinate(initialCoordinate);
      setEndCoordinate(initialCoordinate);
      setRouteCoordinates([initialCoordinate]);
      setIsRecordingTrail(true);
      setRecordingStartedAt(Date.now());
      cameraRef.current?.setCamera({
        centerCoordinate: initialCoordinate,
        zoomLevel: 15,
        animationDuration: 650,
      });

      locationSubscriptionRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          distanceInterval: 5,
          timeInterval: 2500,
        },
        (location) => {
          if (location.coords.accuracy !== null && location.coords.accuracy > GPS_MAX_ACCURACY_METERS) {
            return;
          }

          const nextCoordinate: LngLat = [location.coords.longitude, location.coords.latitude];

          setRouteCoordinates((currentPath) => {
            const previousCoordinate = currentPath[currentPath.length - 1];
            if (previousCoordinate && getDistanceMeters(previousCoordinate, nextCoordinate) < GPS_MIN_MOVEMENT_METERS) {
              return currentPath;
            }

            const nextPath = [...currentPath, nextCoordinate];
            setEndCoordinate(nextCoordinate);
            return nextPath;
          });
        },
      );
    } catch (error) {
      setIsRecordingTrail(false);
      setRecordingStartedAt(null);
      Alert.alert('Unable to start recording', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  const clear = () => {
    locationSubscriptionRef.current?.remove();
    locationSubscriptionRef.current = null;
    setName('');
    setDescription('');
    setRegion('');
    setFeatures([]);
    setFeatureDraft('');
    setStartCoordinate(null);
    setMiddleCoordinates([]);
    setEndCoordinate(null);
    setRouteCoordinates([]);
    setIsLoop(false);
    setDrawingStage('start');
    setIsDrawing(false);
    setIsRecordingTrail(false);
    setIsFinished(false);
    setStats(null);
    setCalcError(null);
    setSaveError(null);
    setSaveSuccess(null);
    setRecordingStartedAt(null);
    setIsTrailInfoCollapsed(false);
  };

  const finishRecordedTrail = async () => {
    if (routeCoordinates.length < 2) {
      Alert.alert('Keep walking', 'Record at least two GPS points before finishing the trail.');
      return;
    }

    locationSubscriptionRef.current?.remove();
    locationSubscriptionRef.current = null;
    setIsRecordingTrail(false);
    setIsCalculating(true);
    setCalcError(null);
    setSaveError(null);
    setSaveSuccess(null);

    try {
      const elapsedSeconds = recordingStartedAt ? Math.max(60, Math.round((Date.now() - recordingStartedAt) / 1000)) : Math.max(60, routeCoordinates.length * 5);
      const cleanedRouteCoordinates = cleanRecordedRouteCoordinates(routeCoordinates);

      if (cleanedRouteCoordinates.length < 2) {
        throw new Error('The recording only captured noisy GPS points. Try recording again with a clearer location signal.');
      }

      setRouteCoordinates(cleanedRouteCoordinates);
      setStartCoordinate(cleanedRouteCoordinates[0]);
      setEndCoordinate(cleanedRouteCoordinates[cleanedRouteCoordinates.length - 1]);
      const cleanedDistanceMeters = getPathDistanceMeters(cleanedRouteCoordinates);

      try {
        const analysis = await analyzeTrailRoute({ coordinates: cleanedRouteCoordinates });
        applyRouteAnalysis(analysis);
      } catch {
        setStats(toFallbackStats(cleanedDistanceMeters, elapsedSeconds));
        setFeatures([]);
      }

      setIsFinished(true);
    } catch (error) {
      setCalcError(error instanceof Error ? error.message : 'Failed to prepare recorded trail.');
    } finally {
      setIsCalculating(false);
      setRecordingStartedAt(null);
    }
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
      const routes = json.routes ?? [];
      const selectedRoute = routes.find((candidate) => {
        const coordinates = candidate.geometry?.coordinates;
        return Boolean(coordinates && coordinates.length >= 2 && !getRouteShapeIssue(coordinates, waypoints, isLoop));
      });
      const route = selectedRoute ?? routes[0];
      const geometryCoordinates = selectedRoute?.geometry?.coordinates;

      if (!route) {
        throw new Error('No route was returned for those points.');
      }

      const finalCoordinates = geometryCoordinates && geometryCoordinates.length >= 2 ? geometryCoordinates : waypoints;
      const usedTappedPathFallback = finalCoordinates === waypoints;
      const finalDistanceMeters = usedTappedPathFallback ? getPathDistanceMeters(finalCoordinates) : route.distance;
      const finalDurationSeconds = usedTappedPathFallback ? estimateWalkingDurationSeconds(finalDistanceMeters) : route.duration;

      if (usedTappedPathFallback) {
        setSaveSuccess('Mapbox walking snapped to a road detour, so this trail is using your tapped hiking path instead.');
      }

      setRouteCoordinates(finalCoordinates);
      setIsDrawing(false);
      setIsFinished(true);

      try {
        const analysis = await analyzeTrailRoute({ coordinates: finalCoordinates });
        applyRouteAnalysis(analysis);
      } catch {
        setStats(toFallbackStats(finalDistanceMeters, finalDurationSeconds));
        setFeatures([]);
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
      let confirmedDuplicate = false;
      const duplicateWarning = await checkDuplicateTrail({
        name: name.trim(),
        coordinates: routeCoordinates,
        distance: stats.length_meters,
        visibility: 'public',
      });

      if (duplicateWarning.has_similar_trails) {
        const shouldCreateAnyway = await confirmDuplicateTrail(duplicateWarning);
        if (!shouldCreateAnyway) {
          return;
        }

        confirmedDuplicate = true;
      }

      const translatedTrail = await translateTrailContentToArabic({
        name: name.trim(),
        description: description.trim() || undefined,
        region: region.trim() || undefined,
        features,
      });
      const createStatus = status === 'published' ? 'draft' : status;
      const payload: SaveTrailBody = {
        name: name.trim(),
        nameAr: translatedTrail.nameAr,
        description: description.trim() || undefined,
        descriptionAr: translatedTrail.descriptionAr,
        region: region.trim() || undefined,
        regionAr: translatedTrail.regionAr,
        features,
        featuresAr: translatedTrail.featuresAr,
        tags: features,
        status: createStatus,
        visibility: status === 'published' ? 'public' : 'private',
        confirm_duplicate: confirmedDuplicate,
        coordinates: routeCoordinates,
        stats,
      };

      let json;
      try {
        json = await createTrail(payload);
      } catch (error) {
        const errorPayload = error instanceof ApiError ? error.payload as { warnings?: unknown[] } | undefined : undefined;
        if (
          error instanceof ApiError &&
          error.status === 400 &&
          Array.isArray(errorPayload?.warnings) &&
          errorPayload.warnings.length > 0
        ) {
          const shouldProceed = await confirmHazardWarning(errorPayload.warnings);
          if (!shouldProceed) {
            return;
          }

          payload.confirm_hazard = true;
          json = await createTrail(payload);
        } else {
          throw error;
        }
      }
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
      onSaved?.({ ...payload, id: json.data.id, status });
      if (status === 'draft') {
        setSaveSuccess('Draft saved!');
      }
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
    isRecordingTrail
      ? 'Recording your walk'
      : drawingStage === 'start'
      ? 'Tap a starting point'
      : drawingStage === 'middle'
      ? 'Add middle points or switch to the end point'
      : 'Tap the ending point';

  const stageSummary = isRecordingTrail
    ? `${(recordedDistanceMeters / 1000).toFixed(2)} km | ${Math.max(0, routeCoordinates.length)} GPS points`
    : [
        startCoordinate ? 'Start set' : 'Choose a start',
        middleCoordinates.length ? `${middleCoordinates.length} middle point${middleCoordinates.length === 1 ? '' : 's'}` : 'No middle points',
        endCoordinate ? 'End set' : 'Choose an end',
        isLoop ? 'Loop on' : 'Loop off',
      ].join(' | ');
  const shouldShowTrailInfoPanel = isDrawing || isRecordingTrail || isFinished;
  const panelBottomPadding = Math.max(12, insets.bottom + 10);
  const mapControlsBottom = !shouldShowTrailInfoPanel
    ? Math.max(22, insets.bottom + 22)
    : isTrailInfoCollapsed
    ? Math.max(92, insets.bottom + 82)
    : 120;

  return (
    <View style={styles.root}>
      <Mapbox.MapView
        style={styles.map}
        styleURL={styleURL}
        compassEnabled
        scaleBarEnabled={false}
        logoEnabled={false}
        attributionEnabled={false}
        onDidFinishLoadingMap={() => setIsMapReady(true)}
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

        <Mapbox.ShapeSource key={`trail-route-source-${routeKey}`} id="trail-route-source" shape={routeGeojson}>
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

      <View style={[styles.mapControls, { bottom: mapControlsBottom }]}>
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
          {!isDrawing && !isRecordingTrail && !isFinished ? (
            <>
              <Pressable style={[styles.iconButton, styles.primaryIconButton]} onPress={begin}>
                <Ionicons name="git-compare-outline" size={18} color="#fff" />
                <Text style={styles.primaryIconText}>Draw trail</Text>
              </Pressable>
              <Pressable style={[styles.iconButton, styles.recordIconButton]} onPress={() => void beginRecordingTrail()}>
                <Ionicons name="radio-outline" size={18} color="#fff" />
                <Text style={styles.primaryIconText}>Record walk</Text>
              </Pressable>
            </>
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

          {isRecordingTrail ? (
            <>
              <Pressable style={[styles.iconButton, styles.recordIconButton]} onPress={() => void finishRecordedTrail()}>
                <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                <Text style={styles.primaryIconText}>Finish</Text>
              </Pressable>
              <Pressable style={[styles.iconButton, styles.dangerIconButton]} onPress={clear}>
                <Ionicons name="close-circle-outline" size={18} color="#BB2823" />
                <Text style={[styles.iconText, styles.dangerText]}>Cancel</Text>
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

      {shouldShowTrailInfoPanel && (
        <View style={[styles.bottomPanelWrap, { paddingBottom: panelBottomPadding }]}>
          <View style={[styles.bottomPanel, isTrailInfoCollapsed ? styles.bottomPanelCollapsed : { maxHeight: Math.max(260, windowHeight * 0.72) }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={isTrailInfoCollapsed ? 'Expand trail info panel' : 'Collapse trail info panel'}
              style={styles.panelHeaderButton}
              onPress={() => setIsTrailInfoCollapsed((current) => !current)}
            >
              <View style={styles.panelHandle} />
              <View style={styles.panelHeaderRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.panelTitle}>{isDrawing || isRecordingTrail ? stageTitle : 'Trail details'}</Text>
                  <Text style={styles.panelSubtitle}>{stageSummary}</Text>
                </View>
                {isCalculating ? <ActivityIndicator /> : null}
                <View style={styles.collapseButton}>
                  <Ionicons name={isTrailInfoCollapsed ? 'chevron-up' : 'chevron-down'} size={20} color="#2C2418" />
                </View>
              </View>
            </Pressable>

            {!isTrailInfoCollapsed ? (
              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.bottomPanelScrollContent}
              >
              {calcError ? <Text style={styles.errorText}>{calcError}</Text> : null}

              {isRecordingTrail ? (
                <View style={styles.drawingActionsRow}>
                  <Pressable
                    style={[styles.secondaryActionButton, routeCoordinates.length < 2 && styles.secondaryActionButtonDisabled]}
                    disabled={routeCoordinates.length < 2 || isCalculating}
                    onPress={() => void finishRecordedTrail()}
                  >
                    <Ionicons name="checkmark-circle-outline" size={16} color={routeCoordinates.length >= 2 ? '#2C2418' : '#B0A090'} />
                    <Text style={[styles.secondaryActionText, routeCoordinates.length < 2 && styles.iconTextDisabled]}>
                      Finish recording
                    </Text>
                  </Pressable>
                </View>
              ) : isDrawing ? (
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
                    <View style={styles.labelRow}>
                      <Text style={styles.inputLabel}>Description</Text>
                      <Pressable
                        style={[styles.parseDescriptionButton, isParsingDescription && styles.disabledButton]}
                        onPress={() => void handleParseDescription()}
                        disabled={isParsingDescription}
                      >
                        {isParsingDescription ? (
                          <ActivityIndicator size="small" color="#630E13" />
                        ) : (
                          <Ionicons name="sparkles-outline" size={14} color="#630E13" />
                        )}
                        <Text style={styles.parseDescriptionText}>Parse with AI</Text>
                      </Pressable>
                    </View>
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
                    <View style={styles.featureInputRow}>
                      <TextInput
                        value={featureDraft}
                        onChangeText={setFeatureDraft}
                        onSubmitEditing={addFeature}
                        placeholder="Add a feature, e.g. spring, ruins, viewpoint"
                        placeholderTextColor="#9E8E80"
                        returnKeyType="done"
                        style={[styles.input, styles.featureInput]}
                      />
                      <Pressable
                        accessibilityLabel="Add feature"
                        disabled={!featureDraft.trim()}
                        onPress={addFeature}
                        style={[styles.featureAddButton, !featureDraft.trim() && styles.featureAddButtonDisabled]}
                      >
                        <Ionicons name="add" size={22} color="#fff" />
                      </Pressable>
                    </View>
                    <View style={styles.featuresContainer}>
                      {features.length ? (
                        features.map((feature) => (
                          <Pressable
                            key={feature}
                            style={[styles.featureChip, styles.featureChipSelected]}
                            onPress={() => removeFeature(feature)}
                            accessibilityLabel={`Remove ${feature}`}
                          >
                            <Text style={[styles.featureChipText, styles.featureChipTextSelected]}>
                              {feature}
                            </Text>
                            <Ionicons name="close" size={14} color="#fff" />
                          </Pressable>
                        ))
                      ) : (
                        <View style={styles.emptyFeaturesBox}>
                          <Text
                            style={styles.emptyFeaturesText}
                          >
                            Add features manually, or keep the AI-generated labels after route analysis.
                          </Text>
                        </View>
                      )}
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
                  {isRecordingTrail
                    ? 'Keep this screen open while you walk. The trail line updates from GPS points, then you can finish and save it as a draft or publish it.'
                    : 'Tap once to place the start, add as many middle waypoints as you need, switch to end mode, then tap the ending point. Turn on loop to close the route back to the start.'}
                </Text>
              )}
              </ScrollView>
            ) : null}
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
  recordIconButton: {
    backgroundColor: '#630E13',
    borderColor: 'rgba(99,14,19,0.32)',
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
  bottomPanelScrollContent: {
    paddingTop: 4,
    paddingBottom: 4,
  },
  bottomPanelCollapsed: {
    paddingTop: 10,
    paddingBottom: 10,
  },
  panelHeaderButton: {
    gap: 8,
  },
  panelHandle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(44,36,24,0.18)',
  },
  panelHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  panelTitle: { fontSize: 14, fontWeight: '900', color: '#2C2418' },
  panelSubtitle: { marginTop: 3, fontSize: 11, color: '#8A7A6A', fontWeight: '700' },
  collapseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F7F3E7',
    borderWidth: 1,
    borderColor: 'rgba(44,36,24,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
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
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 },
  parseDescriptionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#F7EBE8',
  },
  disabledButton: {
    opacity: 0.65,
  },
  parseDescriptionText: { fontSize: 11, fontWeight: '800', color: '#630E13' },
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

  featureInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  featureInput: {
    flex: 1,
    minWidth: 0,
  },
  featureAddButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#0F5A38',
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureAddButtonDisabled: {
    opacity: 0.45,
  },
  featuresContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  featureChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '100%',
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
  
  emptyFeaturesBox: {
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#F7F0E8',
    borderWidth: 1,
    borderColor: '#E2D4C2',
  },
  emptyFeaturesText: {
    color: '#7E6F5F',
    fontSize: 13,
    lineHeight: 18,
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

// Updated to request device location, load nearby trails from the backend, and render full trail previews with a neon green route line.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Dimensions, Modal, FlatList, Image, Alert } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import * as Location from 'expo-location';
import type { Feature, FeatureCollection, LineString } from 'geojson';
import { AppTabParamList, RootStackParamList } from '../navigation/types';
import { getNearbyTrails, getTrailById, type Trail } from '../api/trailsApi';
import { getMapBubblePhotos, getMapBubbles, type MapBubble, type MapBubblePhoto } from '../api/mapApi';
import { getActivityMedia, getMyActivities } from '../api/activitiesApi';
import {
  formatSafetyDistance,
  getNearbySafetyAlerts,
  getRiskColor,
  safetyAlertTitle,
  safetyAlertWarning,
  type NearbySafetyAlert,
} from '../api/safetyApi';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../contexts/LanguageContext';
import { AnimatedBlock, AnimatedScreen } from '../components/AnimatedUI';
import { getOfflineMapPacks, type OfflineMapPack } from '../state/offlineMaps';
import { getTrailRouteCoordinates } from '../state/trailRoutes';
import { theme } from '../theme';
import { ltrRow, ltrText, rtlRow, rtlText } from '../utils/direction';

type MapScreenNavigationProp = StackNavigationProp<RootStackParamList>;
type MapScreenRouteProp = RouteProp<AppTabParamList, 'Map'>;
type MapboxModule = typeof import('@rnmapbox/maps');

const { width, height } = Dimensions.get('window');
const GALLERY_HORIZONTAL_PADDING = 16;
const GALLERY_GRID_GAP = 10;
const PHOTO_TILE_WIDTH = (width - GALLERY_HORIZONTAL_PADDING * 2 - GALLERY_GRID_GAP) / 2;
const MAPBOX_ACCESS_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ?? '';
const MAPBOX_STYLE_URL =
  process.env.EXPO_PUBLIC_MAPBOX_STYLE_URL ?? 'mapbox://styles/shahdmallah/cmnqgt687000h01s66inve68a';
const BUBBLE_FETCH_DEBOUNCE_MS = 1200;
const SAFETY_FETCH_DEBOUNCE_MS = 2500;
const OWN_ACTIVITY_MEDIA_CACHE_MS = 2 * 60 * 1000;
const OWN_ACTIVITY_MEDIA_LIMIT = 25;

let Mapbox: MapboxModule | null = null;
let mapboxLoadError: string | null = null;

try {
  // Load Mapbox lazily so Expo Go or stale native builds don't hard-crash the whole screen.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Mapbox = require('@rnmapbox/maps') as MapboxModule;
  Mapbox.setAccessToken(MAPBOX_ACCESS_TOKEN);
} catch (error) {
  mapboxLoadError = error instanceof Error ? error.message : 'Mapbox native code not available.';
}

const difficultyColor: Record<string, string> = {
  Easy: '#7A9A3A',
  Moderate: '#D4A843',
  Hard: '#BB2823',
  Expert: '#630E13',
};

const fallbackCenter: [number, number] = [35.24, 31.78];

function toMapboxCoordinate(trail: Trail): [number, number] {
  return [trail.coordinates[1], trail.coordinates[0]];
}

function toLineFeature(coordinates: [number, number][] | null): FeatureCollection {
  const features: Feature<LineString>[] =
    coordinates && coordinates.length >= 2
      ? [
          {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates,
            },
          },
        ]
      : [];

  return {
    type: 'FeatureCollection',
    features,
  };
}

function buildOfflineTrail(map: OfflineMapPack): Trail {
  if (map.trail) {
    return {
      ...map.trail,
      coordinates: map.coordinates ?? map.trail.coordinates,
      routeCoordinates: map.routeCoordinates?.length ? map.routeCoordinates : map.trail.routeCoordinates,
    };
  }

  return {
    id: map.trailId,
    name: map.trailName,
    nameAr: map.trailNameAr || map.trailName,
    region: map.region ?? '',
    regionAr: map.regionAr ?? map.region ?? '',
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
    coordinates: map.coordinates ?? [31.78, 35.24],
    routeCoordinates: map.routeCoordinates,
    mapX: 0,
    mapY: 0,
    tags: [],
  };
}

function photoUri(photo: MapBubblePhoto) {
  return photo.url?.trim() || photo.public_url?.trim() || photo.thumbnail_url?.trim() || '';
}

function photoUploader(photo: MapBubblePhoto) {
  return photo.uploader_name?.trim() || photo.uploaded_by?.trim() || photo.user?.full_name?.trim() || 'Trail friend';
}

function photoDate(photo: MapBubblePhoto) {
  const rawDate = photo.captured_at || photo.created_at;
  if (!rawDate) return '';

  const timestamp = new Date(rawDate);
  if (Number.isNaN(timestamp.getTime())) return '';

  return timestamp.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function bubblePreviewUri(bubble: MapBubble) {
  return bubble.preview_images.find((uri) => typeof uri === 'string' && uri.trim())?.trim() ?? '';
}

function bubbleMarkerSize(count: number) {
  if (count >= 48) return 72;
  if (count >= 18) return 62;
  if (count >= 6) return 54;
  return 48;
}

function bubbleOutlineColor(count: number) {
  if (count >= 48) return theme.colors.difficulty.expert;
  if (count >= 18) return theme.colors.difficulty.hard;
  if (count >= 6) return theme.colors.difficulty.moderate;
  return theme.colors.difficulty.easy;
}

function isInsideBounds(lat: number, lng: number, bounds: { ne_lat: number; ne_lng: number; sw_lat: number; sw_lng: number }) {
  return lat >= bounds.sw_lat && lat <= bounds.ne_lat && lng >= bounds.sw_lng && lng <= bounds.ne_lng;
}

function viewportKey(bounds: { ne_lat: number; ne_lng: number; sw_lat: number; sw_lng: number }, zoom: number) {
  const zoomBucket = Math.max(1, Math.floor(zoom));
  return [
    bounds.ne_lat.toFixed(2),
    bounds.ne_lng.toFixed(2),
    bounds.sw_lat.toFixed(2),
    bounds.sw_lng.toFixed(2),
    zoomBucket,
  ].join(':');
}

function activityMediaToBubble(photo: Awaited<ReturnType<typeof getActivityMedia>>[number]): MapBubble | null {
  const lat = Number(photo.latitude);
  const lng = Number(photo.longitude);
  const uri = photo.url?.trim();

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !uri) {
    return null;
  }

  return {
    id: `activity-media-${photo.id}`,
    lat,
    lng,
    count: 1,
    media_ids: [photo.id],
    media_refs: [{ id: photo.id, source: 'activity_media' }],
    preview_images: [uri],
    photos: [{
      id: photo.id,
      url: uri,
      thumbnail_url: uri,
      caption: photo.caption,
      created_at: photo.created_at,
      captured_at: photo.captured_at,
      source: 'activity_media',
      nature_sighting: photo.nature_sighting,
    }],
  };
}

function bubbleRefKeys(bubble: MapBubble) {
  const refs = bubble.media_refs?.length ? bubble.media_refs : bubble.media_ids.map((id) => ({ id, source: undefined }));
  return refs.map((ref) => `${ref.source ?? 'unknown'}:${ref.id}`);
}

function mergeBubbles(primary: MapBubble[], secondary: MapBubble[]) {
  const seenMediaIds = new Set(primary.flatMap(bubbleRefKeys));
  const merged = [...primary];

  secondary.forEach((bubble) => {
    const keys = bubbleRefKeys(bubble);

    if (keys.some((id) => seenMediaIds.has(id))) {
      return;
    }

    keys.forEach((id) => seenMediaIds.add(id));
    merged.push(bubble);
  });

  return merged;
}

export function MapScreen() {
  const navigation = useNavigation<MapScreenNavigationProp>();
  const route = useRoute<MapScreenRouteProp>();
  const mapRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const bubbleFetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const safetyFetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastBubbleViewportKeyRef = useRef<string | null>(null);
  const ownActivityMediaCacheRef = useRef<{ expiresAt: number; bubbles: MapBubble[] } | null>(null);
  const ownActivityMediaPromiseRef = useRef<Promise<MapBubble[]> | null>(null);
  const [selectedTrail, setSelectedTrail] = useState<Trail | null>(null);
  const [nearbyTrails, setNearbyTrails] = useState<Trail[]>([]);
  const [mapBubbles, setMapBubbles] = useState<MapBubble[]>([]);
  const [bubblePhotos, setBubblePhotos] = useState<MapBubblePhoto[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<MapBubblePhoto | null>(null);
  const [isBubbleGalleryVisible, setIsBubbleGalleryVisible] = useState(false);
  const [isBubbleLoading, setIsBubbleLoading] = useState(false);
  const [bubbleError, setBubbleError] = useState<string | null>(null);
  const [safetyAlerts, setSafetyAlerts] = useState<NearbySafetyAlert[]>([]);
  const [selectedSafetyAlert, setSelectedSafetyAlert] = useState<NearbySafetyAlert | null>(null);
  const [safetyError, setSafetyError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(7.6);
  const [isThreeD, setIsThreeD] = useState(true);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const insets = useSafeAreaInsets();
  const { t, language } = useLanguage();
  const isArabic = language === 'ar';
  const isSingleTrailMode = route.params?.mode === 'singleTrail';

  const canRenderMapbox = Boolean(Mapbox && !mapboxLoadError);
  const trailCountLabel = useMemo(
    () => (isSingleTrailMode ? 'Offline map' : `${nearbyTrails.length} trails`),
    [isSingleTrailMode, nearbyTrails.length],
  );
  const selectedTrailRoute = useMemo(() => {
    if (!selectedTrail) {
      return null;
    }

    return selectedTrail.routeCoordinates ?? getTrailRouteCoordinates(selectedTrail.id);
  }, [selectedTrail]);
  const selectedTrailLine = useMemo(() => toLineFeature(selectedTrailRoute), [selectedTrailRoute]);

  const loadOwnActivityMediaBubbles = useCallback(async () => {
    const cached = ownActivityMediaCacheRef.current;
    if (cached && cached.expiresAt > Date.now()) {
      return cached.bubbles;
    }

    if (ownActivityMediaPromiseRef.current) {
      return ownActivityMediaPromiseRef.current;
    }

    ownActivityMediaPromiseRef.current = (async () => {
      try {
        const activities = await getMyActivities({ limit: OWN_ACTIVITY_MEDIA_LIMIT, status: 'completed' });
        const bubbles: MapBubble[] = [];

        for (const activity of activities) {
          const photos = await getActivityMedia(activity.id).catch(() => []);
          photos.forEach((photo) => {
            const bubble = activityMediaToBubble(photo);
            if (bubble) {
              bubbles.push(bubble);
            }
          });
        }

        ownActivityMediaCacheRef.current = {
          expiresAt: Date.now() + OWN_ACTIVITY_MEDIA_CACHE_MS,
          bubbles,
        };

        return bubbles;
      } finally {
        ownActivityMediaPromiseRef.current = null;
      }
    })();

    return ownActivityMediaPromiseRef.current;
  }, []);

  const fetchBubblesForViewport = useCallback(async () => {
    if (!mapRef.current?.getVisibleBounds || !mapRef.current?.getZoom) {
      return;
    }

    try {
      const [bounds, zoom] = await Promise.all([
        mapRef.current.getVisibleBounds(),
        mapRef.current.getZoom(),
      ]);
      const points = Array.isArray(bounds) ? bounds.flat() : [];

      if (points.length < 4) {
        return;
      }

      const lngs = [Number(points[0]), Number(points[2])];
      const lats = [Number(points[1]), Number(points[3])];
      const ne_lat = Math.max(...lats);
      const sw_lat = Math.min(...lats);
      const ne_lng = Math.max(...lngs);
      const sw_lng = Math.min(...lngs);

      if (![ne_lat, sw_lat, ne_lng, sw_lng].every(Number.isFinite)) {
        return;
      }

      setBubbleError(null);
      const viewport = {
        ne_lat,
        ne_lng,
        sw_lat,
        sw_lng,
      };
      const normalizedZoom = Number.isFinite(Number(zoom)) ? Number(zoom) : zoomLevel;
      const nextViewportKey = viewportKey(viewport, normalizedZoom);

      if (lastBubbleViewportKeyRef.current === nextViewportKey) {
        return;
      }

      lastBubbleViewportKeyRef.current = nextViewportKey;
      const [bubbles, myActivityBubbles] = await Promise.all([
        getMapBubbles({
          ...viewport,
          zoom: normalizedZoom,
        }),
        loadOwnActivityMediaBubbles().catch(() => []),
      ]);
      setMapBubbles(mergeBubbles(
        bubbles,
        myActivityBubbles.filter((bubble) => isInsideBounds(bubble.lat, bubble.lng, viewport)),
      ));
    } catch (error) {
      setMapBubbles([]);
      lastBubbleViewportKeyRef.current = null;
      setBubbleError(error instanceof Error ? error.message : 'Unable to load photo bubbles.');
    }
  }, [loadOwnActivityMediaBubbles, zoomLevel]);

  const fetchSafetyAlertsNear = useCallback(async (lat: number, lng: number) => {
    try {
      const alerts = await getNearbySafetyAlerts({ lat, lng, radius: 5000 });
      setSafetyAlerts(alerts);
      setSelectedSafetyAlert((current) => {
        if (!current) return alerts[0] ?? null;
        return alerts.find((alert) => alert.id === current.id && alert.kind === current.kind) ?? alerts[0] ?? null;
      });
      setSafetyError(null);
    } catch (error) {
      setSafetyAlerts([]);
      setSelectedSafetyAlert(null);
      setSafetyError(error instanceof Error ? error.message : 'Unable to load safety alerts.');
    }
  }, []);

  const fetchSafetyAlertsForViewport = useCallback(async () => {
    if (!mapRef.current?.getVisibleBounds) {
      if (userLocation) {
        await fetchSafetyAlertsNear(userLocation[0], userLocation[1]);
      }
      return;
    }

    try {
      const bounds = await mapRef.current.getVisibleBounds();
      const points = Array.isArray(bounds) ? bounds.flat() : [];

      if (points.length < 4) {
        return;
      }

      const lngs = [Number(points[0]), Number(points[2])];
      const lats = [Number(points[1]), Number(points[3])];
      const centerLat = (Math.max(...lats) + Math.min(...lats)) / 2;
      const centerLng = (Math.max(...lngs) + Math.min(...lngs)) / 2;

      if (![centerLat, centerLng].every(Number.isFinite)) {
        return;
      }

      await fetchSafetyAlertsNear(centerLat, centerLng);
    } catch {
      if (userLocation) {
        await fetchSafetyAlertsNear(userLocation[0], userLocation[1]);
      }
    }
  }, [fetchSafetyAlertsNear, userLocation]);

  const scheduleBubbleFetch = useCallback(() => {
    if (isSingleTrailMode) {
      return;
    }

    if (!canRenderMapbox) {
      return;
    }

    if (bubbleFetchTimerRef.current) {
      clearTimeout(bubbleFetchTimerRef.current);
    }

    bubbleFetchTimerRef.current = setTimeout(() => {
      void fetchBubblesForViewport();
    }, BUBBLE_FETCH_DEBOUNCE_MS);
  }, [canRenderMapbox, fetchBubblesForViewport, isSingleTrailMode]);

  const scheduleSafetyFetch = useCallback(() => {
    if (isOfflineMode) {
      return;
    }

    if (!canRenderMapbox && !userLocation) {
      return;
    }

    if (safetyFetchTimerRef.current) {
      clearTimeout(safetyFetchTimerRef.current);
    }

    safetyFetchTimerRef.current = setTimeout(() => {
      void fetchSafetyAlertsForViewport();
    }, SAFETY_FETCH_DEBOUNCE_MS);
  }, [canRenderMapbox, fetchSafetyAlertsForViewport, isOfflineMode, userLocation]);

  const openBubbleGallery = useCallback(async (bubble: MapBubble) => {
    if (bubble.media_ids.length === 0 && !bubble.photos?.length) {
      return;
    }

    setIsBubbleLoading(true);
    setBubbleError(null);
    setIsBubbleGalleryVisible(true);
    setBubblePhotos(bubble.photos?.filter((photo) => photoUri(photo)) ?? []);
    setSelectedPhoto(null);

    try {
      const photos = await getMapBubblePhotos(bubble.media_refs?.length ? bubble.media_refs : bubble.media_ids);
      const visiblePhotos = photos.filter((photo) => photoUri(photo));
      setBubblePhotos(visiblePhotos.length ? visiblePhotos : bubble.photos?.filter((photo) => photoUri(photo)) ?? []);
    } catch (error) {
      if (!bubble.photos?.length) {
        setBubbleError(error instanceof Error ? error.message : 'Unable to load photos for this area.');
      }
    } finally {
      setIsBubbleLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadNearby = async () => {
      setIsLoading(true);
      setFetchError(null);
      setLocationMessage(null);

      try {
        if (isSingleTrailMode && route.params?.selectedTrailId) {
          const offlinePack = (await getOfflineMapPacks()).find((pack) => pack.trailId === route.params?.selectedTrailId);

          if (offlinePack) {
            const trail = buildOfflineTrail(offlinePack);
            const offlineSafetyAlerts = offlinePack.safetyAlerts ?? [];
            if (!cancelled) {
              setUserLocation(null);
              setNearbyTrails([trail]);
              setSelectedTrail(trail);
              setSafetyAlerts(offlineSafetyAlerts);
              setSelectedSafetyAlert(offlineSafetyAlerts[0] ?? null);
              setSafetyError(null);
              setIsOfflineMode(true);
            }
            return;
          }

          const trail = await getTrailById(route.params.selectedTrailId);
          if (!cancelled) {
            setUserLocation(null);
            setNearbyTrails([trail]);
            setSelectedTrail(trail);
            setSafetyAlerts([]);
            setSelectedSafetyAlert(null);
            setSafetyError(null);
            setIsOfflineMode(false);
          }
          return;
        }

        const permission = await Location.requestForegroundPermissionsAsync();

        if (permission.status !== 'granted') {
          throw new Error('Location permission is required to load nearby trails.');
        }

        const position = await Location.getCurrentPositionAsync({});
        const coords: [number, number] = [position.coords.latitude, position.coords.longitude];
        const trails = await getNearbyTrails({
          lat: coords[0],
          lng: coords[1],
          radius: 20000,
        });

        if (!cancelled) {
          setUserLocation(coords);
          setNearbyTrails(trails);
          setSelectedTrail(trails[0] ?? null);
          void fetchSafetyAlertsNear(coords[0], coords[1]);
        }
      } catch (error) {
        if (!cancelled) {
          setNearbyTrails([]);
          setSelectedTrail(null);
          setFetchError(error instanceof Error ? error.message : 'Unable to load nearby trails.');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadNearby();

    return () => {
      cancelled = true;
    };
  }, [fetchSafetyAlertsNear, isSingleTrailMode, route.params?.selectedTrailId]);

  useEffect(() => {
    if (!canRenderMapbox) {
      return;
    }

    const nextCenter = selectedTrail
      ? toMapboxCoordinate(selectedTrail)
      : userLocation
        ? [userLocation[1], userLocation[0]]
        : fallbackCenter;

    cameraRef.current?.setCamera({
      centerCoordinate: nextCenter,
      zoomLevel: selectedTrail ? 8.8 : 7.6,
      pitch: isThreeD ? 48 : 0,
      animationDuration: 900,
    });

    setZoomLevel(selectedTrail ? 8.8 : 7.6);

    if (selectedTrailRoute && selectedTrailRoute.length >= 2) {
      const longitudes = selectedTrailRoute.map((point) => point[0]);
      const latitudes = selectedTrailRoute.map((point) => point[1]);

      cameraRef.current?.fitBounds(
        [Math.max(...longitudes), Math.max(...latitudes)],
        [Math.min(...longitudes), Math.min(...latitudes)],
        80,
        900,
      );
    }
  }, [canRenderMapbox, isThreeD, selectedTrail, selectedTrailRoute, userLocation]);

  useEffect(() => {
    if (!canRenderMapbox) {
      return;
    }

    cameraRef.current?.setCamera({
      zoomLevel,
      pitch: isThreeD ? 48 : 0,
      animationDuration: 250,
    });
  }, [canRenderMapbox, isThreeD, zoomLevel]);

  useEffect(() => {
    if (!canRenderMapbox) {
      return;
    }

    scheduleBubbleFetch();
    scheduleSafetyFetch();

    return () => {
      if (bubbleFetchTimerRef.current) {
        clearTimeout(bubbleFetchTimerRef.current);
      }
      if (safetyFetchTimerRef.current) {
        clearTimeout(safetyFetchTimerRef.current);
      }
    };
  }, [canRenderMapbox, scheduleBubbleFetch, scheduleSafetyFetch, userLocation]);

  useEffect(() => {
    const selectedTrailId = route.params?.selectedTrailId;

    if (!selectedTrailId) {
      return;
    }

    const existingTrail = nearbyTrails.find((trail) => trail.id === selectedTrailId);

    if (existingTrail) {
      setSelectedTrail(existingTrail);
      setIsOfflineMode(false);
      return;
    }

    let cancelled = false;

    const loadRequestedTrail = async () => {
      try {
        const trail = await getTrailById(selectedTrailId);

        if (!cancelled) {
          setSelectedTrail(trail);
          setNearbyTrails((current) => (current.some((item) => item.id === trail.id) ? current : [trail, ...current]));
          setIsOfflineMode(false);
        }
      } catch {
        const offlinePack = (await getOfflineMapPacks()).find((pack) => pack.trailId === selectedTrailId);

        if (!cancelled && offlinePack) {
          const trail = buildOfflineTrail(offlinePack);
          const offlineSafetyAlerts = offlinePack.safetyAlerts ?? [];
          if (safetyFetchTimerRef.current) {
            clearTimeout(safetyFetchTimerRef.current);
            safetyFetchTimerRef.current = null;
          }
          setSelectedTrail(trail);
          setNearbyTrails((current) => (current.some((item) => item.id === trail.id) ? current : [trail, ...current]));
          setSafetyAlerts(offlineSafetyAlerts);
          setSelectedSafetyAlert(offlineSafetyAlerts[0] ?? null);
          setSafetyError(null);
          setFetchError(null);
          setIsOfflineMode(true);
        }
      }
    };

    void loadRequestedTrail();

    return () => {
      cancelled = true;
    };
  }, [nearbyTrails, route.params?.selectedTrailId]);

  const handleTrailPress = (trail: Trail) => {
    setSelectedTrail(trail);
  };

  const handleTrailDetail = () => {
    if (selectedTrail) {
      navigation.navigate('TrailDetail', { trailId: selectedTrail.id });
    }
  };

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    navigation.navigate('AppTabs', { screen: 'Explore' });
  };

  const handleZoomIn = () => {
    setZoomLevel((current) => Math.min(current + 0.7, 18));
  };

  const handleZoomOut = () => {
    setZoomLevel((current) => Math.max(current - 0.7, 3));
  };

  const handleCenterMap = () => {
    if (!canRenderMapbox || !cameraRef.current) {
      return;
    }

    if (selectedTrailRoute && selectedTrailRoute.length >= 2) {
      const longitudes = selectedTrailRoute.map((point) => point[0]);
      const latitudes = selectedTrailRoute.map((point) => point[1]);

      cameraRef.current.fitBounds(
        [Math.max(...longitudes), Math.max(...latitudes)],
        [Math.min(...longitudes), Math.min(...latitudes)],
        80,
        700,
      );
      setZoomLevel(selectedTrail ? 8.8 : zoomLevel);
      setTimeout(scheduleBubbleFetch, 800);
      return;
    }

    const centerCoordinate: [number, number] = selectedTrail
      ? toMapboxCoordinate(selectedTrail)
      : userLocation
        ? [userLocation[1], userLocation[0]]
        : fallbackCenter;
    const nextZoomLevel = selectedTrail ? 10.8 : userLocation ? 13 : 7.6;

    cameraRef.current.setCamera({
      centerCoordinate,
      zoomLevel: nextZoomLevel,
      pitch: isThreeD ? 48 : 0,
      animationDuration: 700,
    });
    setZoomLevel(nextZoomLevel);
    setTimeout(scheduleBubbleFetch, 800);
  };

  return (
    <AnimatedScreen style={styles.container}>
      {canRenderMapbox && Mapbox ? (
        <Mapbox.MapView
          ref={mapRef}
          style={styles.map}
          styleURL={MAPBOX_STYLE_URL || Mapbox.StyleURL.Outdoors}
          compassEnabled={false}
          scaleBarEnabled={false}
          logoEnabled={false}
          attributionEnabled={false}
          rotateEnabled
          pitchEnabled
          onMapIdle={() => {
            scheduleBubbleFetch();
            scheduleSafetyFetch();
          }}
        >
          <Mapbox.Camera
            ref={cameraRef}
            defaultSettings={{
              centerCoordinate: fallbackCenter,
              zoomLevel: 7.2,
              pitch: 20,
            }}
          />
          <Mapbox.LocationPuck visible={Boolean(userLocation)} puckBearingEnabled puckBearing="heading" />

          {selectedTrailRoute && selectedTrailRoute.length >= 2 ? (
            <Mapbox.ShapeSource id="selected-trail-route-source" shape={selectedTrailLine}>
              <Mapbox.LineLayer
                id="selected-trail-route-line"
                style={{
                  lineColor: '#39FF14',
                  lineWidth: 5,
                  lineOpacity: 0.9,
                  lineJoin: 'round',
                  lineCap: 'round',
                }}
              />
            </Mapbox.ShapeSource>
          ) : null}

          {!isSingleTrailMode && mapBubbles.filter((bubble) => Number.isFinite(bubble.lat) && Number.isFinite(bubble.lng)).map((bubble, index) => {
            const size = bubbleMarkerSize(bubble.count);
            const outlineColor = bubbleOutlineColor(bubble.count);
            const previewUri = bubblePreviewUri(bubble);
            const bubbleId = bubble.id ?? `bubble-${index}`;

            return (
              <Mapbox.MarkerView
                key={bubbleId}
                coordinate={[bubble.lng, bubble.lat]}
                anchor={{ x: 0.5, y: 0.5 }}
                allowOverlap
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${bubble.count} photos`}
                  onPress={() => void openBubbleGallery(bubble)}
                  style={[
                    styles.photoBubbleMarker,
                    {
                      width: size,
                      height: size,
                      borderRadius: size / 2,
                      borderColor: outlineColor,
                    },
                  ]}
                >
                  {previewUri ? (
                    <Image
                      source={{ uri: previewUri }}
                      style={[
                        styles.photoBubbleImage,
                        {
                          width: size - 8,
                          height: size - 8,
                          borderRadius: (size - 8) / 2,
                        },
                      ]}
                    />
                  ) : (
                    <View
                      style={[
                        styles.photoBubbleFallback,
                        {
                          width: size - 8,
                          height: size - 8,
                          borderRadius: (size - 8) / 2,
                        },
                      ]}
                    />
                  )}
                  {bubble.count > 1 ? (
                    <View style={[styles.photoBubbleCountBadge, { backgroundColor: outlineColor }]}>
                      <Text style={styles.photoBubbleCountText}>{bubble.count}</Text>
                    </View>
                  ) : null}
                </Pressable>
              </Mapbox.MarkerView>
            );
          })}

          {safetyAlerts
            .filter((alert) => Number.isFinite(alert.latitude) && Number.isFinite(alert.longitude))
            .map((alert) => {
              const tone = getRiskColor(alert.kind === 'location' ? alert.risk_level : alert.severity);
              const iconName = alert.kind === 'location' ? 'business-outline' : 'warning-outline';

              return (
                <Mapbox.MarkerView
                  key={`safety-${alert.kind}-${alert.id}`}
                  coordinate={[alert.longitude, alert.latitude]}
                  anchor={{ x: 0.5, y: 0.5 }}
                  allowOverlap
                >
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={safetyAlertTitle(alert)}
                    onPress={() => setSelectedSafetyAlert(alert)}
                    style={[styles.safetyMarker, { borderColor: tone }]}
                  >
                    <Ionicons name={iconName} size={17} color={tone} />
                  </Pressable>
                </Mapbox.MarkerView>
              );
            })}

          {nearbyTrails.map((trail) => {
            const active = selectedTrail?.id === trail.id;

            return (
              <Mapbox.PointAnnotation
                key={trail.id}
                id={trail.id}
                coordinate={toMapboxCoordinate(trail)}
                onSelected={() => handleTrailPress(trail)}
              >
                <View
                  style={[
                    styles.markerOuter,
                    active && styles.markerOuterActive,
                    { borderColor: difficultyColor[trail.difficulty] || '#7A9A3A' },
                  ]}
                >
                  <View
                    style={[
                      styles.markerInner,
                      { backgroundColor: difficultyColor[trail.difficulty] || '#7A9A3A' },
                    ]}
                  />
                </View>
              </Mapbox.PointAnnotation>
            );
          })}
        </Mapbox.MapView>
      ) : (
        <View style={styles.fallbackMap}>
          <View style={styles.fallbackGlow} />
          <View style={styles.fallbackCard}>
            <Ionicons name="warning-outline" size={30} color="#D4A843" />
            <Text style={styles.fallbackTitle}>Mapbox native build required</Text>
            <Text style={styles.fallbackText}>
              {isOfflineMode
                ? 'Base map may require internet. Trail and safety data are still available offline.'
                : 'This screen is loading the JS code, but the installed app binary does not include the native Mapbox module yet.'}
            </Text>
            <Text style={styles.fallbackCode}>
              {mapboxLoadError ?? 'Mapbox native code not available.'}
            </Text>
          </View>
        </View>
      )}

      <AnimatedBlock delay={60} style={[styles.topOverlay, { paddingTop: Math.max(insets.top + 8, 20) }]}>
        <View style={[styles.headerControls, isArabic ? rtlRow : ltrRow]}>
          <Pressable style={styles.floatingControlButton} onPress={handleBack}>
            <Ionicons name={isArabic ? 'arrow-forward' : 'arrow-back'} size={22} color="#2C2418" />
          </Pressable>

          <View style={[styles.headerStatusPill, isArabic ? rtlRow : ltrRow]}>
            <Ionicons name="map-outline" size={14} color="#EAE2CC" />
            <Text style={styles.heroBadgeText}>{trailCountLabel}</Text>
          </View>

          <Pressable
            style={[styles.floatingControlButton, isThreeD && styles.floatingControlButtonActive]}
            onPress={() => setIsThreeD((current) => !current)}
          >
            <Text style={[styles.floatingControlLabel, isThreeD && styles.floatingControlLabelActive]}>3D</Text>
          </Pressable>
        </View>

        {!MAPBOX_ACCESS_TOKEN ? (
          <View style={styles.tokenWarning}>
            <Ionicons name="alert-circle-outline" size={16} color="#D4A843" />
            <Text style={[styles.tokenWarningText, isArabic ? rtlText : ltrText]}>
              {isOfflineMode
                ? 'Base map may require internet. Trail and safety data are still available offline.'
                : 'Add `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` to load your Mapbox tiles.'}
            </Text>
          </View>
        ) : null}

        {isOfflineMode ? (
          <View style={styles.infoBanner}>
            <Text style={[styles.infoBannerText, isArabic ? rtlText : ltrText]}>
              {isArabic ? 'وضع عدم الاتصال نشط. يتم عرض بيانات المسار والسلامة المحفوظة.' : 'Offline Mode Active. Showing last saved trail and safety data.'}
            </Text>
          </View>
        ) : null}

        {locationMessage ? (
          <View style={styles.infoBanner}>
            <Text style={[styles.infoBannerText, isArabic ? rtlText : ltrText]}>{locationMessage}</Text>
          </View>
        ) : null}

        {bubbleError ? (
          <View style={styles.infoBanner}>
            <Text style={[styles.infoBannerText, isArabic ? rtlText : ltrText]}>{bubbleError}</Text>
          </View>
        ) : null}

        {selectedSafetyAlert ? (
          <Pressable
            style={styles.safetyBanner}
            onPress={() => navigation.navigate('ReportIssue', {
              latitude: selectedSafetyAlert.latitude,
              longitude: selectedSafetyAlert.longitude,
              locationName: safetyAlertTitle(selectedSafetyAlert),
            })}
          >
            <View style={[styles.safetyBannerIcon, { backgroundColor: getRiskColor(selectedSafetyAlert.kind === 'location' ? selectedSafetyAlert.risk_level : selectedSafetyAlert.severity) }]}>
              <Ionicons name="warning-outline" size={17} color="#fff" />
            </View>
            <View style={styles.safetyBannerCopy}>
              <Text style={styles.safetyBannerTitle}>
                {selectedSafetyAlert.kind === 'location' && selectedSafetyAlert.location_type.includes('checkpoint') ? 'Checkpoint Status: Open' : 'Safety alert'}
              </Text>
              <Text style={[styles.safetyBannerText, isArabic ? rtlText : ltrText]} numberOfLines={2}>
                {safetyAlertWarning(selectedSafetyAlert)}
              </Text>
              <Text style={[styles.safetyBannerMeta, isArabic ? rtlText : ltrText]}>
                {isOfflineMode
                  ? 'Confidence: High · Based on saved offline safety data'
                  : selectedSafetyAlert.kind === 'incident'
                  ? 'Confidence: Low · No recent community agreement yet'
                  : 'Confidence: Medium · Review recent community reports'}
              </Text>
            </View>
            <Text style={styles.safetyBannerDistance}>{formatSafetyDistance(selectedSafetyAlert.distance_meters)}</Text>
          </Pressable>
        ) : safetyError ? (
          <View style={styles.infoBanner}>
            <Text style={[styles.infoBannerText, isArabic ? rtlText : ltrText]}>{safetyError}</Text>
          </View>
        ) : null}
      </AnimatedBlock>

      <AnimatedBlock
        delay={100}
        style={[styles.zoomControls, { top: Math.max(insets.top + 96, 118) }]}
      >
        <Pressable style={styles.zoomButton} onPress={handleZoomIn}>
          <Ionicons name="add" size={22} color="#2C2418" />
        </Pressable>
        <View style={styles.zoomDivider} />
        <Pressable style={styles.zoomButton} onPress={handleZoomOut}>
          <Ionicons name="remove" size={22} color="#2C2418" />
        </Pressable>
      </AnimatedBlock>

      <AnimatedBlock delay={140} style={[styles.bottomOverlay, { paddingBottom: Math.max(insets.bottom + 14, 24) }]}>
        {isSingleTrailMode ? (
          selectedTrail ? (
            <View style={styles.singleTrailPanel}>
              <View style={[styles.singleTrailHeader, isArabic ? rtlRow : ltrRow]}>
                <View style={styles.singleTrailTitleBlock}>
                  <Text style={[styles.singleTrailEyebrow, isArabic ? rtlText : ltrText]}>Offline Safety Map</Text>
                  <Text style={[styles.singleTrailName, isArabic ? rtlText : ltrText]}>{isArabic ? selectedTrail.nameAr || selectedTrail.name : selectedTrail.name}</Text>
                  {selectedTrail.region ? (
                    <Text style={[styles.singleTrailRegion, isArabic ? rtlText : ltrText]}>{isArabic ? selectedTrail.regionAr || selectedTrail.region : selectedTrail.region}</Text>
                  ) : null}
                </View>
                <View style={styles.singleTrailBadge}>
                  <Ionicons name="cloud-done-outline" size={15} color="#1E7A46" />
                  <Text style={styles.singleTrailBadgeText}>Offline</Text>
                </View>
              </View>

              <View style={styles.singleTrailStats}>
                <View style={styles.statPill}>
                  <Ionicons name="resize-outline" size={14} color="#D4A843" />
                  <Text style={styles.statPillText}>{selectedTrail.distance.toFixed(1)} km</Text>
                </View>
                <View style={styles.statPill}>
                  <Ionicons name="time-outline" size={14} color="#7DB3CC" />
                  <Text style={styles.statPillText}>{selectedTrail.duration || 'Saved route'}</Text>
                </View>
                <View style={styles.statPill}>
                  <Ionicons name="shield-checkmark-outline" size={14} color="#1E7A46" />
                  <Text style={styles.statPillText}>{isOfflineMode ? 'Safety saved' : 'Trail loaded'}</Text>
                </View>
              </View>

              <View style={[styles.cardActions, isArabic ? rtlRow : ltrRow]}>
                <Pressable style={styles.secondaryButton} onPress={handleCenterMap}>
                  <Ionicons name="locate-outline" size={16} color="#2C2418" />
                  <Text style={styles.secondaryButtonText}>Center</Text>
                </Pressable>
                <Pressable style={styles.detailButton} onPress={handleTrailDetail}>
                  <Ionicons name="information-circle-outline" size={16} color="#fff" />
                  <Text style={styles.detailButtonText}>{t('viewDetails')}</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={styles.stateCard}>
              <Text style={styles.stateTitle}>Loading offline map...</Text>
            </View>
          )
        ) : isLoading ? (
          <View style={styles.stateCard}>
            <Text style={styles.stateTitle}>Finding trails near you...</Text>
          </View>
        ) : fetchError ? (
          <View style={styles.stateCard}>
            <Text style={styles.stateTitle}>{fetchError}</Text>
            <Text style={styles.stateText}>Reopen this tab after granting location permission.</Text>
          </View>
        ) : nearbyTrails.length === 0 ? (
          <View style={styles.stateCard}>
            <Text style={styles.stateTitle}>No nearby trails found.</Text>
            <Text style={styles.stateText}>Try moving to a different area and loading the map again.</Text>
          </View>
        ) : (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.trailStrip}
            >
              {nearbyTrails.map((trail) => {
                const active = selectedTrail?.id === trail.id;
                return (
                  <Pressable
                    key={trail.id}
                    style={[styles.trailChip, active && styles.trailChipActive]}
                    onPress={() => handleTrailPress(trail)}
                  >
                    <View
                      style={[
                        styles.trailChipDot,
                        { backgroundColor: difficultyColor[trail.difficulty] || '#7A9A3A' },
                      ]}
                    />
                    <View>
                      <Text style={[styles.trailChipName, isArabic ? rtlText : ltrText, active && styles.trailChipNameActive]}>
                        {isArabic ? trail.nameAr : trail.name}
                      </Text>
                      <Text style={[styles.trailChipMeta, active && styles.trailChipMetaActive]}>
                        {trail.distance.toFixed(1)} km
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>

            {selectedTrail ? (
              <View style={styles.trailCard}>
                <View style={[styles.trailCardHeader, isArabic ? rtlRow : ltrRow]}>
                  <View>
                    <Text style={[styles.trailName, isArabic ? rtlText : ltrText]}>{isArabic ? selectedTrail.nameAr : selectedTrail.name}</Text>
                    <Text style={[styles.trailRegion, isArabic ? rtlText : ltrText]}>{isArabic ? selectedTrail.regionAr : selectedTrail.region}</Text>
                  </View>
                  <View
                    style={[
                      styles.difficultyPill,
                      { backgroundColor: `${difficultyColor[selectedTrail.difficulty] || '#7A9A3A'}22` },
                    ]}
                  >
                    <Text
                      style={[
                        styles.difficultyPillText,
                        { color: difficultyColor[selectedTrail.difficulty] || '#7A9A3A' },
                      ]}
                    >
                      {selectedTrail.difficulty}
                    </Text>
                  </View>
                </View>

                <View style={styles.statsRow}>
                  <View style={styles.statPill}>
                    <Ionicons name="resize-outline" size={14} color="#D4A843" />
                    <Text style={styles.statPillText}>{selectedTrail.distance.toFixed(1)} km</Text>
                  </View>
                  <View style={styles.statPill}>
                    <Ionicons name="time-outline" size={14} color="#7DB3CC" />
                    <Text style={styles.statPillText}>{selectedTrail.duration}</Text>
                  </View>
                  <View style={styles.statPill}>
                    <Ionicons name="trending-up-outline" size={14} color="#BB2823" />
                    <Text style={styles.statPillText}>{selectedTrail.elevationGain} m</Text>
                  </View>
                </View>

                <Text numberOfLines={2} style={[styles.trailDescription, isArabic ? rtlText : ltrText]}>
                  {isArabic ? selectedTrail.descriptionAr : selectedTrail.description}
                </Text>

                <View style={[styles.cardActions, isArabic ? rtlRow : ltrRow]}>
                  <Pressable style={styles.secondaryButton} onPress={handleCenterMap}>
                    <Ionicons name="locate-outline" size={16} color="#2C2418" />
                    <Text style={styles.secondaryButtonText}>Center</Text>
                  </Pressable>
                  <Pressable
                    style={styles.secondaryButton}
                    onPress={() => navigation.navigate('ReportIssue', {
                      latitude: userLocation?.[0] ?? selectedTrail.coordinates[0],
                      longitude: userLocation?.[1] ?? selectedTrail.coordinates[1],
                      locationName: selectedTrail.name,
                    })}
                  >
                    <Ionicons name="warning-outline" size={16} color="#2C2418" />
                    <Text style={styles.secondaryButtonText}>Report</Text>
                  </Pressable>
                  <Pressable style={styles.detailButton} onPress={handleTrailDetail}>
                    <Ionicons name="information-circle-outline" size={16} color="#fff" />
                    <Text style={styles.detailButtonText}>{t('viewDetails')}</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}
          </>
        )}
      </AnimatedBlock>

      <Modal
        visible={isBubbleGalleryVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setIsBubbleGalleryVisible(false);
          setSelectedPhoto(null);
        }}
      >
        <View style={styles.galleryBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => {
              setIsBubbleGalleryVisible(false);
              setSelectedPhoto(null);
            }}
          />
          <View style={[styles.gallerySheet, { paddingBottom: Math.max(insets.bottom + 16, 24) }]}>
            <View style={[styles.galleryHeader, isArabic ? rtlRow : ltrRow]}>
              <View>
                <Text style={[styles.galleryTitle, isArabic ? rtlText : ltrText]}>
                  {selectedPhoto ? (isArabic ? 'صورة المسار' : 'Trail photo') : (isArabic ? 'صور هذه المنطقة' : 'Photos in this area')}
                </Text>
                <Text style={[styles.gallerySubtitle, isArabic ? rtlText : ltrText]}>
                  {isBubbleLoading ? (isArabic ? 'جار التحميل...' : 'Loading...') : `${bubblePhotos.length} photos`}
                </Text>
              </View>
              <Pressable
                style={styles.galleryCloseButton}
                onPress={() => {
                  setIsBubbleGalleryVisible(false);
                  setSelectedPhoto(null);
                }}
              >
                <Ionicons name="close" size={20} color="#2C2418" />
              </Pressable>
            </View>

            {selectedPhoto ? (
              <ScrollView
                style={styles.galleryList}
                contentContainerStyle={styles.photoViewer}
                showsVerticalScrollIndicator={false}
              >
                <Pressable style={styles.photoBackButton} onPress={() => setSelectedPhoto(null)}>
                  <Ionicons name={isArabic ? 'chevron-forward' : 'chevron-back'} size={18} color="#2C2418" />
                  <Text style={styles.photoBackText}>{isArabic ? 'الصور' : 'Gallery'}</Text>
                </Pressable>
                <Image source={{ uri: photoUri(selectedPhoto) }} style={styles.fullPhoto} resizeMode="cover" />
                <View style={styles.photoMetaCard}>
                  <Text style={[styles.photoCaption, isArabic ? rtlText : ltrText]}>
                    {selectedPhoto.caption?.trim() || (isArabic ? 'بدون وصف' : 'No caption')}
                  </Text>
                  <Text style={[styles.photoMetaText, isArabic ? rtlText : ltrText]}>
                    {photoUploader(selectedPhoto)}{photoDate(selectedPhoto) ? ` · ${photoDate(selectedPhoto)}` : ''}
                  </Text>
                  <View style={[styles.photoActionRow, isArabic ? rtlRow : ltrRow]}>
                    {[
                      { icon: 'heart-outline' as const, label: selectedPhoto.likes_count ? String(selectedPhoto.likes_count) : (isArabic ? 'إعجاب' : 'Like') },
                      { icon: 'chatbubble-outline' as const, label: selectedPhoto.comments_count ? String(selectedPhoto.comments_count) : (isArabic ? 'تعليق' : 'Comment') },
                      { icon: 'bookmark-outline' as const, label: isArabic ? 'حفظ' : 'Save' },
                    ].map((action) => (
                      <Pressable
                        key={action.icon}
                        style={[styles.photoActionButton, isArabic ? rtlRow : ltrRow]}
                        onPress={() => Alert.alert(isArabic ? 'قريباً' : 'Coming soon', isArabic ? 'سيتم ربط هذا الخيار بالواجهة الخلفية لاحقاً.' : 'This action needs a matching media endpoint.')}
                      >
                        <Ionicons name={action.icon} size={16} color="#630E13" />
                        <Text style={styles.photoActionText}>{action.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </ScrollView>
            ) : isBubbleLoading ? (
              <View style={styles.galleryState}>
                <Text style={styles.stateTitle}>{isArabic ? 'جار تحميل الصور...' : 'Loading photos...'}</Text>
              </View>
            ) : bubblePhotos.length === 0 ? (
              <View style={styles.galleryState}>
                <Text style={styles.stateTitle}>{isArabic ? 'لا توجد صور هنا.' : 'No photos found here.'}</Text>
                <Text style={styles.stateText}>{isArabic ? 'جرّب تحريك الخريطة أو تكبيرها.' : 'Try panning or zooming the map.'}</Text>
              </View>
            ) : (
              <FlatList
                data={bubblePhotos}
                keyExtractor={(photo) => photo.id}
                numColumns={2}
                style={styles.galleryList}
                columnWrapperStyle={styles.galleryGridRow}
                contentContainerStyle={styles.galleryGrid}
                showsVerticalScrollIndicator
                nestedScrollEnabled
                renderItem={({ item }) => (
                  <Pressable style={styles.photoTile} onPress={() => setSelectedPhoto(item)}>
                    <Image source={{ uri: photoUri(item) }} style={styles.photoTileImage} resizeMode="cover" />
                    <View style={styles.photoTileOverlay}>
                      <Text style={styles.photoTileUploader} numberOfLines={1}>{photoUploader(item)}</Text>
                    </View>
                  </Pressable>
                )}
              />
            )}
          </View>
        </View>
      </Modal>
    </AnimatedScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#120408',
  },
  map: {
    width,
    height,
  },
  fallbackMap: {
    width,
    height,
    backgroundColor: '#120408',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  fallbackGlow: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(99,14,19,0.35)',
  },
  fallbackCard: {
    width: '100%',
    borderRadius: 28,
    padding: 20,
    backgroundColor: 'rgba(18,4,8,0.88)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  fallbackTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    marginTop: 10,
  },
  fallbackText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
  },
  fallbackCode: {
    color: '#F4E6B0',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    gap: 10,
  },
  headerControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  floatingControlButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(234,226,204,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    elevation: 8,
  },
  floatingControlButtonActive: {
    backgroundColor: '#630E13',
  },
  floatingControlLabel: {
    color: '#2C2418',
    fontSize: 15,
    fontWeight: '800',
  },
  floatingControlLabelActive: {
    color: '#FFFFFF',
  },
  headerStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(18,4,8,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  heroBadgeText: {
    color: '#EAE2CC',
    fontSize: 12,
    fontWeight: '700',
  },
  tokenWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(18,4,8,0.82)',
    borderWidth: 1,
    borderColor: 'rgba(212,168,67,0.24)',
  },
  tokenWarningText: {
    flex: 1,
    color: '#F4E6B0',
    fontSize: 12,
    lineHeight: 18,
  },
  infoBanner: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: 'rgba(234,226,204,0.9)',
  },
  infoBannerText: {
    color: '#2C2418',
    fontSize: 12,
    fontWeight: '700',
  },
  markerOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 3,
    backgroundColor: 'rgba(18,4,8,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerOuterActive: {
    transform: [{ scale: 1.15 }],
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 4,
  },
  markerInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  safetyMarker: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 3,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowOffset: { width: 0, height: 5 },
    shadowRadius: 10,
    elevation: 7,
  },
  safetyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 18,
    backgroundColor: 'rgba(234,226,204,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(99,14,19,0.16)',
  },
  safetyBannerIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  safetyBannerCopy: {
    flex: 1,
  },
  safetyBannerTitle: {
    color: '#2C2418',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  safetyBannerText: {
    marginTop: 2,
    color: '#4A4131',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  safetyBannerMeta: {
    marginTop: 4,
    color: '#1E7A46',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '900',
  },
  safetyBannerDistance: {
    color: '#630E13',
    fontSize: 12,
    fontWeight: '900',
  },
  photoBubbleMarker: {
    backgroundColor: '#FFFEF9',
    borderWidth: 3,
    borderColor: '#FFFEF9',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.24,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 7,
  },
  photoBubbleImage: {
    backgroundColor: '#EAE2CC',
  },
  photoBubbleFallback: {
    backgroundColor: '#7A9A3A',
  },
  photoBubbleCountBadge: {
    position: 'absolute',
    right: -3,
    bottom: -3,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    backgroundColor: '#630E13',
    borderWidth: 2,
    borderColor: '#FFFEF9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoBubbleCountText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  zoomControls: {
    position: 'absolute',
    right: 16,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: 'rgba(234,226,204,0.95)',
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    elevation: 8,
  },
  zoomButton: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomDivider: {
    height: 1,
    backgroundColor: 'rgba(44,36,24,0.12)',
  },
  bottomOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    gap: 12,
  },
  stateCard: {
    borderRadius: 24,
    padding: 18,
    backgroundColor: 'rgba(234,226,204,0.96)',
  },
  stateTitle: {
    color: '#2C2418',
    fontSize: 18,
    fontWeight: '800',
  },
  stateText: {
    color: '#6B5D4E',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
  },
  trailStrip: {
    paddingRight: 16,
    gap: 10,
  },
  trailChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(18,4,8,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  trailChipActive: {
    backgroundColor: '#EAE2CC',
  },
  trailChipDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  trailChipName: {
    color: 'white',
    fontSize: 13,
    fontWeight: '700',
    maxWidth: 140,
  },
  trailChipNameActive: {
    color: '#2C2418',
  },
  trailChipMeta: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    marginTop: 2,
  },
  trailChipMetaActive: {
    color: '#6B5D4E',
  },
  trailCard: {
    padding: 16,
    borderRadius: 24,
    backgroundColor: 'rgba(234,226,204,0.97)',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
    elevation: 8,
  },
  singleTrailPanel: {
    padding: 16,
    borderRadius: 24,
    backgroundColor: 'rgba(234,226,204,0.97)',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
    elevation: 8,
  },
  singleTrailHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  singleTrailTitleBlock: {
    flex: 1,
  },
  singleTrailEyebrow: {
    color: '#1E7A46',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  singleTrailName: {
    marginTop: 4,
    color: '#2C2418',
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '900',
  },
  singleTrailRegion: {
    marginTop: 4,
    color: '#6B5D4E',
    fontSize: 13,
    fontWeight: '700',
  },
  singleTrailBadge: {
    minHeight: 34,
    borderRadius: 17,
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
  },
  singleTrailBadgeText: {
    color: '#1E7A46',
    fontSize: 12,
    fontWeight: '900',
  },
  singleTrailStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  trailCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  trailName: {
    color: '#2C2418',
    fontSize: 20,
    fontWeight: '800',
    maxWidth: width - 150,
  },
  trailRegion: {
    color: '#6B5D4E',
    fontSize: 13,
    marginTop: 4,
  },
  difficultyPill: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
  },
  difficultyPillText: {
    fontSize: 12,
    fontWeight: '800',
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.72)',
  },
  statPillText: {
    color: '#2C2418',
    fontSize: 12,
    fontWeight: '700',
  },
  trailDescription: {
    marginTop: 12,
    color: '#4A4131',
    fontSize: 13,
    lineHeight: 20,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 16,
    paddingVertical: 13,
    backgroundColor: 'rgba(44,36,24,0.08)',
  },
  secondaryButtonText: {
    color: '#2C2418',
    fontWeight: '700',
  },
  detailButton: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 16,
    paddingVertical: 13,
    backgroundColor: '#630E13',
  },
  detailButtonText: {
    color: '#fff',
    fontWeight: '800',
  },
  galleryBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(18,4,8,0.5)',
  },
  gallerySheet: {
    height: height * 0.82,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: GALLERY_HORIZONTAL_PADDING,
    paddingTop: 16,
    backgroundColor: '#EAE2CC',
    overflow: 'hidden',
  },
  galleryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  galleryTitle: {
    color: '#2C2418',
    fontSize: 20,
    fontWeight: '900',
  },
  gallerySubtitle: {
    marginTop: 3,
    color: '#6B5D4E',
    fontSize: 12,
    fontWeight: '700',
  },
  galleryCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.72)',
  },
  galleryList: {
    flex: 1,
  },
  galleryGrid: {
    paddingBottom: 24,
    gap: GALLERY_GRID_GAP,
  },
  galleryGridRow: {
    gap: GALLERY_GRID_GAP,
  },
  photoTile: {
    width: PHOTO_TILE_WIDTH,
    aspectRatio: 0.72,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#3D3428',
  },
  photoTileImage: {
    width: '100%',
    height: '100%',
  },
  photoTileOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: 'rgba(18,4,8,0.58)',
  },
  photoTileUploader: {
    color: '#FFFEF9',
    fontSize: 12,
    fontWeight: '800',
  },
  galleryState: {
    flex: 1,
    minHeight: 220,
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  photoViewer: {
    paddingBottom: 24,
    gap: 12,
  },
  photoBackButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.72)',
  },
  photoBackText: {
    color: '#2C2418',
    fontSize: 12,
    fontWeight: '900',
  },
  fullPhoto: {
    width: '100%',
    height: height * 0.42,
    borderRadius: 22,
    backgroundColor: '#3D3428',
  },
  photoMetaCard: {
    borderRadius: 22,
    padding: 14,
    backgroundColor: 'rgba(255,255,255,0.78)',
  },
  photoCaption: {
    color: '#2C2418',
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '800',
  },
  photoMetaText: {
    marginTop: 6,
    color: '#6B5D4E',
    fontSize: 12,
    fontWeight: '700',
  },
  photoActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  photoActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: 'rgba(99,14,19,0.08)',
  },
  photoActionText: {
    color: '#630E13',
    fontSize: 12,
    fontWeight: '900',
  },
});

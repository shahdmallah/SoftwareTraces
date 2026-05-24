import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, View, Text, StyleSheet, Pressable, ScrollView, Image, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import * as ImagePicker from 'expo-image-picker';
import type { Feature, FeatureCollection, LineString } from 'geojson';
import { RootStackParamList } from '../navigation/types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTrailTracking } from '../contexts/TrailTrackingContext';
import { sendSosAlert } from '../api/sosApi';
import {
  formatSafetyDistance,
  getNearbySafetyAlerts,
  getRiskColor,
  safetyAlertTitle,
  safetyAlertWarning,
  type NearbySafetyAlert,
} from '../api/safetyApi';

const MAPBOX_STYLE_URL =
  process.env.EXPO_PUBLIC_MAPBOX_STYLE_URL ?? 'mapbox://styles/shahdmallah/cmnqgt687000h01s66inve68a';
const MAPBOX_ACCESS_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ?? '';

type RecordingNavigationProp = StackNavigationProp<RootStackParamList>;
type RecordingRouteProp = RouteProp<RootStackParamList, 'Recording'>;
type MapboxModule = typeof import('@rnmapbox/maps');

const fallbackCenter: [number, number] = [35.24, 31.78];
const SAFETY_ALERT_RADIUS_METERS = 5000;
const SAFETY_ALERT_REFRESH_MS = 60000;
const SAFETY_ALERT_REFRESH_DISTANCE_METERS = 250;

let Mapbox: MapboxModule | null = null;
let mapboxLoadError: string | null = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Mapbox = require('@rnmapbox/maps') as MapboxModule;
  Mapbox.setAccessToken(MAPBOX_ACCESS_TOKEN);
} catch (error) {
  mapboxLoadError = error instanceof Error ? error.message : 'Mapbox native code not available.';
}

function toLineFeature(coordinates: [number, number][]): FeatureCollection {
  const features: Feature<LineString>[] =
    coordinates.length >= 2
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

function formatElapsed(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':');
}

function getDistanceMeters(from: [number, number], to: [number, number]) {
  const earthRadius = 6371000;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const latDelta = toRadians(to[1] - from[1]);
  const lngDelta = toRadians(to[0] - from[0]);
  const lat1 = toRadians(from[1]);
  const lat2 = toRadians(to[1]);

  const a =
    Math.sin(latDelta / 2) * Math.sin(latDelta / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(lngDelta / 2) * Math.sin(lngDelta / 2);

  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getBearingDegrees(from: [number, number], to: [number, number]) {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const toDegrees = (value: number) => (value * 180) / Math.PI;
  const [fromLng, fromLat] = from;
  const [toLng, toLat] = to;
  const fromLatRad = toRadians(fromLat);
  const toLatRad = toRadians(toLat);
  const deltaLng = toRadians(toLng - fromLng);
  const y = Math.sin(deltaLng) * Math.cos(toLatRad);
  const x =
    Math.cos(fromLatRad) * Math.sin(toLatRad) -
    Math.sin(fromLatRad) * Math.cos(toLatRad) * Math.cos(deltaLng);
  const initialBearing = toDegrees(Math.atan2(y, x));
  return (initialBearing + 360) % 360;
}

function toCompassDirection(degrees: number) {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return directions[Math.round(degrees / 45) % 8];
}

function buildNavigationHint(
  currentLocation: [number, number] | null,
  routeCoordinates: [number, number][],
  nearestDistance: number | null,
) {
  if (!currentLocation || routeCoordinates.length < 2) {
    return null;
  }

  let nearestIndex = 0;
  let nearestPointDistance = Number.POSITIVE_INFINITY;

  routeCoordinates.forEach((point, index) => {
    const distance = getDistanceMeters(currentLocation, point);
    if (distance < nearestPointDistance) {
      nearestPointDistance = distance;
      nearestIndex = index;
    }
  });

  const targetIndex = Math.min(nearestIndex + 4, routeCoordinates.length - 1);
  const targetPoint = routeCoordinates[targetIndex];
  const distanceToTarget = Math.round(getDistanceMeters(currentLocation, targetPoint));
  const heading = toCompassDirection(getBearingDegrees(currentLocation, targetPoint));
  const offRoute = nearestDistance != null && nearestDistance > 120;

  if (offRoute) {
    return `Navigation: Head ${heading} for about ${Math.max(distanceToTarget, 20)} m to rejoin the trail line.`;
  }

  return `Navigation: Continue ${heading} for about ${Math.max(distanceToTarget, 20)} m along the next trail segment.`;
}

function getSafetyAlertSeverity(alert: NearbySafetyAlert) {
  return alert.kind === 'location' ? alert.risk_level : alert.severity;
}

function getSafetyAlertIcon(alert: NearbySafetyAlert): keyof typeof Ionicons.glyphMap {
  return alert.kind === 'location' ? 'business-outline' : 'warning-outline';
}

export function RecordingScreen() {
  const navigation = useNavigation<RecordingNavigationProp>();
  const route = useRoute<RecordingRouteProp>();
  const insets = useSafeAreaInsets();
  const { trailId, activityId } = route.params;
  const cameraRef = useRef<any>(null);
  const hasStartedSessionRef = useRef(false);
  const closingActionRef = useRef<'finish' | 'cancel' | null>(null);
  const safetyFetchInFlightRef = useRef(false);
  const safetyRequestIdRef = useRef(0);
  const lastSafetyFetchRef = useRef<{ coordinate: [number, number]; timestamp: number } | null>(null);
  const {
    activeSession,
    finishedSession,
    startTrailSession,
    resumeTrailSession,
    pauseOrResumeTracking,
    addSessionPhoto,
    finishTrailSession,
    cancelTrailSession,
  } = useTrailTracking();
  const [isCapturingPhoto, setIsCapturingPhoto] = useState(false);
  const [isSendingSos, setIsSendingSos] = useState(false);
  const [isPanelExpanded, setIsPanelExpanded] = useState(false);
  const [isPhotosExpanded, setIsPhotosExpanded] = useState(false);
  const [safetyAlerts, setSafetyAlerts] = useState<NearbySafetyAlert[]>([]);
  const [selectedSafetyAlert, setSelectedSafetyAlert] = useState<NearbySafetyAlert | null>(null);
  const [safetyError, setSafetyError] = useState<string | null>(null);
  const [isSafetyLoading, setIsSafetyLoading] = useState(false);

  const [zoomLevel, setZoomLevel] = useState(12.2);
  const [pitch, setPitch] = useState(0); // 0 for 2D, 45 for 3D

  const zoomIn = () => setZoomLevel(prev => Math.min(prev + 1, 20));
  const zoomOut = () => setZoomLevel(prev => Math.max(prev - 1, 0));
  const toggle3D = () => setPitch(prev => prev === 0 ? 45 : 0);

  const canRenderMapbox = Boolean(Mapbox && !mapboxLoadError);
  const session = activeSession?.trailId === trailId ? activeSession : null;
  const trail = session?.trail ?? null;
  const isTrailLoading = session?.isTrailLoading ?? true;
  const trailError = session?.trailError ?? null;
  const locationMessage = session?.locationMessage ?? null;
  const stepMessage = session?.stepMessage ?? null;
  const currentLocation = session?.currentLocation ?? null;
  const recordedPath = session?.recordedPath ?? [];
  const sessionPhotos = session?.sessionPhotos ?? [];
  const isTracking = session?.isTracking ?? true;
  const isStepCountingAvailable = session?.isStepCountingAvailable ?? null;
  const stepCount = session?.stepCount ?? 0;
  const elapsedMs = session?.elapsedMs ?? 0;
  const plannedRoute = useMemo(() => trail?.routeCoordinates ?? [], [trail?.routeCoordinates]);
  const plannedRouteFeature = useMemo(() => toLineFeature(plannedRoute), [plannedRoute]);
  const recordedRouteFeature = useMemo(() => toLineFeature(recordedPath), [recordedPath]);
  const nearestDistance = session?.nearestDistance ?? null;
  const navigationInstruction = session?.navigationInstruction ?? null;
  const navigationProgressPercent = session?.navigationProgressPercent ?? null;
  const navigationOffTrack = session?.navigationOffTrack ?? null;
  const navigationDeviationMeters = session?.navigationDeviationMeters ?? null;
  const routeCoordinates = trail?.routeCoordinates?.length ? trail.routeCoordinates : [];
  const navigationHint = useMemo(
    () => buildNavigationHint(currentLocation, routeCoordinates, nearestDistance),
    [currentLocation, nearestDistance, routeCoordinates],
  );
  const primarySafetyAlert = selectedSafetyAlert ?? safetyAlerts[0] ?? null;
  const seriousSafetyAlertCount = useMemo(
    () =>
      safetyAlerts.filter((alert) => {
        const severity = getSafetyAlertSeverity(alert);
        return severity === 'critical' || severity === 'high';
      }).length,
    [safetyAlerts],
  );

  const fetchSafetyAlerts = React.useCallback(async (coordinate: [number, number], force = false) => {
    const now = Date.now();
    const lastFetch = lastSafetyFetchRef.current;

    if (!force && lastFetch) {
      const movedMeters = getDistanceMeters(lastFetch.coordinate, coordinate);
      const fetchedRecently = now - lastFetch.timestamp < SAFETY_ALERT_REFRESH_MS;

      if (fetchedRecently && movedMeters < SAFETY_ALERT_REFRESH_DISTANCE_METERS) {
        return;
      }
    }

    if (safetyFetchInFlightRef.current) {
      return;
    }

    const requestId = safetyRequestIdRef.current + 1;
    safetyRequestIdRef.current = requestId;
    safetyFetchInFlightRef.current = true;
    setIsSafetyLoading(true);

    try {
      const alerts = await getNearbySafetyAlerts({
        lat: coordinate[1],
        lng: coordinate[0],
        radius: SAFETY_ALERT_RADIUS_METERS,
      });

      if (safetyRequestIdRef.current !== requestId) {
        return;
      }

      lastSafetyFetchRef.current = { coordinate, timestamp: now };
      setSafetyAlerts(alerts);
      setSelectedSafetyAlert((current) => {
        if (!current) return alerts[0] ?? null;
        return alerts.find((alert) => alert.kind === current.kind && alert.id === current.id) ?? alerts[0] ?? null;
      });
      setSafetyError(null);
    } catch (error) {
      if (safetyRequestIdRef.current !== requestId) {
        return;
      }

      setSafetyAlerts([]);
      setSelectedSafetyAlert(null);
      setSafetyError(error instanceof Error ? error.message : 'Unable to load nearby safety alerts.');
    } finally {
      if (safetyRequestIdRef.current === requestId) {
        safetyFetchInFlightRef.current = false;
        setIsSafetyLoading(false);
      }
    }
  }, []);

  const refreshSafetyAlerts = React.useCallback(() => {
    if (currentLocation) {
      void fetchSafetyAlerts(currentLocation, true);
    }
  }, [currentLocation, fetchSafetyAlerts]);

  useEffect(() => {
    hasStartedSessionRef.current = false;
    safetyRequestIdRef.current += 1;
    safetyFetchInFlightRef.current = false;
    lastSafetyFetchRef.current = null;
    setSafetyAlerts([]);
    setSelectedSafetyAlert(null);
    setSafetyError(null);
    setIsSafetyLoading(false);
  }, [trailId]);

  useEffect(() => {
    if (!session && !hasStartedSessionRef.current && !closingActionRef.current) {
      hasStartedSessionRef.current = true;
      if (activityId) {
        void resumeTrailSession(trailId, activityId);
      } else {
        void startTrailSession(trailId);
      }
    }
  }, [activityId, resumeTrailSession, session, startTrailSession, trailId]);

  useEffect(() => {
    if (!currentLocation) {
      return;
    }

    void fetchSafetyAlerts(currentLocation);
  }, [currentLocation, fetchSafetyAlerts]);

  useEffect(() => {
    if (closingActionRef.current === 'finish' && finishedSession?.trailId === trailId) {
      closingActionRef.current = null;
      navigation.replace('TrailReview');
      return;
    }

    if (closingActionRef.current === 'cancel' && !session) {
      closingActionRef.current = null;
      navigation.reset({
        index: 1,
        routes: [
          { name: 'AppTabs', params: { screen: 'Explore' } },
          { name: 'TrailDetail', params: { trailId } },
        ],
      });
    }
  }, [finishedSession?.trailId, navigation, session, trailId]);

  useEffect(() => {
    if (!canRenderMapbox) {
      return;
    }

    const coordinatesForBounds = [...plannedRoute, ...recordedPath, ...(currentLocation ? [currentLocation] : [])];

    if (coordinatesForBounds.length >= 2) {
      const longitudes = coordinatesForBounds.map((point) => point[0]);
      const latitudes = coordinatesForBounds.map((point) => point[1]);

      cameraRef.current?.fitBounds(
        [Math.max(...longitudes), Math.max(...latitudes)],
        [Math.min(...longitudes), Math.min(...latitudes)],
        80,
        800,
      );
      return;
    }

    const center = currentLocation ?? (trail ? ([trail.coordinates[1], trail.coordinates[0]] as [number, number]) : fallbackCenter);
    cameraRef.current?.setCamera({
      centerCoordinate: center,
      zoomLevel: currentLocation ? 14.8 : 12.2,
      animationDuration: 800,
    });
  }, [canRenderMapbox, currentLocation, plannedRoute, recordedPath, trail]);

  const handleCapturePhoto = async () => {
    if (!currentLocation) {
      Alert.alert('Location needed', 'Wait for your current location before tagging a photo.');
      return;
    }

    setIsCapturingPhoto(true);

    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();

      if (!permission.granted) {
        throw new Error('Camera permission is required to tag a trail photo.');
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 0.7,
        mediaTypes: ['images'],
      });

      if (result.canceled || !result.assets[0]?.uri) {
        return;
      }

      addSessionPhoto({
        id: `${Date.now()}`,
        uri: result.assets[0].uri,
        coordinate: currentLocation,
        capturedAt: Date.now(),
      });
    } catch (error) {
      Alert.alert('Unable to capture photo', error instanceof Error ? error.message : 'Unable to capture a photo right now.');
    } finally {
      setIsCapturingPhoto(false);
    }
  };

  const guideMessage = useMemo(() => {
    if (!trail) {
      return {
        title: 'Nour is getting your route ready',
        body: 'Once the trail loads, your guide will start sharing directions, warnings, and interesting facts.',
      };
    }

    if (nearestDistance != null && nearestDistance > 120) {
      return {
        title: 'Nour: you are drifting off the route',
        body: `You are about ${Math.round(nearestDistance)} m from the planned path. Head back toward the white route line to stay on track.`,
      };
    }

    const route = trail.routeCoordinates?.length ? trail.routeCoordinates : null;
    const progress = route?.length && recordedPath.length ? Math.min(0.96, recordedPath.length / route.length) : 0;
    const remainingKm = trail.distance ? Math.max(0, (1 - progress) * trail.distance).toFixed(1) : null;
    const feature = trail.features[0] ?? trail.tags[0] ?? 'the trail landscape';
    const checkpoint = trail.checkpointNote?.trim();

    return {
      title: 'Nour: guide update',
      body: checkpoint
        ? `${checkpoint} Keep following the route. You still have about ${remainingKm ?? trail.distance.toFixed(1)} km left.`
        : `Stay with the route line and enjoy ${feature}. You still have about ${remainingKm ?? trail.distance.toFixed(1)} km to the finish.`,
    };
  }, [nearestDistance, recordedPath.length, trail]);

  const handleFinish = () => {
    const completed = finishTrailSession();
    if (completed?.trailId === trailId) {
      closingActionRef.current = 'finish';
    }
  };

  const handleCancel = () => {
    Alert.alert('Cancel this hike?', 'The live session will be closed and the current trail recording will be cleared.', [
      { text: 'Keep recording', style: 'cancel' },
      {
        text: 'Cancel hike',
        style: 'destructive',
        onPress: () => {
          closingActionRef.current = 'cancel';
          hasStartedSessionRef.current = true;
          cancelTrailSession();
        },
      },
    ]);
  };

  const handleSos = () => {
    if (!currentLocation) {
      Alert.alert('Location needed', 'Wait for GPS before sending an SOS alert.');
      return;
    }

    Alert.alert('Send SOS?', 'Your current location and activity will be sent to the safety endpoint.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Send SOS',
        style: 'destructive',
        onPress: async () => {
          setIsSendingSos(true);
          try {
            const alert = await sendSosAlert({
              latitude: currentLocation[1],
              longitude: currentLocation[0],
              activityId: session?.backendActivityId,
              message: trail ? `Emergency on ${trail.name}` : 'Emergency during live recording',
            });
            Alert.alert('SOS sent', `Alert ${alert.id} is ${alert.status}.`);
          } catch (error) {
            Alert.alert('Unable to send SOS', error instanceof Error ? error.message : 'Please try again or contact emergency services directly.');
          } finally {
            setIsSendingSos(false);
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.recordingContainer}>
      {canRenderMapbox && Mapbox ? (
        <>
        <Mapbox.MapView
          style={styles.map}
          styleURL={MAPBOX_STYLE_URL || Mapbox.StyleURL.Outdoors}
          compassEnabled={false}
          scaleBarEnabled={false}
          logoEnabled={false}
          attributionEnabled={false}
        >
          <Mapbox.Camera
            ref={cameraRef}
            centerCoordinate={trail ? [trail.coordinates[1], trail.coordinates[0]] : fallbackCenter}
            zoomLevel={zoomLevel}
            pitch={pitch}
          />

          {plannedRoute.length >= 2 ? (
            <Mapbox.ShapeSource id="planned-route-source" shape={plannedRouteFeature}>
              <Mapbox.LineLayer
                id="planned-route-line"
                style={{
                  lineColor: 'rgba(255,255,255,0.85)',
                  lineWidth: 5,
                  lineOpacity: 0.95,
                  lineJoin: 'round',
                  lineCap: 'round',
                }}
              />
            </Mapbox.ShapeSource>
          ) : null}

          {recordedPath.length >= 2 ? (
            <Mapbox.ShapeSource id="recorded-route-source" shape={recordedRouteFeature}>
              <Mapbox.LineLayer
                id="recorded-route-line"
                style={{
                  lineColor: '#39FF14',
                  lineWidth: 6,
                  lineOpacity: 0.95,
                  lineJoin: 'round',
                  lineCap: 'round',
                }}
              />
            </Mapbox.ShapeSource>
          ) : null}

          {currentLocation ? (
            <Mapbox.PointAnnotation id="current-location" coordinate={currentLocation}>
              <View style={styles.currentLocationOuter}>
                <View style={styles.currentLocationInner} />
              </View>
            </Mapbox.PointAnnotation>
          ) : null}

          {safetyAlerts
            .filter((alert) => Number.isFinite(alert.latitude) && Number.isFinite(alert.longitude))
            .map((alert) => {
              const tone = getRiskColor(getSafetyAlertSeverity(alert));
              const isSelected = primarySafetyAlert?.kind === alert.kind && primarySafetyAlert.id === alert.id;

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
                    onPress={() => {
                      setSelectedSafetyAlert(alert);
                      setIsPanelExpanded(true);
                    }}
                    style={[
                      styles.safetyMarker,
                      isSelected && styles.safetyMarkerSelected,
                      { borderColor: tone },
                    ]}
                  >
                    <Ionicons name={getSafetyAlertIcon(alert)} size={17} color={tone} />
                  </Pressable>
                </Mapbox.MarkerView>
              );
            })}

          {sessionPhotos.map((photo) => {
            const size = 48;

            return (
              <Mapbox.MarkerView
                key={photo.id}
                coordinate={photo.coordinate}
                anchor={{ x: 0.5, y: 0.5 }}
                allowOverlap
              >
                <View
                  style={[
                    styles.photoBubbleMarker,
                    {
                      width: size,
                      height: size,
                      borderRadius: size / 2,
                    },
                  ]}
                >
                  <Image
                    source={{ uri: photo.uri }}
                    style={[
                      styles.photoBubbleImage,
                      {
                        width: size - 8,
                        height: size - 8,
                        borderRadius: (size - 8) / 2,
                      },
                    ]}
                  />
                </View>
              </Mapbox.MarkerView>
            );
          })}
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
      </>
      ) : (
        <View style={styles.fallbackMap}>
          <View style={styles.fallbackCard}>
            <Ionicons name="warning-outline" size={30} color="#D4A843" />
            <Text style={styles.fallbackTitle}>Mapbox native build required</Text>
            <Text style={styles.fallbackText}>
              The recording screen can still track time and photos, but the live map preview needs the native Mapbox module in
              your dev build.
            </Text>
            <Text style={styles.fallbackCode}>{mapboxLoadError ?? 'Mapbox native code not available.'}</Text>
          </View>
        </View>
      )}

      <View style={[styles.topOverlay, { paddingTop: Math.max(insets.top + 8, 20) }]}>
        <View style={styles.headerRow}>
          <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color="#2C2418" />
          </Pressable>

          <View style={styles.headerActions}>
            <View style={styles.headerPill}>
              <Ionicons name="radio-outline" size={14} color="#fff" />
              <Text style={styles.headerPillText}>{isTracking ? 'Recording live' : 'Recording paused'}</Text>
            </View>

            <Pressable style={styles.collapseButton} onPress={() => setIsPanelExpanded((current) => !current)}>
              <Ionicons name={isPanelExpanded ? 'chevron-up' : 'chevron-down'} size={20} color="#2C2418" />
            </Pressable>
            <Pressable style={[styles.sosButton, isSendingSos && styles.sosButtonDisabled]} onPress={handleSos} disabled={isSendingSos}>
              {isSendingSos ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="warning-outline" size={20} color="#fff" />}
            </Pressable>
          </View>
        </View>

        <View style={styles.heroCard}>
          {isTrailLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color="#630E13" />
              <Text style={styles.loadingText}>Loading trail session...</Text>
            </View>
          ) : (
            <>
              <Text style={styles.trailName}>{trail?.name ?? 'Trail session'}</Text>
              <Text style={styles.trailRegion}>{trail?.region ?? 'Live location recording'}</Text>

              <Text style={styles.timerText}>{formatElapsed(elapsedMs)}</Text>
              <Text style={styles.timerCaption}>
                {navigationOffTrack != null
                  ? navigationOffTrack
                    ? `${Math.round(navigationDeviationMeters ?? nearestDistance ?? 0)} m off route`
                    : 'Navigation says you are on route'
                  : nearestDistance == null
                  ? 'Checking your trail position...'
                  : nearestDistance <= 120
                  ? 'You are on the route'
                  : `${Math.round(nearestDistance)} m off route`}
              </Text>

              <View
                style={[
                  styles.safetyLiveCard,
                  primarySafetyAlert && {
                    borderColor: `${getRiskColor(getSafetyAlertSeverity(primarySafetyAlert))}55`,
                  },
                ]}
              >
                <View
                  style={[
                    styles.safetyLiveIcon,
                    {
                      backgroundColor: primarySafetyAlert
                        ? getRiskColor(getSafetyAlertSeverity(primarySafetyAlert))
                        : '#1E7A46',
                    },
                  ]}
                >
                  {isSafetyLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Ionicons name={primarySafetyAlert ? getSafetyAlertIcon(primarySafetyAlert) : 'shield-checkmark-outline'} size={16} color="#fff" />
                  )}
                </View>
                <View style={styles.safetyLiveCopy}>
                  <Text style={styles.safetyLiveTitle}>
                    {primarySafetyAlert
                      ? seriousSafetyAlertCount > 0
                        ? `${seriousSafetyAlertCount} serious safety alert${seriousSafetyAlertCount === 1 ? '' : 's'} nearby`
                        : `${safetyAlerts.length} safety alert${safetyAlerts.length === 1 ? '' : 's'} nearby`
                      : safetyError
                      ? 'Safety alerts unavailable'
                      : isSafetyLoading
                      ? 'Checking nearby safety alerts'
                      : 'No safety alerts nearby'}
                  </Text>
                  <Text style={styles.safetyLiveText} numberOfLines={2}>
                    {primarySafetyAlert
                      ? safetyAlertWarning(primarySafetyAlert)
                      : safetyError ?? `Scanning within ${formatSafetyDistance(SAFETY_ALERT_RADIUS_METERS)} of your live GPS point.`}
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Refresh safety alerts"
                  style={[styles.safetyRefreshButton, (!currentLocation || isSafetyLoading) && styles.safetyRefreshButtonDisabled]}
                  onPress={refreshSafetyAlerts}
                  disabled={!currentLocation || isSafetyLoading}
                >
                  <Ionicons name="refresh" size={17} color="#2C2418" />
                </Pressable>
              </View>

              <View style={styles.actionButtonsRow}>
                <Pressable style={[styles.actionButton, styles.primaryActionButton]} onPress={pauseOrResumeTracking}>
                  <Ionicons name={isTracking ? 'pause' : 'play'} size={16} color="#fff" />
                  {isPanelExpanded ? (
                    <Text style={styles.primaryActionButtonText}>{isTracking ? 'Pause timer' : 'Resume timer'}</Text>
                  ) : null}
                </Pressable>

                <Pressable
                  style={[styles.actionButton, styles.secondaryActionButton, isCapturingPhoto && styles.secondaryActionButtonDisabled]}
                  onPress={handleCapturePhoto}
                  disabled={isCapturingPhoto}
                >
                  <Ionicons name="camera-outline" size={16} color="#2C2418" />
                  {isPanelExpanded ? (
                    <Text style={styles.secondaryActionButtonText}>{isCapturingPhoto ? 'Opening camera...' : 'Tag photo here'}</Text>
                  ) : null}
                </Pressable>
              </View>

              {isPanelExpanded ? (
                <>
                  <View style={styles.metricsRow}>
                    {navigationProgressPercent != null ? (
                      <View style={styles.metricChip}>
                        <Ionicons name="flag-outline" size={15} color="#630E13" />
                        <Text style={styles.metricChipText}>{navigationProgressPercent}% trail progress</Text>
                      </View>
                    ) : null}
                    <View style={styles.metricChip}>
                      <Ionicons name="navigate-outline" size={15} color="#630E13" />
                      <Text style={styles.metricChipText}>
                        {recordedPath.length > 1 ? `${recordedPath.length} points tracked` : 'Waiting for movement'}
                      </Text>
                    </View>
                    <View style={styles.metricChip}>
                      <Ionicons name="footsteps-outline" size={15} color="#630E13" />
                      <Text style={styles.metricChipText}>
                        {isStepCountingAvailable === false ? 'Steps unavailable' : `${stepCount} steps`}
                      </Text>
                    </View>
                    <View style={styles.metricChip}>
                      <Ionicons name="images-outline" size={15} color="#630E13" />
                      <Text style={styles.metricChipText}>{sessionPhotos.length} photo tags</Text>
                    </View>
                  </View>

                  <View style={styles.statusCard}>
                    <Text style={styles.statusTitle}>
                      {navigationOffTrack != null
                        ? navigationOffTrack
                          ? `Navigation alert: ${Math.round(navigationDeviationMeters ?? nearestDistance ?? 0)} m off route`
                          : 'Navigation confirms you are on route'
                        : nearestDistance == null
                        ? 'Checking your trail position...'
                        : nearestDistance <= 120
                        ? 'You are on the trail preview'
                        : `You are about ${Math.round(nearestDistance)} m from the trail`}
                    </Text>
                    <Text style={styles.statusText}>
                      {locationMessage ?? stepMessage ?? trailError ?? 'Your GPS path overlays the trail map in real time.'}
                    </Text>
                    {navigationInstruction ? (
                      <Text style={styles.navigationHintText}>{navigationInstruction}</Text>
                    ) : navigationHint ? (
                      <Text style={styles.navigationHintText}>{navigationHint}</Text>
                    ) : null}
                  </View>

                  {primarySafetyAlert ? (
                    <View style={styles.safetyDetailCard}>
                      <View style={styles.safetyDetailHeader}>
                        <View
                          style={[
                            styles.safetyDetailIcon,
                            { backgroundColor: getRiskColor(getSafetyAlertSeverity(primarySafetyAlert)) },
                          ]}
                        >
                          <Ionicons name={getSafetyAlertIcon(primarySafetyAlert)} size={18} color="#fff" />
                        </View>
                        <View style={styles.safetyDetailCopy}>
                          <Text style={styles.safetyDetailEyebrow}>Closest safety alert</Text>
                          <Text style={styles.safetyDetailTitle}>{safetyAlertTitle(primarySafetyAlert)}</Text>
                        </View>
                        <Text style={styles.safetyDetailDistance}>{formatSafetyDistance(primarySafetyAlert.distance_meters)}</Text>
                      </View>
                      <Text style={styles.safetyDetailText}>{safetyAlertWarning(primarySafetyAlert)}</Text>

                      {safetyAlerts.length > 1 ? (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.safetyAlertStrip}>
                          {safetyAlerts.slice(0, 6).map((alert) => {
                            const selected = primarySafetyAlert.kind === alert.kind && primarySafetyAlert.id === alert.id;
                            const tone = getRiskColor(getSafetyAlertSeverity(alert));

                            return (
                              <Pressable
                                key={`${alert.kind}-${alert.id}`}
                                style={[
                                  styles.safetyAlertChip,
                                  selected && styles.safetyAlertChipSelected,
                                  selected && { borderColor: tone },
                                ]}
                                onPress={() => setSelectedSafetyAlert(alert)}
                              >
                                <Ionicons name={getSafetyAlertIcon(alert)} size={14} color={tone} />
                                <Text style={styles.safetyAlertChipText} numberOfLines={1}>
                                  {formatSafetyDistance(alert.distance_meters)}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </ScrollView>
                      ) : null}

                      <Pressable
                        style={styles.safetyReportButton}
                        onPress={() =>
                          navigation.navigate('ReportIssue', {
                            latitude: currentLocation?.[1] ?? primarySafetyAlert.latitude,
                            longitude: currentLocation?.[0] ?? primarySafetyAlert.longitude,
                            locationName: trail?.name ?? safetyAlertTitle(primarySafetyAlert),
                          })
                        }
                      >
                        <Ionicons name="warning-outline" size={15} color="#630E13" />
                        <Text style={styles.safetyReportButtonText}>Report an incident from here</Text>
                      </Pressable>
                    </View>
                  ) : null}

                  <View style={[styles.guideCard, nearestDistance != null && nearestDistance > 120 && styles.guideCardWarning]}>
                    <View style={styles.guideAvatar}>
                      <Text style={styles.guideAvatarText}>N</Text>
                    </View>
                    <View style={styles.guideCopy}>
                      <Text style={styles.guideTitle}>{guideMessage.title}</Text>
                      <Text style={styles.guideText}>{guideMessage.body}</Text>
                    </View>
                  </View>

                  <View style={styles.actionButtonsRow}>
                    <Pressable style={[styles.actionButton, styles.finishButton]} onPress={handleFinish}>
                      <Ionicons name="flag-outline" size={16} color="#fff" />
                      <Text style={styles.finishButtonText}>Finish trail</Text>
                    </Pressable>

                    <Pressable style={[styles.actionButton, styles.cancelButton]} onPress={handleCancel}>
                      <Ionicons name="close-outline" size={16} color="#630E13" />
                      <Text style={styles.cancelButtonText}>Cancel activity</Text>
                    </Pressable>
                  </View>
                </>
              ) : (
                <View style={styles.compactFooterRow}>
                  <Pressable style={[styles.actionButton, styles.compactFinishButton]} onPress={handleFinish}>
                    <Ionicons name="flag-outline" size={16} color="#fff" />
                  </Pressable>

                  <Pressable style={[styles.actionButton, styles.compactCancelButton]} onPress={handleCancel}>
                    <Ionicons name="close-outline" size={16} color="#630E13" />
                  </Pressable>
                </View>
              )}
            </>
          )}
        </View>
      </View>

      <View style={[styles.bottomSheet, { paddingBottom: Math.max(insets.bottom + 12, 20) }]}>
        <Pressable style={styles.bottomSheetHeader} onPress={() => setIsPhotosExpanded((current) => !current)}>
          <Text style={styles.bottomSheetTitle}>Tagged photos</Text>
          <View style={styles.bottomSheetHeaderRight}>
            <Text style={styles.bottomSheetCount}>{sessionPhotos.length}</Text>
            <Ionicons name={isPhotosExpanded ? 'chevron-down' : 'chevron-up'} size={18} color="#2C2418" />
          </View>
        </Pressable>

        {isPhotosExpanded ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoStrip}>
            {sessionPhotos.length ? (
              sessionPhotos.map((photo) => (
                <View key={photo.id} style={styles.photoCard}>
                  <Image source={{ uri: photo.uri }} style={styles.photoThumbnail} />
                  <View style={styles.photoMeta}>
                    <Ionicons name="location-outline" size={13} color="#630E13" />
                    <Text style={styles.photoMetaText}>
                      {photo.coordinate[1].toFixed(4)}, {photo.coordinate[0].toFixed(4)}
                    </Text>
                  </View>
                  <Text style={styles.photoTimeText}>{new Date(photo.capturedAt).toLocaleTimeString()}</Text>
                </View>
              ))
            ) : (
              <View style={styles.emptyPhotoCard}>
                <Ionicons name="camera-outline" size={22} color="#8A7A6A" />
                <Text style={styles.emptyPhotoText}>Take a photo and it will be pinned to your current location.</Text>
              </View>
            )}
          </ScrollView>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  recordingContainer: {
    flex: 1,
    backgroundColor: '#120408',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  mapControls: {
    position: 'absolute',
    right: 12,
    bottom: 120,
    flexDirection: 'column',
    gap: 8,
  },
  controlButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(234,226,204,0.96)',
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
  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  backButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(234,226,204,0.96)',
  },
  headerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(18,4,8,0.76)',
  },
  headerPillText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  collapseButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(234,226,204,0.96)',
  },
  sosButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#BB2823',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  sosButtonDisabled: {
    opacity: 0.7,
  },
  heroCard: {
    borderRadius: 28,
    padding: 16,
    backgroundColor: 'rgba(250,248,242,0.94)',
    gap: 12,
    maxWidth: 420,
    alignSelf: 'flex-end',
  },
  trailName: {
    color: '#2C2418',
    fontSize: 20,
    fontWeight: '800',
  },
  trailRegion: {
    marginTop: -8,
    color: '#7B6D5A',
    fontSize: 14,
  },
  timerText: {
    color: '#630E13',
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  timerCaption: {
    marginTop: -4,
    color: '#7B6D5A',
    fontSize: 12,
    lineHeight: 18,
  },
  metricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metricChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: '#F5ECE4',
  },
  metricChipText: {
    color: '#4A4131',
    fontSize: 12,
    fontWeight: '700',
  },
  statusCard: {
    borderRadius: 20,
    padding: 14,
    backgroundColor: '#FFF4E8',
    borderWidth: 1,
    borderColor: '#F0D8BC',
  },
  statusTitle: {
    color: '#2C2418',
    fontSize: 14,
    fontWeight: '800',
  },
  statusText: {
    marginTop: 4,
    color: '#705F4D',
    fontSize: 12,
    lineHeight: 18,
  },
  navigationHintText: {
    marginTop: 8,
    color: '#2C2418',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  safetyLiveCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 18,
    padding: 11,
    backgroundColor: '#F7F3E7',
    borderWidth: 1,
    borderColor: '#E7DDCD',
  },
  safetyLiveIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  safetyLiveCopy: {
    flex: 1,
    minWidth: 0,
  },
  safetyLiveTitle: {
    color: '#2C2418',
    fontSize: 12,
    fontWeight: '900',
  },
  safetyLiveText: {
    marginTop: 2,
    color: '#6B5D4E',
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
  },
  safetyRefreshButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFE4D3',
  },
  safetyRefreshButtonDisabled: {
    opacity: 0.55,
  },
  safetyDetailCard: {
    borderRadius: 20,
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EADFD0',
    gap: 10,
  },
  safetyDetailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  safetyDetailIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  safetyDetailCopy: {
    flex: 1,
    minWidth: 0,
  },
  safetyDetailEyebrow: {
    color: '#8A7A6A',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  safetyDetailTitle: {
    marginTop: 2,
    color: '#2C2418',
    fontSize: 14,
    fontWeight: '900',
  },
  safetyDetailDistance: {
    color: '#630E13',
    fontSize: 12,
    fontWeight: '900',
  },
  safetyDetailText: {
    color: '#5E4E40',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  safetyAlertStrip: {
    gap: 8,
    paddingVertical: 2,
  },
  safetyAlertChip: {
    minWidth: 72,
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 10,
    borderRadius: 17,
    backgroundColor: '#F7F3E7',
    borderWidth: 1,
    borderColor: '#E7DDCD',
  },
  safetyAlertChipSelected: {
    backgroundColor: '#FFF8F1',
    borderWidth: 2,
  },
  safetyAlertChipText: {
    color: '#4A4131',
    fontSize: 11,
    fontWeight: '900',
  },
  safetyReportButton: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 15,
    backgroundColor: '#F7EBE8',
  },
  safetyReportButtonText: {
    color: '#630E13',
    fontSize: 12,
    fontWeight: '900',
  },
  guideCard: {
    flexDirection: 'row',
    gap: 12,
    borderRadius: 20,
    padding: 14,
    backgroundColor: '#F5ECE4',
  },
  guideCardWarning: {
    backgroundColor: '#FFF1E7',
    borderWidth: 1,
    borderColor: '#F1B38A',
  },
  guideAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#630E13',
  },
  guideAvatarText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  guideCopy: {
    flex: 1,
  },
  guideTitle: {
    color: '#2C2418',
    fontSize: 13,
    fontWeight: '800',
  },
  guideText: {
    marginTop: 4,
    color: '#5E4E40',
    fontSize: 12,
    lineHeight: 18,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 18,
  },
  compactFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  primaryActionButton: {
    paddingVertical: 15,
    backgroundColor: '#630E13',
  },
  primaryActionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  secondaryActionButton: {
    paddingVertical: 15,
    backgroundColor: '#EFE4D3',
  },
  secondaryActionButtonDisabled: {
    opacity: 0.65,
  },
  secondaryActionButtonText: {
    color: '#2C2418',
    fontSize: 14,
    fontWeight: '800',
  },
  finishButton: {
    paddingVertical: 15,
    backgroundColor: '#1E7A46',
  },
  finishButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  cancelButton: {
    paddingVertical: 15,
    backgroundColor: '#F7EBE8',
  },
  cancelButtonText: {
    color: '#630E13',
    fontSize: 14,
    fontWeight: '800',
  },
  compactFinishButton: {
    backgroundColor: '#1E7A46',
  },
  compactCancelButton: {
    backgroundColor: '#F7EBE8',
  },
  bottomSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 14,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(250,248,242,0.97)',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  bottomSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 2,
  },
  bottomSheetTitle: {
    color: '#2C2418',
    fontSize: 16,
    fontWeight: '800',
  },
  bottomSheetHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bottomSheetCount: {
    color: '#7B6D5A',
    fontSize: 12,
    fontWeight: '700',
  },
  photoStrip: {
    paddingVertical: 14,
    gap: 12,
  },
  photoCard: {
    width: 170,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    padding: 10,
  },
  photoThumbnail: {
    width: '100%',
    height: 118,
    borderRadius: 14,
    backgroundColor: '#EEE6DC',
  },
  photoMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  photoMetaText: {
    color: '#4A4131',
    fontSize: 11,
    fontWeight: '700',
  },
  photoTimeText: {
    marginTop: 6,
    color: '#8A7A6A',
    fontSize: 11,
  },
  emptyPhotoCard: {
    width: 260,
    borderRadius: 20,
    padding: 18,
    backgroundColor: '#F4ECE4',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  emptyPhotoText: {
    flex: 1,
    color: '#6B5D4E',
    fontSize: 12,
    lineHeight: 18,
  },
  currentLocationOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(57,255,20,0.24)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  currentLocationInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#39FF14',
  },
  photoBubbleMarker: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFEF9',
    borderWidth: 3,
    borderColor: '#7A9A3A',
    shadowColor: '#000',
    shadowOpacity: 0.24,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 7,
  },
  photoBubbleImage: {
    backgroundColor: '#EAE2CC',
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
  safetyMarkerSelected: {
    transform: [{ scale: 1.12 }],
    backgroundColor: '#FFF8F1',
  },
  fallbackMap: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  fallbackCard: {
    margin: 20,
    borderRadius: 24,
    padding: 20,
    backgroundColor: 'rgba(44,36,24,0.92)',
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
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    color: '#4A4131',
    fontSize: 14,
    fontWeight: '700',
  },
});

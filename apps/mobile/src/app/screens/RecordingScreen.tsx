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

const MAPBOX_STYLE_URL =
  process.env.EXPO_PUBLIC_MAPBOX_STYLE_URL ?? 'mapbox://styles/shahdmallah/cmnqgt687000h01s66inve68a';
const MAPBOX_ACCESS_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ?? '';

type RecordingNavigationProp = StackNavigationProp<RootStackParamList>;
type RecordingRouteProp = RouteProp<RootStackParamList, 'Recording'>;
type MapboxModule = typeof import('@rnmapbox/maps');

const fallbackCenter: [number, number] = [35.24, 31.78];

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

export function RecordingScreen() {
  const navigation = useNavigation<RecordingNavigationProp>();
  const route = useRoute<RecordingRouteProp>();
  const insets = useSafeAreaInsets();
  const { trailId } = route.params;
  const cameraRef = useRef<any>(null);
  const hasStartedSessionRef = useRef(false);
  const closingActionRef = useRef<'finish' | 'cancel' | null>(null);
  const {
    activeSession,
    finishedSession,
    startTrailSession,
    pauseOrResumeTracking,
    addSessionPhoto,
    finishTrailSession,
    cancelTrailSession,
  } = useTrailTracking();
  const [isCapturingPhoto, setIsCapturingPhoto] = useState(false);
  const [isPanelExpanded, setIsPanelExpanded] = useState(false);
  const [isPhotosExpanded, setIsPhotosExpanded] = useState(false);

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
  const routeCoordinates = trail?.routeCoordinates?.length ? trail.routeCoordinates : [];
  const navigationHint = useMemo(
    () => buildNavigationHint(currentLocation, routeCoordinates, nearestDistance),
    [currentLocation, nearestDistance, routeCoordinates],
  );

  useEffect(() => {
    hasStartedSessionRef.current = false;
  }, [trailId]);

  useEffect(() => {
    if (!session && !hasStartedSessionRef.current && !closingActionRef.current) {
      hasStartedSessionRef.current = true;
      void startTrailSession(trailId);
    }
  }, [session, startTrailSession, trailId]);

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

          {sessionPhotos.map((photo) => (
            <Mapbox.PointAnnotation key={photo.id} id={`photo-${photo.id}`} coordinate={photo.coordinate}>
              <View style={styles.photoPin}>
                <Ionicons name="camera" size={14} color="#fff" />
              </View>
            </Mapbox.PointAnnotation>
          ))}
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
                {nearestDistance == null
                  ? 'Checking your trail position...'
                  : nearestDistance <= 120
                  ? 'You are on the route'
                  : `${Math.round(nearestDistance)} m off route`}
              </Text>

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
                      {nearestDistance == null
                        ? 'Checking your trail position...'
                        : nearestDistance <= 120
                        ? 'You are on the trail preview'
                        : `You are about ${Math.round(nearestDistance)} m from the trail`}
                    </Text>
                    <Text style={styles.statusText}>
                      {locationMessage ?? stepMessage ?? trailError ?? 'Your GPS path overlays the trail map in real time.'}
                    </Text>
                    {navigationHint ? <Text style={styles.navigationHintText}>{navigationHint}</Text> : null}
                  </View>

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
  photoPin: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#630E13',
    borderWidth: 2,
    borderColor: '#FFFFFF',
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

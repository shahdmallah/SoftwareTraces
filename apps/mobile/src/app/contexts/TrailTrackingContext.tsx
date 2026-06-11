import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import { Pedometer } from 'expo-sensors';
import type { Trail } from '../api/trailsApi';
import { getTrailById } from '../api/trailsApi';
import {
  addActivityPoints,
  completeActivity,
  createActivity,
  deleteActivity,
  getActivityById,
  getActivityMedia,
  updateActivityStatus,
  uploadActivityMedia,
} from '../api/activitiesApi';
import { saveNatureSighting } from '../api/natureSightingsApi';
import { hasDetectedSpecies, identifySpeciesDetails } from '../api/speciesApi';
import { useLanguage } from './LanguageContext';
import {
  checkNavigationPosition,
  endNavigationSession,
  startNavigationSession,
} from '../api/navigationApi';
import { presentNavigationAlertNotification } from '../services/pushNotifications';

export type SessionPhoto = {
  id: string;
  uri: string;
  coordinate: [number, number];
  capturedAt: number;
  remoteId?: string;
  syncStatus?: 'pending' | 'synced' | 'failed';
};

export type RecordedActivitySample = {
  coordinate: [number, number];
  elevationM?: number;
  speedMps?: number;
  recordedAt: number;
};

export type ActiveTrailSession = {
  trailId: string;
  trail: Trail | null;
  isTrailLoading: boolean;
  trailError: string | null;
  locationMessage: string | null;
  stepMessage: string | null;
  currentLocation: [number, number] | null;
  recordedPath: [number, number][];
  recordedSamples: RecordedActivitySample[];
  sessionPhotos: SessionPhoto[];
  isTracking: boolean;
  isStepCountingAvailable: boolean | null;
  stepCount: number;
  elapsedMs: number;
  startedAt: number | null;
  backendActivityId: string | null;
  backendSyncMessage: string | null;
  nearestDistance: number | null;
  syncedPointCount: number;
  navigationSessionId: string | null;
  navigationInstruction: string | null;
  navigationProgressPercent: number | null;
  navigationOffTrack: boolean | null;
  navigationDeviationMeters: number | null;
};

export type CompletedTrailSession = {
  trailId: string;
  trail: Trail | null;
  recordedPath: [number, number][];
  recordedSamples: RecordedActivitySample[];
  sessionPhotos: SessionPhoto[];
  stepCount: number;
  elapsedMs: number;
  finishedAt: number;
  activityId?: string;
};

type TrailTrackingContextValue = {
  activeSession: ActiveTrailSession | null;
  activeSessionTrailId: string | null;
  finishedSession: CompletedTrailSession | null;
  startTrailSession: (trailId: string) => Promise<void>;
  resumeTrailSession: (trailId: string, activityId: string) => Promise<void>;
  pauseOrResumeTracking: () => void;
  addSessionPhoto: (photo: SessionPhoto) => void;
  finishTrailSession: () => CompletedTrailSession | null;
  cancelTrailSession: () => void;
  clearFinishedSession: () => void;
};

const locationOptions: Location.LocationOptions = {
  accuracy: Location.Accuracy.BestForNavigation,
  timeInterval: 4000,
  distanceInterval: 5,
};
const LIVE_POINT_SYNC_INTERVAL_MS = 20000;
const NAVIGATION_CHECK_INTERVAL_MS = 12000;
const NAVIGATION_ALERT_NOTIFICATION_COOLDOWN_MS = 5 * 60 * 1000;
const ACTIVITY_SESSION_SNAPSHOT_PREFIX = 'traces.activity-session.';
const OFF_ROUTE_DISTANCE_METERS = 50;

const TrailTrackingContext = createContext<TrailTrackingContextValue | undefined>(undefined);

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

function projectToMeters(point: [number, number], origin: [number, number]) {
  const metersPerDegreeLat = 111320;
  const metersPerDegreeLng = metersPerDegreeLat * Math.cos((origin[1] * Math.PI) / 180);

  return {
    x: (point[0] - origin[0]) * metersPerDegreeLng,
    y: (point[1] - origin[1]) * metersPerDegreeLat,
  };
}

function getDistanceToSegmentMeters(point: [number, number], start: [number, number], end: [number, number]) {
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

function getNearestDistanceToTrail(current: [number, number], trail: Trail | null) {
  if (!trail) {
    return null;
  }

  const route =
    trail.routeCoordinates?.length ? trail.routeCoordinates : ([[trail.coordinates[1], trail.coordinates[0]]] as [number, number][]);

  if (route.length === 1) {
    return getDistanceMeters(current, route[0]);
  }

  return route.reduce((nearest, point, index) => {
    const previous = route[index - 1];
    return previous ? Math.min(nearest, getDistanceToSegmentMeters(current, previous, point)) : nearest;
  }, Number.POSITIVE_INFINITY);
}

function isOffRouteDistance(distance: number | null | undefined) {
  return distance != null && Number.isFinite(distance) && distance > OFF_ROUTE_DISTANCE_METERS;
}

function isOffRouteStepMessage(message: string | null) {
  return message?.startsWith('Steps are paused') === true;
}

function getPathDistanceMeters(path: [number, number][]) {
  return path.reduce((total, point, index) => {
    const previous = path[index - 1];
    return previous ? total + getDistanceMeters(previous, point) : total;
  }, 0);
}

function optionalFiniteNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function parseOptionalNumber(value: unknown) {
  if (value == null || value === '') {
    return undefined;
  }

  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function sampleFromLocation(position: Location.LocationObject): RecordedActivitySample {
  return {
    coordinate: [position.coords.longitude, position.coords.latitude],
    elevationM: optionalFiniteNumber(position.coords.altitude),
    speedMps: optionalFiniteNumber(position.coords.speed),
    recordedAt: position.timestamp || Date.now(),
  };
}

function samplesToPointPayloads(samples: RecordedActivitySample[]) {
  return samples.map((sample) => ({
    lat: sample.coordinate[1],
    lng: sample.coordinate[0],
    elevation: sample.elevationM,
    speedMps: sample.speedMps,
    recordedAt: new Date(sample.recordedAt).toISOString(),
  }));
}

function getElevationStats(samples: RecordedActivitySample[]) {
  const elevations = samples
    .map((sample) => sample.elevationM)
    .filter((value): value is number => value != null && Number.isFinite(value));

  if (!elevations.length) {
    return {
      gain: 0,
      loss: 0,
      max: 0,
      min: 0,
    };
  }

  let gain = 0;
  let loss = 0;

  for (let index = 1; index < elevations.length; index += 1) {
    const delta = elevations[index] - elevations[index - 1];
    if (delta > 0) {
      gain += delta;
    } else {
      loss += Math.abs(delta);
    }
  }

  return {
    gain,
    loss,
    max: Math.max(...elevations),
    min: Math.min(...elevations),
  };
}

function getSpeedStats(samples: RecordedActivitySample[], distanceMeters: number, elapsedMs: number) {
  const speeds = samples
    .map((sample) => sample.speedMps)
    .filter((value): value is number => value != null && Number.isFinite(value) && value >= 0);
  const fallbackAverage = elapsedMs > 0 ? distanceMeters / (elapsedMs / 1000) : 0;
  const average = speeds.length ? speeds.reduce((sum, value) => sum + value, 0) / speeds.length : fallbackAverage;
  const max = speeds.length ? Math.max(...speeds) : fallbackAverage;

  return {
    average: Number.isFinite(average) ? average : 0,
    max: Number.isFinite(max) ? max : 0,
  };
}

function toTimestamp(value?: string | null) {
  if (!value) {
    return null;
  }

  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function estimateElapsedMsFromActivity(
  activity: Awaited<ReturnType<typeof getActivityById>>,
  photoCapturedTimes: number[],
  cachedElapsedMs?: number | null,
) {
  if (cachedElapsedMs != null && Number.isFinite(cachedElapsedMs) && cachedElapsedMs > 0) {
    return Math.max(0, cachedElapsedMs);
  }

  if (typeof activity.elapsed_time_seconds === 'number' && Number.isFinite(activity.elapsed_time_seconds)) {
    return Math.max(0, activity.elapsed_time_seconds * 1000);
  }

  const startMs = toTimestamp(activity.start_time);
  if (!startMs) {
    return 0;
  }

  if (activity.status !== 'paused') {
    return Math.max(0, Date.now() - startMs);
  }

  const pointTimes = activity.points
    .map((point) => toTimestamp(point.recorded_at))
    .filter((timestamp): timestamp is number => timestamp != null);
  const photoTimes = photoCapturedTimes.filter((timestamp) => Number.isFinite(timestamp));
  const lastRecordedMs = Math.max(...pointTimes, ...photoTimes);

  return Number.isFinite(lastRecordedMs) ? Math.max(0, lastRecordedMs - startMs) : 0;
}

function activitySessionSnapshotKey(activityId: string) {
  return `${ACTIVITY_SESSION_SNAPSHOT_PREFIX}${activityId}`;
}

async function readActivityElapsedSnapshot(activityId: string) {
  try {
    const rawValue = await SecureStore.getItemAsync(activitySessionSnapshotKey(activityId));
    if (!rawValue) {
      return null;
    }

    const snapshot = JSON.parse(rawValue) as { elapsedMs?: unknown };
    const elapsedMs = typeof snapshot.elapsedMs === 'number' ? snapshot.elapsedMs : null;
    return elapsedMs != null && Number.isFinite(elapsedMs) && elapsedMs >= 0 ? elapsedMs : null;
  } catch {
    return null;
  }
}

async function writeActivityElapsedSnapshot(activityId: string, trailId: string, elapsedMs: number) {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) {
    return;
  }

  await SecureStore.setItemAsync(
    activitySessionSnapshotKey(activityId),
    JSON.stringify({
      trailId,
      elapsedMs,
      pausedAt: new Date().toISOString(),
    }),
  ).catch(() => undefined);
}

async function clearActivityElapsedSnapshot(activityId: string) {
  await SecureStore.deleteItemAsync(activitySessionSnapshotKey(activityId)).catch(() => undefined);
}

function mediaFileFromUri(uri: string, id: string) {
  const cleanUri = uri.split('?')[0] ?? uri;
  const extension = cleanUri.split('.').pop()?.toLowerCase() || 'jpg';
  const normalizedExtension = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(extension) ? extension : 'jpg';
  const mimeType =
    normalizedExtension === 'png'
      ? 'image/png'
      : normalizedExtension === 'webp'
      ? 'image/webp'
      : normalizedExtension === 'gif'
      ? 'image/gif'
      : 'image/jpeg';

  return {
    uri,
    name: `activity-photo-${id}.${normalizedExtension === 'jpeg' ? 'jpg' : normalizedExtension}`,
    type: mimeType,
  };
}

export function TrailTrackingProvider({ children }: { children: ReactNode }) {
  const { language } = useLanguage();
  const [activeSession, setActiveSession] = useState<ActiveTrailSession | null>(null);
  const [activeSessionTrailId, setActiveSessionTrailId] = useState<string | null>(null);
  const [finishedSession, setFinishedSession] = useState<CompletedTrailSession | null>(null);
  const watchSubscription = useRef<Location.LocationSubscription | null>(null);
  const pedometerSubscription = useRef<ReturnType<typeof Pedometer.watchStepCount> | null>(null);
  const stepsOffsetRef = useRef(0);
  const pedometerRawStepsRef = useRef(0);
  const hasPedometerReadingRef = useRef(false);
  const pedometerEnabledRef = useRef(false);
  const sessionRunIdRef = useRef(0);
  const activeSessionRef = useRef<ActiveTrailSession | null>(null);
  const activeBackendActivityIdRef = useRef<string | null>(null);
  const navigationCheckInFlightRef = useRef(false);
  const lastNavigationCheckAtRef = useRef(0);
  const lastNavigationAlertNotificationAtRef = useRef(0);
  const lastNavigationAlertNotificationSessionRef = useRef<string | null>(null);

  useEffect(() => {
    activeSessionRef.current = activeSession;
    activeBackendActivityIdRef.current = activeSession?.backendActivityId ?? null;
  }, [activeSession]);

  const stopPedometer = useCallback(() => {
    pedometerSubscription.current?.remove();
    pedometerSubscription.current = null;
  }, []);

  const stopLocationWatch = useCallback(() => {
    watchSubscription.current?.remove();
    watchSubscription.current = null;
  }, []);

  const cleanupSubscriptions = useCallback(() => {
    stopLocationWatch();
    stopPedometer();
  }, [stopLocationWatch, stopPedometer]);

  const attachNavigationSession = useCallback((trailId: string, runId: number) => {
    lastNavigationCheckAtRef.current = 0;
    navigationCheckInFlightRef.current = false;
    lastNavigationAlertNotificationAtRef.current = 0;
    lastNavigationAlertNotificationSessionRef.current = null;

    startNavigationSession(trailId)
      .then((navigationSession) => {
        if (sessionRunIdRef.current !== runId) {
          return;
        }

        setActiveSession((current) =>
          current && current.trailId === trailId
            ? {
                ...current,
                navigationSessionId: navigationSession.id,
                navigationInstruction: navigationSession.instruction ?? null,
                navigationProgressPercent: 0,
                navigationOffTrack: false,
                navigationDeviationMeters: null,
              }
            : current,
        );
      })
      .catch(() => undefined);
  }, []);

  const reportNavigationPosition = useCallback((coordinate: [number, number], position: Location.LocationObject) => {
    const session = activeSessionRef.current;
    const navigationSessionId = session?.navigationSessionId;

    if (!session?.isTracking || !navigationSessionId) {
      return;
    }

    const now = Date.now();
    if (navigationCheckInFlightRef.current || now - lastNavigationCheckAtRef.current < NAVIGATION_CHECK_INTERVAL_MS) {
      return;
    }

    navigationCheckInFlightRef.current = true;
    lastNavigationCheckAtRef.current = now;
    const heading = typeof position.coords.heading === 'number' && Number.isFinite(position.coords.heading)
      ? position.coords.heading
      : undefined;

    checkNavigationPosition(navigationSessionId, {
      latitude: coordinate[1],
      longitude: coordinate[0],
      heading,
      timestamp: new Date(position.timestamp || now).toISOString(),
    })
      .then((result) => {
        const localDeviationMeters = getNearestDistanceToTrail(coordinate, session.trail);
        const effectiveDeviationMeters = result.deviation_meters ?? localDeviationMeters;
        const isFarOffRoute = isOffRouteDistance(effectiveDeviationMeters);
        const alertNotificationDue =
          isFarOffRoute &&
          (
            lastNavigationAlertNotificationSessionRef.current !== navigationSessionId ||
            Date.now() - lastNavigationAlertNotificationAtRef.current >= NAVIGATION_ALERT_NOTIFICATION_COOLDOWN_MS
          );

        if (alertNotificationDue) {
          lastNavigationAlertNotificationAtRef.current = Date.now();
          lastNavigationAlertNotificationSessionRef.current = navigationSessionId;
          void presentNavigationAlertNotification({
            trailId: session.trailId,
            activityId: session.backendActivityId,
            navigationSessionId,
            body: result.instruction,
            latitude: coordinate[1],
            longitude: coordinate[0],
            deviationMeters: effectiveDeviationMeters,
            progressPercent: isFarOffRoute ? session.navigationProgressPercent ?? 0 : result.progress_percent,
          }).catch((error) => {
            console.warn('[navigation] Failed to present navigation alert notification:', error);
          });
        }

        setActiveSession((current) =>
          current?.navigationSessionId === navigationSessionId
            ? {
                ...current,
                navigationInstruction: result.instruction,
                navigationProgressPercent: isFarOffRoute ? current.navigationProgressPercent : result.progress_percent,
                navigationOffTrack: isFarOffRoute,
                navigationDeviationMeters: effectiveDeviationMeters,
              }
            : current,
        );
      })
      .catch(() => undefined)
      .finally(() => {
        navigationCheckInFlightRef.current = false;
      });
  }, []);

  const beginPedometerWatch = useCallback((runId: number) => {
    stopPedometer();
    pedometerRawStepsRef.current = 0;
    hasPedometerReadingRef.current = false;

    if (!pedometerEnabledRef.current) {
      return;
    }

    pedometerSubscription.current = Pedometer.watchStepCount((result) => {
      if (sessionRunIdRef.current !== runId) {
        return;
      }

      const rawSteps = Math.max(0, result.steps);
      const previousRawSteps = hasPedometerReadingRef.current ? pedometerRawStepsRef.current : 0;
      const stepDelta = Math.max(0, rawSteps - previousRawSteps);
      pedometerRawStepsRef.current = rawSteps;
      hasPedometerReadingRef.current = true;

      setActiveSession((current) => {
        if (!current || !current.isTracking) {
          return current;
        }

        const deviationMeters = current.navigationDeviationMeters ?? current.nearestDistance;
        if (isOffRouteDistance(deviationMeters)) {
          return {
            ...current,
            stepMessage: `Steps are paused until you are within ${OFF_ROUTE_DISTANCE_METERS} m of the trail.`,
          };
        }

        if (stepDelta === 0) {
          return current;
        }

        return {
          ...current,
          stepCount: current.stepCount + stepDelta,
          stepMessage: null,
        };
      });
    });
  }, [stopPedometer]);

  const beginLocationWatch = useCallback(async (runId: number) => {
    const permission = await Location.requestForegroundPermissionsAsync();

    if (sessionRunIdRef.current !== runId) {
      return;
    }

    if (permission.status !== 'granted') {
      throw new Error('Location permission is required to record the trail.');
    }

    const initialPosition = await Location.getCurrentPositionAsync(locationOptions);

    if (sessionRunIdRef.current !== runId) {
      return;
    }

    const initialSample = sampleFromLocation(initialPosition);
    const initialCoordinate = initialSample.coordinate;

    setActiveSession((current) => {
      if (!current) {
        return current;
      }

      const nearestDistance = getNearestDistanceToTrail(initialCoordinate, current.trail);
      const isFarOffRoute = isOffRouteDistance(nearestDistance);

      return {
        ...current,
        currentLocation: initialCoordinate,
        recordedPath: current.recordedPath.length || isFarOffRoute ? current.recordedPath : [initialCoordinate],
        recordedSamples: current.recordedSamples.length || isFarOffRoute ? current.recordedSamples : [initialSample],
        locationMessage: isFarOffRoute
          ? `You are ${Math.round(nearestDistance ?? 0)} m off route. Rejoin the trail before progress, distance, or steps count.`
          : null,
        stepMessage: !isFarOffRoute && isOffRouteStepMessage(current.stepMessage) ? null : current.stepMessage,
        nearestDistance,
      };
    });
    reportNavigationPosition(initialCoordinate, initialPosition);

    watchSubscription.current = await Location.watchPositionAsync(locationOptions, (position) => {
      if (sessionRunIdRef.current !== runId) {
        return;
      }

      const nextSample = sampleFromLocation(position);
      const nextCoordinate = nextSample.coordinate;

      setActiveSession((current) => {
        if (!current) {
          return current;
        }

        const nearestDistance = getNearestDistanceToTrail(nextCoordinate, current.trail);
        const isFarOffRoute = isOffRouteDistance(nearestDistance);
        const lastPoint = current.recordedPath[current.recordedPath.length - 1];
        const nextRecordedPath =
          current.isTracking && !isFarOffRoute && (!lastPoint || getDistanceMeters(lastPoint, nextCoordinate) >= 8)
            ? [...current.recordedPath, nextCoordinate]
            : current.recordedPath;
        const didRecordPoint = nextRecordedPath.length > current.recordedPath.length;

        return {
          ...current,
          currentLocation: nextCoordinate,
          recordedPath: nextRecordedPath,
          recordedSamples: didRecordPoint ? [...current.recordedSamples, nextSample] : current.recordedSamples,
          locationMessage: isFarOffRoute
            ? `You are ${Math.round(nearestDistance ?? 0)} m off route. Rejoin the trail before progress, distance, or steps count.`
            : null,
          stepMessage: !isFarOffRoute && isOffRouteStepMessage(current.stepMessage) ? null : current.stepMessage,
          nearestDistance,
        };
      });
      reportNavigationPosition(nextCoordinate, position);
    });
  }, [reportNavigationPosition]);

  const ensurePedometerReady = useCallback(async (runId: number) => {
    try {
      const isAvailable = await Pedometer.isAvailableAsync();

      if (sessionRunIdRef.current !== runId) {
        return;
      }

      if (!isAvailable) {
        pedometerEnabledRef.current = false;
        setActiveSession((current) =>
          current
            ? {
                ...current,
                isStepCountingAvailable: false,
                stepMessage: 'Step counting is not available on this device.',
              }
            : current,
        );
        return;
      }

      const existingPermission = await Pedometer.getPermissionsAsync();
      let permission = existingPermission;

      if (!existingPermission.granted && existingPermission.canAskAgain) {
        permission = await Pedometer.requestPermissionsAsync();
      }

      if (sessionRunIdRef.current !== runId) {
        return;
      }

      if (!permission.granted) {
        pedometerEnabledRef.current = false;
        setActiveSession((current) =>
          current
            ? {
                ...current,
                isStepCountingAvailable: false,
                stepMessage: 'Motion permission is required to count steps during this recording.',
              }
            : current,
        );
        return;
      }

      pedometerEnabledRef.current = true;
      setActiveSession((current) =>
        current
          ? {
              ...current,
              isStepCountingAvailable: true,
              stepMessage: null,
            }
          : current,
      );
      beginPedometerWatch(runId);
    } catch (error) {
      if (sessionRunIdRef.current !== runId) {
        return;
      }

      pedometerEnabledRef.current = false;
      setActiveSession((current) =>
        current
          ? {
              ...current,
              isStepCountingAvailable: false,
              stepMessage: error instanceof Error ? error.message : 'Unable to start the step counter.',
            }
          : current,
      );
    }
  }, [beginPedometerWatch]);

  const syncActivityPoints = useCallback(async () => {
    const session = activeSessionRef.current;

    if (!session?.backendActivityId || session.recordedSamples.length <= session.syncedPointCount) {
      return;
    }

    const newSamples = session.recordedSamples.slice(session.syncedPointCount);

    try {
      await addActivityPoints(
        session.backendActivityId,
        samplesToPointPayloads(newSamples),
      );

      setActiveSession((current) =>
        current?.backendActivityId === session.backendActivityId
          ? {
              ...current,
              syncedPointCount: Math.max(current.syncedPointCount, session.syncedPointCount + newSamples.length),
              backendSyncMessage: null,
            }
          : current,
      );
    } catch (error) {
      setActiveSession((current) =>
        current?.backendActivityId === session.backendActivityId
          ? {
              ...current,
              backendSyncMessage: error instanceof Error ? error.message : 'Unable to sync latest GPS points.',
            }
          : current,
      );
    }
  }, []);

  const syncSessionPhoto = useCallback(async (activityId: string, photo: SessionPhoto) => {
    try {
      const uploadedPhoto = await uploadActivityMedia(activityId, {
        photo: mediaFileFromUri(photo.uri, photo.id),
        latitude: photo.coordinate[1],
        longitude: photo.coordinate[0],
        capturedAt: new Date(photo.capturedAt).toISOString(),
      });

      if (uploadedPhoto.id) {
        void identifySpeciesDetails(mediaFileFromUri(photo.uri, photo.id), language)
          .then((identification) => {
            if (!hasDetectedSpecies(identification.result)) {
              return undefined;
            }

            return saveNatureSighting({
              trail_id: uploadedPhoto.trail_id ?? activeSessionRef.current?.trailId ?? null,
              activity_id: uploadedPhoto.activity_id ?? activityId,
              photo_id: uploadedPhoto.id,
              photo_type: 'activity_media',
              photo_url: uploadedPhoto.public_url,
              latitude: photo.coordinate[1],
              longitude: photo.coordinate[0],
              language,
              classification: identification.result,
            });
          })
          .catch((error) => {
            console.warn('[TrailTracking] Nature sighting skipped', error);
          });
      }

      setActiveSession((current) =>
        current?.backendActivityId === activityId
          ? {
              ...current,
              sessionPhotos: current.sessionPhotos.map((item) =>
                item.id === photo.id
                  ? {
                      ...item,
                      remoteId: uploadedPhoto.id,
                      uri: uploadedPhoto.public_url || item.uri,
                      syncStatus: 'synced',
                    }
                  : item,
              ),
              backendSyncMessage: null,
            }
          : current,
      );
    } catch (error) {
      setActiveSession((current) =>
        current?.backendActivityId === activityId
          ? {
              ...current,
              sessionPhotos: current.sessionPhotos.map((item) =>
                item.id === photo.id ? { ...item, syncStatus: 'failed' } : item,
              ),
              backendSyncMessage: error instanceof Error ? error.message : 'Unable to sync photo.',
            }
          : current,
      );
    }
  }, [language]);

  const cancelBackendActivity = useCallback(async (activityId: string | null) => {
    if (!activityId) {
      return;
    }

    try {
      await deleteActivity(activityId);
    } catch (error) {
      console.warn('[TrailTracking] Unable to delete cancelled activity:', error);
    } finally {
      await clearActivityElapsedSnapshot(activityId);
    }
  }, []);

  const startTrailSession = useCallback(
    async (trailId: string) => {
      if (activeSession?.trailId === trailId) {
        return;
      }

      const runId = sessionRunIdRef.current + 1;
      sessionRunIdRef.current = runId;
      cleanupSubscriptions();
      stepsOffsetRef.current = 0;
      pedometerEnabledRef.current = false;
      setFinishedSession(null);
      setActiveSessionTrailId(trailId);
      setActiveSession({
        trailId,
        trail: null,
        isTrailLoading: true,
        trailError: null,
        locationMessage: null,
        stepMessage: null,
        currentLocation: null,
        recordedPath: [],
        recordedSamples: [],
        sessionPhotos: [],
        isTracking: true,
        isStepCountingAvailable: null,
        stepCount: 0,
        elapsedMs: 0,
        startedAt: Date.now(),
        backendActivityId: null,
        backendSyncMessage: null,
        nearestDistance: null,
        syncedPointCount: 0,
        navigationSessionId: null,
        navigationInstruction: null,
        navigationProgressPercent: null,
        navigationOffTrack: null,
        navigationDeviationMeters: null,
      });
      activeBackendActivityIdRef.current = null;

      const startedAtIso = new Date().toISOString();
      attachNavigationSession(trailId, runId);
      createActivity({ trailId, startedAt: startedAtIso, title: 'Trail recording' })
        .then((activity) => {
          if (sessionRunIdRef.current !== runId) {
            void cancelBackendActivity(activity.id);
            return;
          }
          activeBackendActivityIdRef.current = activity.id;
          setActiveSession((current) =>
            current && current.trailId === trailId
              ? {
                  ...current,
                  backendActivityId: activity.id,
                  backendSyncMessage: null,
                }
              : current,
          );
        })
        .catch((error) => {
          if (sessionRunIdRef.current !== runId) {
            return;
          }
          activeBackendActivityIdRef.current = null;
          setActiveSession((current) =>
            current && current.trailId === trailId
              ? {
                  ...current,
                  backendActivityId: null,
                  backendSyncMessage: error instanceof Error ? error.message : 'Backend activity sync is unavailable.',
                }
              : current,
          );
        });

      try {
        const trail = await getTrailById(trailId);
        if (sessionRunIdRef.current !== runId) {
          return;
        }

        setActiveSession((current) =>
          current && current.trailId === trailId
            ? {
                ...current,
                trail,
                isTrailLoading: false,
                trailError: null,
                nearestDistance: current.currentLocation ? getNearestDistanceToTrail(current.currentLocation, trail) : null,
              }
            : current,
        );
      } catch (error) {
        setActiveSession((current) =>
          current && current.trailId === trailId
            ? {
                ...current,
                isTrailLoading: false,
                trailError: error instanceof Error ? error.message : 'Unable to load this trail.',
              }
            : current,
        );
      }

      try {
        await beginLocationWatch(runId);
      } catch (error) {
        if (sessionRunIdRef.current !== runId) {
          return;
        }

        setActiveSession((current) =>
          current && current.trailId === trailId
            ? {
                ...current,
                locationMessage: error instanceof Error ? error.message : 'Unable to access your location.',
              }
            : current,
        );
      }

      await ensurePedometerReady(runId);
    },
    [activeSession?.trailId, attachNavigationSession, beginLocationWatch, cancelBackendActivity, cleanupSubscriptions, ensurePedometerReady],
  );

  const resumeTrailSession = useCallback(
    async (trailId: string, activityId: string) => {
      if (activeSession?.backendActivityId === activityId) {
        return;
      }

      const runId = sessionRunIdRef.current + 1;
      sessionRunIdRef.current = runId;
      cleanupSubscriptions();
      stepsOffsetRef.current = 0;
      pedometerEnabledRef.current = false;
      setFinishedSession(null);
      setActiveSessionTrailId(trailId);
      setActiveSession({
        trailId,
        trail: null,
        isTrailLoading: true,
        trailError: null,
        locationMessage: null,
        stepMessage: null,
        currentLocation: null,
        recordedPath: [],
        recordedSamples: [],
        sessionPhotos: [],
        isTracking: true,
        isStepCountingAvailable: null,
        stepCount: 0,
        elapsedMs: 0,
        startedAt: Date.now(),
        backendActivityId: activityId,
        backendSyncMessage: null,
        nearestDistance: null,
        syncedPointCount: 0,
        navigationSessionId: null,
        navigationInstruction: null,
        navigationProgressPercent: null,
        navigationOffTrack: null,
        navigationDeviationMeters: null,
      });
      activeBackendActivityIdRef.current = activityId;
      attachNavigationSession(trailId, runId);

      try {
        const [trail, activity, media, cachedElapsedMs] = await Promise.all([
          getTrailById(trailId),
          getActivityById(activityId),
          getActivityMedia(activityId).catch(() => []),
          readActivityElapsedSnapshot(activityId),
        ]);

        if (sessionRunIdRef.current !== runId) {
          return;
        }

        const recordedPath: [number, number][] = activity.points
          .map((point) => [point.longitude, point.latitude] as [number, number])
          .filter(([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat));
        const recordedSamples: RecordedActivitySample[] = activity.points
          .map((point): RecordedActivitySample | null => {
            const lng = Number(point.longitude);
            const lat = Number(point.latitude);
            const recordedAt = toTimestamp(point.recorded_at);

            if (!Number.isFinite(lng) || !Number.isFinite(lat) || recordedAt == null) {
              return null;
            }

            return {
              coordinate: [lng, lat] as [number, number],
              elevationM: parseOptionalNumber(point.elevation),
              speedMps: parseOptionalNumber(point.speed_mps),
              recordedAt,
            };
          })
          .filter((sample): sample is RecordedActivitySample => sample !== null);
        const isTracking = activity.status !== 'paused';
        const mediaCapturedTimes = media
          .map((photo) => toTimestamp(photo.captured_at) ?? toTimestamp(photo.created_at))
          .filter((timestamp): timestamp is number => timestamp != null);
        const sessionPhotos = media.reduce<SessionPhoto[]>((photos, photo) => {
          const lat = Number(photo.latitude);
          const lng = Number(photo.longitude);
          const uri = photo.url?.trim();

          if (!uri || !Number.isFinite(lat) || !Number.isFinite(lng)) {
            return photos;
          }

          if (photos.some((existing) => existing.remoteId === photo.id || existing.uri === uri)) {
            return photos;
          }

          photos.push({
            id: photo.id,
            uri,
            coordinate: [lng, lat] as [number, number],
            capturedAt: toTimestamp(photo.captured_at) ?? toTimestamp(photo.created_at) ?? Date.now(),
            remoteId: photo.id,
            syncStatus: 'synced',
          });

          return photos;
        }, []);
        const elapsedMsFromActivity = estimateElapsedMsFromActivity(activity, mediaCapturedTimes, cachedElapsedMs);

        setActiveSession((current) =>
          current && current.backendActivityId === activityId
            ? {
                ...current,
                trail,
                isTrailLoading: false,
                trailError: null,
                recordedPath,
                recordedSamples,
                sessionPhotos,
                isTracking,
                elapsedMs: elapsedMsFromActivity,
                startedAt: isTracking ? Date.now() - elapsedMsFromActivity : null,
                backendActivityId: activityId,
                backendSyncMessage: null,
                syncedPointCount: recordedSamples.length || recordedPath.length,
                nearestDistance: current.currentLocation ? getNearestDistanceToTrail(current.currentLocation, trail) : null,
              }
            : current,
        );
      } catch (error) {
        if (sessionRunIdRef.current !== runId) {
          return;
        }

        setActiveSession((current) =>
          current && current.backendActivityId === activityId
            ? {
                ...current,
                isTrailLoading: false,
                trailError: error instanceof Error ? error.message : 'Unable to load this activity.',
              }
            : current,
        );
      }

      try {
        await beginLocationWatch(runId);
      } catch (error) {
        if (sessionRunIdRef.current !== runId) {
          return;
        }

        setActiveSession((current) =>
          current && current.backendActivityId === activityId
            ? {
                ...current,
                locationMessage: error instanceof Error ? error.message : 'Unable to access your location.',
              }
            : current,
        );
      }

      await ensurePedometerReady(runId);
    },
    [activeSession?.backendActivityId, attachNavigationSession, beginLocationWatch, cleanupSubscriptions, ensurePedometerReady],
  );

  useEffect(() => {
    if (!activeSession?.isTracking || !activeSession.startedAt) {
      return;
    }

    const interval = setInterval(() => {
      setActiveSession((current) => {
        if (!current || !current.isTracking || !current.startedAt) {
          return current;
        }

        return {
          ...current,
          elapsedMs: Date.now() - current.startedAt,
        };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [activeSession?.isTracking, activeSession?.startedAt]);

  useEffect(() => {
    if (!activeSession?.backendActivityId || !activeSession.isTracking) {
      return;
    }

    const interval = setInterval(() => {
      void syncActivityPoints();
    }, LIVE_POINT_SYNC_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [activeSession?.backendActivityId, activeSession?.isTracking, syncActivityPoints]);

  useEffect(() => () => cleanupSubscriptions(), [cleanupSubscriptions]);

  const pauseOrResumeTracking = useCallback(() => {
    const wasTracking = activeSession?.isTracking;
    const backendActivityId = activeSession?.backendActivityId;
    const pausedElapsedMs =
      activeSession?.isTracking && activeSession.startedAt
        ? Date.now() - activeSession.startedAt
        : activeSession?.elapsedMs ?? null;

    setActiveSession((current) => {
      if (!current) {
        return current;
      }

      if (current.isTracking) {
        stepsOffsetRef.current = current.stepCount;
        stopPedometer();
        return {
          ...current,
          isTracking: false,
          elapsedMs: current.startedAt ? Date.now() - current.startedAt : current.elapsedMs,
        };
      }

      return {
        ...current,
        isTracking: true,
        startedAt: Date.now() - current.elapsedMs,
      };
    });

    if (backendActivityId && activeSession?.trailId && wasTracking && pausedElapsedMs != null) {
      void writeActivityElapsedSnapshot(backendActivityId, activeSession.trailId, pausedElapsedMs);
    }

    if (wasTracking === false && pedometerEnabledRef.current) {
      beginPedometerWatch(sessionRunIdRef.current);
    }

    if (backendActivityId && typeof wasTracking === 'boolean') {
      void updateActivityStatus(backendActivityId, wasTracking ? 'paused' : 'recording').catch(() => undefined);
    }
  }, [activeSession?.backendActivityId, activeSession?.elapsedMs, activeSession?.isTracking, activeSession?.startedAt, activeSession?.trailId, beginPedometerWatch, stopPedometer]);

  const addSessionPhoto = useCallback((photo: SessionPhoto) => {
    setActiveSession((current) =>
      current
        ? {
            ...current,
            sessionPhotos: [{ ...photo, syncStatus: current.backendActivityId ? 'pending' : undefined }, ...current.sessionPhotos],
          }
        : current,
    );

    if (activeSession?.backendActivityId) {
      void syncSessionPhoto(activeSession.backendActivityId, photo);
    }
  }, [activeSession?.backendActivityId, syncSessionPhoto]);

  useEffect(() => {
    const activityId = activeSession?.backendActivityId;

    if (!activityId) {
      return;
    }

    activeSession.sessionPhotos
      .filter((photo) => !photo.remoteId && photo.syncStatus == null)
      .forEach((photo) => {
        setActiveSession((current) =>
          current?.backendActivityId === activityId
            ? {
                ...current,
                sessionPhotos: current.sessionPhotos.map((item) =>
                  item.id === photo.id ? { ...item, syncStatus: 'pending' } : item,
                ),
              }
            : current,
        );
        void syncSessionPhoto(activityId, photo);
      });
  }, [activeSession?.backendActivityId, activeSession?.sessionPhotos, syncSessionPhoto]);

  const finishTrailSession = useCallback(() => {
    if (!activeSession) {
      return null;
    }

    const backendActivityId = activeSession.backendActivityId;
    const navigationSessionId = activeSession.navigationSessionId;
    const finishedAt = Date.now();
    const elapsedMs = activeSession.isTracking && activeSession.startedAt ? finishedAt - activeSession.startedAt : activeSession.elapsedMs;
    const distanceMeters = getPathDistanceMeters(activeSession.recordedPath);

    const completed: CompletedTrailSession = {
      trailId: activeSession.trailId,
      trail: activeSession.trail,
      recordedPath: activeSession.recordedPath,
      recordedSamples: activeSession.recordedSamples,
      sessionPhotos: activeSession.sessionPhotos,
      stepCount: activeSession.stepCount,
      elapsedMs,
      finishedAt,
      activityId: backendActivityId ?? undefined,
    };

    if (backendActivityId) {
      const newSamples = activeSession.recordedSamples.slice(activeSession.syncedPointCount);

      if (newSamples.length) {
        void addActivityPoints(
          backendActivityId,
          samplesToPointPayloads(newSamples),
        ).catch(() => undefined);
      }

      const elevationStats = getElevationStats(activeSession.recordedSamples);
      const speedStats = getSpeedStats(activeSession.recordedSamples, distanceMeters, elapsedMs);

      void completeActivity(backendActivityId, {
        endedAt: new Date(finishedAt).toISOString(),
        distanceMeters,
        elevationGainMeters: elevationStats.gain || activeSession.trail?.elevationGain || 0,
        elevationLossMeters: elevationStats.loss,
        maxElevationMeters: elevationStats.max,
        minElevationMeters: elevationStats.min,
        maxSpeedMps: speedStats.max,
        avgSpeedMps: speedStats.average,
      }).catch(() => undefined);
      void clearActivityElapsedSnapshot(backendActivityId);
    }

    if (navigationSessionId) {
      void endNavigationSession(navigationSessionId).catch(() => undefined);
    }

    activeBackendActivityIdRef.current = null;
    sessionRunIdRef.current += 1;
    cleanupSubscriptions();
    setFinishedSession(completed);
    setActiveSessionTrailId(null);
    setActiveSession(null);
    return completed;
  }, [activeSession, cleanupSubscriptions]);

  const cancelTrailSession = useCallback(() => {
    const backendActivityId = activeBackendActivityIdRef.current ?? activeSessionRef.current?.backendActivityId ?? null;
    const navigationSessionId = activeSessionRef.current?.navigationSessionId;
    if (navigationSessionId) {
      void endNavigationSession(navigationSessionId).catch(() => undefined);
    }
    void cancelBackendActivity(backendActivityId);

    activeBackendActivityIdRef.current = null;
    sessionRunIdRef.current += 1;
    cleanupSubscriptions();
    setFinishedSession(null);
    setActiveSessionTrailId(null);
    setActiveSession(null);
  }, [cancelBackendActivity, cleanupSubscriptions]);

  const clearFinishedSession = useCallback(() => {
    setFinishedSession(null);
  }, []);

  const value = useMemo(
    () => ({
      activeSession,
      activeSessionTrailId,
      finishedSession,
      startTrailSession,
      resumeTrailSession,
      pauseOrResumeTracking,
      addSessionPhoto,
      finishTrailSession,
      cancelTrailSession,
      clearFinishedSession,
    }),
    [
      activeSession,
      activeSessionTrailId,
      finishedSession,
      startTrailSession,
      resumeTrailSession,
      pauseOrResumeTracking,
      addSessionPhoto,
      finishTrailSession,
      cancelTrailSession,
      clearFinishedSession,
    ],
  );

  return <TrailTrackingContext.Provider value={value}>{children}</TrailTrackingContext.Provider>;
}

export function useTrailTracking() {
  const context = useContext(TrailTrackingContext);

  if (!context) {
    throw new Error('useTrailTracking must be used within a TrailTrackingProvider.');
  }

  return context;
}

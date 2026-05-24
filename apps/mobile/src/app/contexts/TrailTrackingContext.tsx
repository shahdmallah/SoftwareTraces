import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { Pedometer } from 'expo-sensors';
import type { Trail } from '../api/trailsApi';
import { getTrailById } from '../api/trailsApi';
import {
  addActivityPoints,
  completeActivity,
  createActivity,
  getActivityById,
  getActivityMedia,
  updateActivityStatus,
  uploadActivityMedia,
} from '../api/activitiesApi';
import {
  checkNavigationPosition,
  endNavigationSession,
  startNavigationSession,
} from '../api/navigationApi';

export type SessionPhoto = {
  id: string;
  uri: string;
  coordinate: [number, number];
  capturedAt: number;
  remoteId?: string;
  syncStatus?: 'pending' | 'synced' | 'failed';
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

function getNearestDistanceToTrail(current: [number, number], trail: Trail | null) {
  if (!trail) {
    return null;
  }

  const route =
    trail.routeCoordinates?.length ? trail.routeCoordinates : ([[trail.coordinates[1], trail.coordinates[0]]] as [number, number][]);

  return route.reduce((nearest, point) => Math.min(nearest, getDistanceMeters(current, point)), Number.POSITIVE_INFINITY);
}

function getPathDistanceMeters(path: [number, number][]) {
  return path.reduce((total, point, index) => {
    const previous = path[index - 1];
    return previous ? total + getDistanceMeters(previous, point) : total;
  }, 0);
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
) {
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
  const [activeSession, setActiveSession] = useState<ActiveTrailSession | null>(null);
  const [activeSessionTrailId, setActiveSessionTrailId] = useState<string | null>(null);
  const [finishedSession, setFinishedSession] = useState<CompletedTrailSession | null>(null);
  const watchSubscription = useRef<Location.LocationSubscription | null>(null);
  const pedometerSubscription = useRef<ReturnType<typeof Pedometer.watchStepCount> | null>(null);
  const stepsOffsetRef = useRef(0);
  const pedometerEnabledRef = useRef(false);
  const sessionRunIdRef = useRef(0);
  const activeSessionRef = useRef<ActiveTrailSession | null>(null);
  const navigationCheckInFlightRef = useRef(false);
  const lastNavigationCheckAtRef = useRef(0);

  useEffect(() => {
    activeSessionRef.current = activeSession;
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
        setActiveSession((current) =>
          current?.navigationSessionId === navigationSessionId
            ? {
                ...current,
                navigationInstruction: result.instruction,
                navigationProgressPercent: result.progress_percent,
                navigationOffTrack: result.off_track,
                navigationDeviationMeters: result.deviation_meters,
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

    if (!pedometerEnabledRef.current) {
      return;
    }

    pedometerSubscription.current = Pedometer.watchStepCount((result) => {
      if (sessionRunIdRef.current !== runId) {
        return;
      }

      setActiveSession((current) => {
        if (!current || !current.isTracking) {
          return current;
        }

        return {
          ...current,
          stepCount: stepsOffsetRef.current + result.steps,
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

    const initialCoordinate: [number, number] = [initialPosition.coords.longitude, initialPosition.coords.latitude];

    setActiveSession((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        currentLocation: initialCoordinate,
        recordedPath: current.recordedPath.length ? current.recordedPath : [initialCoordinate],
        locationMessage: null,
        nearestDistance: getNearestDistanceToTrail(initialCoordinate, current.trail),
      };
    });
    reportNavigationPosition(initialCoordinate, initialPosition);

    watchSubscription.current = await Location.watchPositionAsync(locationOptions, (position) => {
      if (sessionRunIdRef.current !== runId) {
        return;
      }

      const nextCoordinate: [number, number] = [position.coords.longitude, position.coords.latitude];

      setActiveSession((current) => {
        if (!current) {
          return current;
        }

        const lastPoint = current.recordedPath[current.recordedPath.length - 1];
        const nextRecordedPath =
          current.isTracking && (!lastPoint || getDistanceMeters(lastPoint, nextCoordinate) >= 8)
            ? [...current.recordedPath, nextCoordinate]
            : current.recordedPath;

        return {
          ...current,
          currentLocation: nextCoordinate,
          recordedPath: nextRecordedPath,
          locationMessage: null,
          nearestDistance: getNearestDistanceToTrail(nextCoordinate, current.trail),
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

    if (!session?.backendActivityId || session.recordedPath.length <= session.syncedPointCount) {
      return;
    }

    const newPoints = session.recordedPath.slice(session.syncedPointCount);
    const elapsedMs = session.isTracking && session.startedAt ? Date.now() - session.startedAt : session.elapsedMs;
    const startedAt = session.startedAt ?? Date.now() - elapsedMs;
    const pointIntervalMs = session.recordedPath.length > 1 ? Math.max(1000, Math.floor(elapsedMs / session.recordedPath.length)) : 1000;

    try {
      await addActivityPoints(
        session.backendActivityId,
        newPoints.map(([lng, lat], index) => ({
          lat,
          lng,
          recordedAt: new Date(startedAt + (session.syncedPointCount + index) * pointIntervalMs).toISOString(),
        })),
      );

      setActiveSession((current) =>
        current?.backendActivityId === session.backendActivityId
          ? {
              ...current,
              syncedPointCount: Math.max(current.syncedPointCount, session.syncedPointCount + newPoints.length),
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

      const startedAtIso = new Date().toISOString();
      attachNavigationSession(trailId, runId);
      createActivity({ trailId, startedAt: startedAtIso, title: 'Trail recording' })
        .then((activity) => {
          if (sessionRunIdRef.current !== runId) {
            return;
          }
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
    [activeSession?.trailId, attachNavigationSession, beginLocationWatch, cleanupSubscriptions, ensurePedometerReady],
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
      attachNavigationSession(trailId, runId);

      try {
        const [trail, activity, media] = await Promise.all([
          getTrailById(trailId),
          getActivityById(activityId),
          getActivityMedia(activityId).catch(() => []),
        ]);

        if (sessionRunIdRef.current !== runId) {
          return;
        }

        const recordedPath: [number, number][] = activity.points
          .map((point) => [point.longitude, point.latitude] as [number, number])
          .filter(([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat));
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
        const elapsedMsFromActivity = estimateElapsedMsFromActivity(activity, mediaCapturedTimes);

        setActiveSession((current) =>
          current && current.backendActivityId === activityId
            ? {
                ...current,
                trail,
                isTrailLoading: false,
                trailError: null,
                recordedPath,
                sessionPhotos,
                isTracking,
                elapsedMs: elapsedMsFromActivity,
                startedAt: isTracking ? Date.now() - elapsedMsFromActivity : null,
                backendActivityId: activityId,
                backendSyncMessage: null,
                syncedPointCount: recordedPath.length,
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

    if (wasTracking === false && pedometerEnabledRef.current) {
      beginPedometerWatch(sessionRunIdRef.current);
    }

    const backendActivityId = activeSession?.backendActivityId;
    if (backendActivityId && typeof wasTracking === 'boolean') {
      void updateActivityStatus(backendActivityId, wasTracking ? 'paused' : 'recording').catch(() => undefined);
    }
  }, [activeSession?.backendActivityId, activeSession?.isTracking, beginPedometerWatch, stopPedometer]);

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
      sessionPhotos: activeSession.sessionPhotos,
      stepCount: activeSession.stepCount,
      elapsedMs,
      finishedAt,
      activityId: backendActivityId ?? undefined,
    };

    if (backendActivityId) {
      const newPoints = activeSession.recordedPath.slice(activeSession.syncedPointCount);
      const startedAt = activeSession.startedAt ?? finishedAt - elapsedMs;
      const pointIntervalMs = activeSession.recordedPath.length > 1 ? Math.max(1000, Math.floor(elapsedMs / activeSession.recordedPath.length)) : 1000;

      if (newPoints.length) {
        void addActivityPoints(
          backendActivityId,
          newPoints.map(([lng, lat], index) => ({
            lat,
            lng,
            recordedAt: new Date(startedAt + (activeSession.syncedPointCount + index) * pointIntervalMs).toISOString(),
          })),
        ).catch(() => undefined);
      }

      void completeActivity(backendActivityId, {
        endedAt: new Date(finishedAt).toISOString(),
        distanceMeters,
        elevationGainMeters: activeSession.trail?.elevationGain ?? 0,
        elevationLossMeters: 0,
        maxElevationMeters: 0,
        minElevationMeters: 0,
        maxSpeedMps: elapsedMs > 0 ? distanceMeters / (elapsedMs / 1000) : 0,
        avgSpeedMps: elapsedMs > 0 ? distanceMeters / (elapsedMs / 1000) : 0,
      }).catch(() => undefined);
    }

    if (navigationSessionId) {
      void endNavigationSession(navigationSessionId).catch(() => undefined);
    }

    sessionRunIdRef.current += 1;
    cleanupSubscriptions();
    setFinishedSession(completed);
    setActiveSessionTrailId(null);
    setActiveSession(null);
    return completed;
  }, [activeSession, cleanupSubscriptions]);

  const cancelTrailSession = useCallback(() => {
    const navigationSessionId = activeSessionRef.current?.navigationSessionId;
    if (navigationSessionId) {
      void endNavigationSession(navigationSessionId).catch(() => undefined);
    }

    sessionRunIdRef.current += 1;
    cleanupSubscriptions();
    setFinishedSession(null);
    setActiveSessionTrailId(null);
    setActiveSession(null);
  }, [cleanupSubscriptions]);

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

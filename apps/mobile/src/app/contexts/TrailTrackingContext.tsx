import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { Pedometer } from 'expo-sensors';
import type { Trail } from '../api/trailsApi';
import { getTrailById } from '../api/trailsApi';

export type SessionPhoto = {
  id: string;
  uri: string;
  coordinate: [number, number];
  capturedAt: number;
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
  nearestDistance: number | null;
};

export type CompletedTrailSession = {
  trailId: string;
  trail: Trail | null;
  recordedPath: [number, number][];
  sessionPhotos: SessionPhoto[];
  stepCount: number;
  elapsedMs: number;
  finishedAt: number;
};

type TrailTrackingContextValue = {
  activeSession: ActiveTrailSession | null;
  activeSessionTrailId: string | null;
  finishedSession: CompletedTrailSession | null;
  startTrailSession: (trailId: string) => Promise<void>;
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

export function TrailTrackingProvider({ children }: { children: ReactNode }) {
  const [activeSession, setActiveSession] = useState<ActiveTrailSession | null>(null);
  const [activeSessionTrailId, setActiveSessionTrailId] = useState<string | null>(null);
  const [finishedSession, setFinishedSession] = useState<CompletedTrailSession | null>(null);
  const watchSubscription = useRef<Location.LocationSubscription | null>(null);
  const pedometerSubscription = useRef<ReturnType<typeof Pedometer.watchStepCount> | null>(null);
  const stepsOffsetRef = useRef(0);
  const pedometerEnabledRef = useRef(false);
  const sessionRunIdRef = useRef(0);

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
    });
  }, []);

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
        nearestDistance: null,
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
    [activeSession?.trailId, beginLocationWatch, cleanupSubscriptions, ensurePedometerReady],
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
  }, [activeSession?.isTracking, beginPedometerWatch, stopPedometer]);

  const addSessionPhoto = useCallback((photo: SessionPhoto) => {
    setActiveSession((current) =>
      current
        ? {
            ...current,
            sessionPhotos: [photo, ...current.sessionPhotos],
          }
        : current,
    );
  }, []);

  const finishTrailSession = useCallback(() => {
    if (!activeSession) {
      return null;
    }

    const completed: CompletedTrailSession = {
      trailId: activeSession.trailId,
      trail: activeSession.trail,
      recordedPath: activeSession.recordedPath,
      sessionPhotos: activeSession.sessionPhotos,
      stepCount: activeSession.stepCount,
      elapsedMs: activeSession.isTracking && activeSession.startedAt ? Date.now() - activeSession.startedAt : activeSession.elapsedMs,
      finishedAt: Date.now(),
    };

    sessionRunIdRef.current += 1;
    cleanupSubscriptions();
    setFinishedSession(completed);
    setActiveSessionTrailId(null);
    setActiveSession(null);
    return completed;
  }, [activeSession, cleanupSubscriptions]);

  const cancelTrailSession = useCallback(() => {
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

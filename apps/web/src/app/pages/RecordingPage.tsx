import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Pause, Play, Square, AlertCircle, Navigation2, WifiOff, Satellite } from 'lucide-react';
import { MapboxTrailMap } from '../components/MapboxTrailMap';
import { sendSosAlert, startActivity, updateActivityStatus, type Activity } from '../api/activities';
import { checkNavigationPosition, endNavigationSession, startNavigationSession } from '../api/navigation';
import { getAccessToken } from '../api/client';

export function RecordingPage() {
  const [searchParams] = useSearchParams();
  const trailId = searchParams.get('trailId');
  const [activity, setActivity] = useState<Activity | null>(null);
  const [navigationSessionId, setNavigationSessionId] = useState<string | null>(null);
  const [navigationInstruction, setNavigationInstruction] = useState('');
  const [isPaused, setIsPaused] = useState(false);
  const [routePoints, setRoutePoints] = useState<[number, number][]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const watchIdRef = useRef<number | null>(null);
  const navigationSessionIdRef = useRef<string | null>(null);
  const isGuest = !getAccessToken();

  useEffect(() => {
    navigationSessionIdRef.current = navigationSessionId;
  }, [navigationSessionId]);

  useEffect(() => {
    if (!isGuest) {
      startActivity(trailId ?? undefined)
        .then(setActivity)
        .catch((error) => setErrorMessage(error instanceof Error ? error.message : 'Unable to start activity.'));

      if (trailId) {
        startNavigationSession(trailId)
          .then((session) => setNavigationSessionId(session.id))
          .catch(() => undefined);
      }
    }
  }, [isGuest, trailId]);

  useEffect(() => {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition((position) => {
      setRoutePoints([[position.coords.longitude, position.coords.latitude]]);
    });

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const point: [number, number] = [position.coords.longitude, position.coords.latitude];
        setRoutePoints((current) => [...current, point]);

        const sessionId = navigationSessionIdRef.current;
        if (sessionId) {
          void checkNavigationPosition(sessionId, {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            heading: position.coords.heading,
          })
            .then((result) => {
              if (result.instruction) setNavigationInstruction(result.instruction);
            })
            .catch(() => undefined);
        }
      },
      () => undefined,
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    );

    return () => {
      if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, []);

  const handleTogglePause = async () => {
    const nextPaused = !isPaused;
    setIsPaused(nextPaused);
    if (activity?.id) await updateActivityStatus(activity.id, nextPaused ? 'paused' : 'recording').catch(() => undefined);
  };

  const handleStop = async () => {
    if (!confirm('Stop recording? Your activity will be saved.')) return;
    if (activity?.id) await updateActivityStatus(activity.id, 'completed').catch(() => undefined);
    if (navigationSessionId) await endNavigationSession(navigationSessionId).catch(() => undefined);
  };

  const handleSos = async () => {
    if (isGuest) {
      setErrorMessage('Sign in to send account-linked SOS alerts.');
      return;
    }

    try {
      await sendSosAlert({ activityId: activity?.id, location: routePoints.at(-1) });
      alert('SOS alert sent.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to send SOS alert.');
    }
  };

  return (
    <div className="h-screen bg-background flex flex-col">
      <div className="bg-card border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${isPaused ? 'bg-accent' : 'bg-destructive animate-pulse'}`}></div>
              <div>
                <h3 className="font-semibold text-foreground">{isPaused ? 'Paused' : isGuest ? 'Preview recording' : 'Recording'}</h3>
                <p className="text-xs text-secondary">{activity?.title || (isGuest ? 'Sign in to save this activity' : 'Live activity')}</p>
                {navigationInstruction && <p className="text-xs text-primary mt-1">{navigationInstruction}</p>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 px-2 py-1 bg-success/10 text-success rounded-lg">
                <Satellite className="w-3 h-3" />
                <span className="text-xs font-medium">GPS</span>
              </div>
              {navigationSessionId && (
                <div className="flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded-lg">
                  <Navigation2 className="w-3 h-3" />
                  <span className="text-xs font-medium">Nav</span>
                </div>
              )}
              <div className="flex items-center gap-1 px-2 py-1 bg-muted/20 rounded-lg">
                <WifiOff className="w-3 h-3 text-muted" />
                <span className="text-xs text-muted">Offline-ready</span>
              </div>
            </div>
          </div>
          {errorMessage && <p className="text-xs text-red-600 mt-2">{errorMessage}</p>}
        </div>
      </div>

      <div className="flex-1 relative">
        <MapboxTrailMap routeCoordinates={routePoints} heightClassName="h-full" onMapClick={(point) => setRoutePoints((prev) => [...prev, point])} />

        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 flex items-center gap-4">
          <button onClick={() => void handleTogglePause()} className="w-14 h-14 rounded-full bg-card border border-border flex items-center justify-center shadow-lg">
            {isPaused ? <Play className="w-6 h-6 text-primary" /> : <Pause className="w-6 h-6 text-primary" />}
          </button>
          <button onClick={() => void handleStop()} className="w-16 h-16 rounded-full bg-destructive text-white flex items-center justify-center shadow-lg">
            <Square className="w-7 h-7" />
          </button>
          <button onClick={() => void handleSos()} className="w-14 h-14 rounded-full bg-destructive/10 border border-destructive flex items-center justify-center shadow-lg">
            <AlertCircle className="w-6 h-6 text-destructive" />
          </button>
        </div>
      </div>
    </div>
  );
}

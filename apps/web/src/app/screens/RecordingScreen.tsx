import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowLeft, LocateFixed, Pause, Play, Square } from 'lucide-react';
import { completeActivity, startActivity, syncActivityPoints } from '../lib/api';
import { EmptyState, ErrorState, PageHeader, PageShell } from '../components/web';
import { useAuth } from '../contexts/AuthContext';

type TrackPoint = {
  latitude: number;
  longitude: number;
  elevation?: number;
  accuracy?: number;
  speed_mps?: number;
  recorded_at: string;
};

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function distanceMeters(a: TrackPoint, b: TrackPoint) {
  const radius = 6371000;
  const latDelta = toRadians(b.latitude - a.latitude);
  const lngDelta = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const h =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(lngDelta / 2) ** 2;
  return 2 * radius * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function formatTime(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h > 0
    ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    : `${m}:${s.toString().padStart(2, '0')}`;
}

export function RecordingScreen() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [activityId, setActivityId] = useState<string>('');
  const [points, setPoints] = useState<TrackPoint[]>([]);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState('');
  const watchIdRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const totalDistance = useMemo(() => {
    return points.reduce((sum, point, index) => {
      if (index === 0) return sum;
      return sum + distanceMeters(points[index - 1], point);
    }, 0);
  }, [points]);

  const elevationGain = useMemo(() => {
    return points.reduce((sum, point, index) => {
      if (index === 0 || point.elevation == null || points[index - 1].elevation == null) return sum;
      const delta = point.elevation - Number(points[index - 1].elevation);
      return delta > 0 ? sum + delta : sum;
    }, 0);
  }, [points]);

  useEffect(() => {
    return () => {
      if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const stopWatch = () => {
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setRecording(false);
  };

  const start = async () => {
    setError('');

    if (!isAuthenticated) {
      setError('Sign in to record activities.');
      return;
    }

    if (!navigator.geolocation) {
      setError('Location is not available in this browser.');
      return;
    }

    try {
      if (!activityId) {
        const response = await startActivity();
        setActivityId(response.data.id);
      }

      setRecording(true);
      timerRef.current = setInterval(() => setElapsed((value) => value + 1), 1000);
      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          const point: TrackPoint = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            elevation: position.coords.altitude ?? undefined,
            accuracy: position.coords.accuracy,
            speed_mps: position.coords.speed ?? undefined,
            recorded_at: new Date().toISOString(),
          };
          setPoints((current) => [...current, point]);
        },
        () => setError('Location permission was not granted.'),
        { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
      );
    } catch (requestError) {
      setRecording(false);
      setError(requestError instanceof Error ? requestError.message : 'Unable to start recording.');
    }
  };

  const pause = async () => {
    stopWatch();
    if (activityId && points.length > 0) {
      await syncActivityPoints(activityId, points).catch(() => undefined);
    }
  };

  const finish = async () => {
    stopWatch();
    if (!activityId) {
      navigate('/app/history');
      return;
    }

    const elevations = points.map((point) => point.elevation).filter((value): value is number => typeof value === 'number');
    await syncActivityPoints(activityId, points).catch(() => undefined);
    await completeActivity(activityId, {
      ended_at: new Date().toISOString(),
      distance_meters: Math.round(totalDistance),
      elevation_gain_meters: Math.round(elevationGain),
      elevation_loss_meters: 0,
      max_elevation_meters: elevations.length ? Math.max(...elevations) : 0,
      min_elevation_meters: elevations.length ? Math.min(...elevations) : 0,
      max_speed_mps: Math.max(0, ...points.map((point) => point.speed_mps ?? 0)),
      avg_speed_mps: elapsed > 0 ? totalDistance / elapsed : 0,
    }).catch((requestError) => {
      setError(requestError instanceof Error ? requestError.message : 'Unable to save activity.');
    });
    navigate('/app/history');
  };

  return (
    <div className="app-frame">
      <PageShell>
        <Link className="btn btn-secondary mb-4" to="/app/explore">
          <ArrowLeft size={18} />
          Back
        </Link>

        <PageHeader title="Record activity" description="Uses browser location." />

        {error ? <div className="mb-4"><ErrorState message={error} /></div> : null}

        {!isAuthenticated ? (
          <EmptyState title="Sign in to record activities." action={<Link className="btn btn-primary" to="/auth?mode=signin">Sign in</Link>} />
        ) : (
          <section className="panel recording-panel">
            <div className="recording-metrics">
              <div><span>Time</span><strong>{formatTime(elapsed)}</strong></div>
              <div><span>Distance</span><strong>{(totalDistance / 1000).toFixed(2)} km</strong></div>
              <div><span>Points</span><strong>{points.length}</strong></div>
              <div><span>Elevation gain</span><strong>{Math.round(elevationGain)} m</strong></div>
            </div>

            <div className="toolbar mt-6">
              {!recording ? (
                <button className="btn btn-primary" onClick={start}>
                  <Play size={18} />
                  Start
                </button>
              ) : (
                <button className="btn btn-secondary" onClick={pause}>
                  <Pause size={18} />
                  Pause
                </button>
              )}
              <button className="btn btn-secondary" onClick={finish}>
                <Square size={18} />
                Finish
              </button>
            </div>

            {points.length === 0 ? (
              <div className="mt-6">
                <EmptyState title="No location points yet." description="Start recording and allow location access." />
              </div>
            ) : (
              <div className="mt-6 cluster text-muted-foreground">
                <LocateFixed size={18} />
                Last point: {points.at(-1)?.latitude.toFixed(5)}, {points.at(-1)?.longitude.toFixed(5)}
              </div>
            )}
          </section>
        )}
      </PageShell>
    </div>
  );
}

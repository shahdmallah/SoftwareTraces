import { useEffect, useState } from 'react';
import { Pause, Play, Square, AlertCircle, Navigation2, WifiOff, Satellite } from 'lucide-react';
import { MapboxTrailMap } from '../components/MapboxTrailMap';
import { sendSosAlert, startActivity, updateActivityStatus, type Activity } from '../api/activities';
import { getAccessToken } from '../api/client';

export function RecordingPage() {
  const [activity, setActivity] = useState<Activity | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [routePoints, setRoutePoints] = useState<[number, number][]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const isGuest = !getAccessToken();

  useEffect(() => {
    if (!isGuest) {
      startActivity()
        .then(setActivity)
        .catch((error) => setErrorMessage(error instanceof Error ? error.message : 'Unable to start activity.'));
    }

    navigator.geolocation.getCurrentPosition((position) => {
      setRoutePoints([[position.coords.longitude, position.coords.latitude]]);
    });
  }, [isGuest]);

  const handleTogglePause = async () => {
    const nextPaused = !isPaused;
    setIsPaused(nextPaused);
    if (activity?.id) await updateActivityStatus(activity.id, nextPaused ? 'paused' : 'recording').catch(() => undefined);
  };

  const handleStop = async () => {
    if (!confirm('Stop recording? Your activity will be saved.')) return;
    if (activity?.id) await updateActivityStatus(activity.id, 'completed').catch(() => undefined);
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
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 px-2 py-1 bg-success/10 text-success rounded-lg">
                <Satellite className="w-3 h-3" />
                <span className="text-xs font-medium">GPS</span>
              </div>
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

        <div className="absolute top-4 right-4 z-10">
          <button className="p-3 bg-card border border-border rounded-xl shadow-lg hover:bg-muted/20 transition-colors">
            <Navigation2 className="w-5 h-5 text-primary" />
          </button>
        </div>

        <div className="absolute bottom-4 left-4 right-4 z-10 space-y-3">
          <div className="bg-card rounded-xl border border-border p-6 shadow-xl">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center"><p className="text-3xl font-semibold text-foreground mb-1">Live</p><p className="text-sm text-secondary">Duration</p></div>
              <div className="text-center"><p className="text-3xl font-semibold text-foreground mb-1">{routePoints.length}</p><p className="text-sm text-secondary">Points</p></div>
              <div className="text-center"><p className="text-3xl font-semibold text-foreground mb-1">0</p><p className="text-sm text-secondary">Elevation (m)</p></div>
              <div className="text-center"><p className="text-3xl font-semibold text-foreground mb-1">0.0</p><p className="text-sm text-secondary">Avg Speed</p></div>
              <div className="text-center"><p className="text-3xl font-semibold text-foreground mb-1">0.0</p><p className="text-sm text-secondary">Max Speed</p></div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleTogglePause}
              className={`flex-1 flex items-center justify-center gap-3 px-6 py-4 rounded-xl font-semibold transition-colors ${
                isPaused ? 'bg-success text-success-foreground hover:bg-success/90' : 'bg-accent text-accent-foreground hover:bg-accent/90'
              }`}
            >
              {isPaused ? <Play className="w-6 h-6" /> : <Pause className="w-6 h-6" />}
              <span>{isPaused ? 'Resume' : 'Pause'}</span>
            </button>
            <button onClick={handleStop} className="flex-1 flex items-center justify-center gap-3 px-6 py-4 bg-destructive text-destructive-foreground rounded-xl font-semibold hover:bg-destructive/90 transition-colors">
              <Square className="w-6 h-6" />
              <span>Finish</span>
            </button>
          </div>

          <button onClick={handleSos} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-card border-2 border-destructive/50 text-destructive rounded-xl font-semibold hover:bg-destructive/10 transition-colors">
            <AlertCircle className="w-5 h-5" />
            <span>Emergency SOS</span>
          </button>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Clock, Navigation, TrendingUp } from 'lucide-react';
import { ActivityRow, fetchMyActivities } from '../lib/api';
import { EmptyState, ErrorState, LoadingPanel, PageHeader, PageShell } from '../components/web';
import { useAuth } from '../contexts/AuthContext';

function metersToKm(value: ActivityRow['distance_meters']) {
  return Number(value ?? 0) / 1000;
}

function secondsToDuration(value: ActivityRow['elapsed_time_seconds']) {
  const seconds = Number(value ?? 0);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
}

export function HistoryScreen() {
  const { isAuthenticated } = useAuth();
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(isAuthenticated);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAuthenticated) return;
    let alive = true;
    setLoading(true);
    fetchMyActivities()
      .then((payload) => {
        if (alive) setActivities(payload.data);
      })
      .catch((requestError) => {
        if (alive) setError(requestError instanceof Error ? requestError.message : 'Unable to load activities.');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [isAuthenticated]);

  return (
    <PageShell>
      <PageHeader title="History" description="Your recorded activities." />

      {!isAuthenticated ? (
        <EmptyState
          title="Sign in to view history."
          action={<Link className="btn btn-primary" to="/auth?mode=signin">Sign in</Link>}
        />
      ) : null}

      {isAuthenticated && loading ? <LoadingPanel label="Loading history..." /> : null}
      {isAuthenticated && !loading && error ? <ErrorState message={error} /> : null}
      {isAuthenticated && !loading && !error && activities.length === 0 ? <EmptyState /> : null}

      {isAuthenticated && !loading && !error && activities.length > 0 ? (
        <div className="grid gap-3">
          {activities.map((activity) => {
            const date = new Date(activity.start_time ?? activity.started_at ?? activity.created_at ?? Date.now());
            return (
              <article className="activity-row" key={activity.id}>
                <div className="activity-row__icon">
                  <Navigation size={20} />
                </div>
                <div>
                  <h3>{activity.trail_name || 'Activity'}</h3>
                  <p>{date.toLocaleDateString()}</p>
                  <div className="toolbar mt-2">
                    <span className="cluster text-sm text-muted-foreground"><Navigation size={14} /> {metersToKm(activity.distance_meters).toFixed(2)} km</span>
                    <span className="cluster text-sm text-muted-foreground"><Clock size={14} /> {secondsToDuration(activity.elapsed_time_seconds)}</span>
                    <span className="cluster text-sm text-muted-foreground"><TrendingUp size={14} /> {Math.round(Number(activity.elevation_gain_meters ?? 0))} m</span>
                  </div>
                </div>
                <span className="chip">{activity.status || 'recorded'}</span>
              </article>
            );
          })}
        </div>
      ) : null}
    </PageShell>
  );
}

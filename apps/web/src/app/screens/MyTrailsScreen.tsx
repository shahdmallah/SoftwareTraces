import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import type { Trail } from '../data/trails';
import { fetchMyTrails } from '../lib/api';
import { EmptyState, ErrorState, LoadingPanel, PageHeader, PageShell, TrailCard } from '../components/web';
import { useAuth } from '../contexts/AuthContext';

export function MyTrailsScreen() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [myTrails, setMyTrails] = useState<Trail[]>([]);
  const [loading, setLoading] = useState(isAuthenticated);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAuthenticated) return;
    let alive = true;
    fetchMyTrails()
      .then((items) => {
        if (alive) setMyTrails(items);
      })
      .catch((requestError) => {
        if (alive) setError(requestError instanceof Error ? requestError.message : 'Unable to load your trails.');
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
      <PageHeader title="My trails" description="Trails you created." />
      {!isAuthenticated ? (
        <EmptyState title="Sign in to view your trails." action={<Link className="btn btn-primary" to="/auth?mode=signin">Sign in</Link>} />
      ) : null}
      {isAuthenticated && loading ? <LoadingPanel label="Loading your trails..." /> : null}
      {isAuthenticated && !loading && error ? <ErrorState message={error} /> : null}
      {isAuthenticated && !loading && !error && myTrails.length === 0 ? <EmptyState /> : null}
      {isAuthenticated && !loading && !error && myTrails.length > 0 ? (
        <div className="trail-grid">
          {myTrails.map((trail) => (
            <TrailCard key={trail.id} trail={trail} onClick={() => navigate(`/trail/${trail.id}`)} />
          ))}
        </div>
      ) : null}
    </PageShell>
  );
}

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import type { Trail } from '../data/trails';
import { fetchSavedTrails } from '../lib/api';
import { EmptyState, ErrorState, LoadingPanel, PageHeader, PageShell, TrailCard } from '../components/web';
import { useAuth } from '../contexts/AuthContext';

export function SavedTrailsScreen() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [trails, setTrails] = useState<Trail[]>([]);
  const [loading, setLoading] = useState(isAuthenticated);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAuthenticated) return;
    let alive = true;
    fetchSavedTrails()
      .then((items) => {
        if (alive) setTrails(items);
      })
      .catch((requestError) => {
        if (alive) setError(requestError instanceof Error ? requestError.message : 'Unable to load saved trails.');
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
      <PageHeader title="Saved" description="Your saved trails." />
      {!isAuthenticated ? (
        <EmptyState title="Sign in to view saved trails." action={<Link className="btn btn-primary" to="/auth?mode=signin">Sign in</Link>} />
      ) : null}
      {isAuthenticated && loading ? <LoadingPanel label="Loading saved trails..." /> : null}
      {isAuthenticated && !loading && error ? <ErrorState message={error} /> : null}
      {isAuthenticated && !loading && !error && trails.length === 0 ? <EmptyState /> : null}
      {isAuthenticated && !loading && !error && trails.length > 0 ? (
        <div className="trail-grid">
          {trails.map((trail) => (
            <TrailCard key={trail.id} trail={trail} onClick={() => navigate(`/trail/${trail.id}`)} />
          ))}
        </div>
      ) : null}
    </PageShell>
  );
}

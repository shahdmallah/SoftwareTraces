import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { EmptyState, ErrorState, LoadingPanel, PageHeader, PageShell } from '../components/web';
import { fetchPendingOfflineSync } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

type OfflineItem = {
  id?: string;
  title?: string;
  status?: string;
  updated_at?: string;
};

export function OfflineScreen() {
  const { isAuthenticated } = useAuth();
  const [items, setItems] = useState<OfflineItem[]>([]);
  const [loading, setLoading] = useState(isAuthenticated);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAuthenticated) return;
    let alive = true;
    fetchPendingOfflineSync()
      .then((payload) => {
        if (alive) setItems(Array.isArray(payload.data) ? (payload.data as OfflineItem[]) : []);
      })
      .catch((requestError) => {
        if (alive) setError(requestError instanceof Error ? requestError.message : 'Unable to load offline sync.');
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
      <PageHeader title="Offline sync" description="Pending offline activities." />
      {!isAuthenticated ? (
        <EmptyState title="Sign in to view offline sync." action={<Link className="btn btn-primary" to="/auth?mode=signin">Sign in</Link>} />
      ) : null}
      {isAuthenticated && loading ? <LoadingPanel label="Loading offline sync..." /> : null}
      {isAuthenticated && !loading && error ? <ErrorState message={error} /> : null}
      {isAuthenticated && !loading && !error && items.length === 0 ? <EmptyState /> : null}
      {isAuthenticated && !loading && !error && items.length > 0 ? (
        <div className="grid gap-3">
          {items.map((item, index) => (
            <article className="activity-row" key={item.id ?? index}>
              <div className="activity-row__icon">S</div>
              <div>
                <h3>{item.title || 'Offline item'}</h3>
                {item.updated_at ? <p>{new Date(item.updated_at).toLocaleDateString()}</p> : null}
              </div>
              <span className="chip">{item.status || 'pending'}</span>
            </article>
          ))}
        </div>
      ) : null}
    </PageShell>
  );
}

import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { MessageCircle } from 'lucide-react';
import { EmptyState, ErrorState, LoadingPanel, PageHeader, PageShell } from '../components/web';
import { fetchSocialFeed } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

type FeedItem = {
  id?: string;
  caption?: string;
  trail_name?: string;
  created_at?: string;
};

export function CommunityScreen() {
  const { isAuthenticated } = useAuth();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(isAuthenticated);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAuthenticated) return;
    let alive = true;
    fetchSocialFeed()
      .then((payload) => {
        if (alive) setItems(Array.isArray(payload.data) ? (payload.data as FeedItem[]) : []);
      })
      .catch((requestError) => {
        if (alive) setError(requestError instanceof Error ? requestError.message : 'Unable to load feed.');
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
      <PageHeader title="Community" description="Activity feed." />
      {!isAuthenticated ? (
        <EmptyState title="Sign in to view the feed." action={<Link className="btn btn-primary" to="/auth?mode=signin">Sign in</Link>} />
      ) : null}
      {isAuthenticated && loading ? <LoadingPanel label="Loading feed..." /> : null}
      {isAuthenticated && !loading && error ? <ErrorState message={error} /> : null}
      {isAuthenticated && !loading && !error && items.length === 0 ? <EmptyState /> : null}
      {isAuthenticated && !loading && !error && items.length > 0 ? (
        <div className="grid gap-3">
          {items.map((item, index) => (
            <article className="panel" key={item.id ?? index}>
              <div className="cluster">
                <MessageCircle size={18} color="#7a1215" />
                <strong>{item.trail_name || 'Activity'}</strong>
              </div>
              {item.caption ? <p className="mt-3 text-muted-foreground">{item.caption}</p> : null}
              {item.created_at ? <p className="m-0 mt-3 text-sm text-muted-foreground">{new Date(item.created_at).toLocaleDateString()}</p> : null}
            </article>
          ))}
        </div>
      ) : null}
    </PageShell>
  );
}

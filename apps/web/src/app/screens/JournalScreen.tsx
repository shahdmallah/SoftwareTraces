import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { BookOpen } from 'lucide-react';
import { ActivityRow, fetchJournal } from '../lib/api';
import { EmptyState, ErrorState, LoadingPanel, PageHeader, PageShell } from '../components/web';
import { useAuth } from '../contexts/AuthContext';

export function JournalScreen() {
  const { isAuthenticated } = useAuth();
  const [entries, setEntries] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(isAuthenticated);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAuthenticated) return;
    let alive = true;
    fetchJournal()
      .then((payload) => {
        if (alive) setEntries(payload.data);
      })
      .catch((requestError) => {
        if (alive) setError(requestError instanceof Error ? requestError.message : 'Unable to load journal.');
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
      <PageHeader title="Journal" description="Private activity posts." />
      {!isAuthenticated ? (
        <EmptyState title="Sign in to view your journal." action={<Link className="btn btn-primary" to="/auth?mode=signin">Sign in</Link>} />
      ) : null}
      {isAuthenticated && loading ? <LoadingPanel label="Loading journal..." /> : null}
      {isAuthenticated && !loading && error ? <ErrorState message={error} /> : null}
      {isAuthenticated && !loading && !error && entries.length === 0 ? <EmptyState /> : null}
      {isAuthenticated && !loading && !error && entries.length > 0 ? (
        <div className="grid gap-3">
          {entries.map((entry) => (
            <article className="panel" key={entry.id}>
              <div className="cluster">
                <BookOpen size={18} color="#7a1215" />
                <div>
                  <h2 className="m-0 text-xl font-bold">{entry.trail_name || 'Activity'}</h2>
                  <p className="m-0 text-sm text-muted-foreground">{new Date(entry.created_at ?? Date.now()).toLocaleDateString()}</p>
                </div>
              </div>
              {entry.caption ? <p className="mt-4 text-muted-foreground">{entry.caption}</p> : null}
            </article>
          ))}
        </div>
      ) : null}
    </PageShell>
  );
}

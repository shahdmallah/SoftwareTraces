import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { TrailCard } from '../components/TrailCard';
import { getMyTrails, type Trail } from '../api/trails';
import { getAccessToken } from '../api/client';
import { toTrailCard } from '../utils/trailFormat';

export function MyTrailsPage() {
  const [search, setSearch] = useState('');
  const [trails, setTrails] = useState<Trail[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const isGuest = !getAccessToken();

  useEffect(() => {
    if (isGuest) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setErrorMessage('');

    getMyTrails(1, 100)
      .then((result) => {
        if (!cancelled) {
          setTrails(result.trails);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : 'Unable to load your trails.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isGuest]);

  const filteredTrails = useMemo(
    () => trails.filter((trail) => {
      const query = search.toLowerCase().trim();
      return (
        trail.name.toLowerCase().includes(query) ||
        trail.region.toLowerCase().includes(query) ||
        (trail.nameAr ?? '').toLowerCase().includes(query)
      );
    }),
    [search, trails],
  );

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-6">
          <h1 className="mb-2">My Trails</h1>
          <p className="text-secondary">{filteredTrails.length} published routes</p>
        </div>

        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            aria-label="Search my trails"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search your published trails..."
            className="w-full pl-12 pr-4 py-3 bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {errorMessage && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-6">{errorMessage}</div>
        )}

        {isGuest ? (
          <div className="bg-card rounded-xl border border-border p-12 text-center">
            <h3 className="mb-2">Sign in to view your published trails</h3>
            <p className="text-secondary">Your personal trail library is available once you authenticate.</p>
          </div>
        ) : isLoading ? (
          <div className="bg-card rounded-xl border border-border p-12 text-center text-muted-foreground">Loading trails...</div>
        ) : filteredTrails.length === 0 ? (
          <div className="bg-card rounded-xl border border-border p-12 text-center">
            <h3 className="mb-2">No published trails yet</h3>
            <p className="text-secondary">Create a trail and publish it to see it appear here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTrails.map((trail) => (
              <TrailCard
                key={trail.id}
                {...toTrailCard(trail)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

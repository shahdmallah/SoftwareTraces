import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Search } from 'lucide-react';
import { EmptyState, ErrorState, LoadingPanel, PageHeader, PageShell, TrailCard } from '../components/web';
import { useTrails } from '../hooks/useTrails';
import type { Difficulty } from '../data/trails';

const difficulties: Array<'all' | Difficulty> = ['all', 'Easy', 'Moderate', 'Hard', 'Expert'];

export function ExploreScreen() {
  const navigate = useNavigate();
  const { trails, loading, error } = useTrails();
  const [search, setSearch] = useState('');
  const [difficulty, setDifficulty] = useState<'all' | Difficulty>('all');

  const filtered = useMemo(() => {
    return trails.filter((trail) => {
      const query = search.trim().toLowerCase();
      const matchesSearch =
        !query ||
        trail.name.toLowerCase().includes(query) ||
        trail.region.toLowerCase().includes(query) ||
        trail.features.some((item) => item.toLowerCase().includes(query));
      const matchesDifficulty = difficulty === 'all' || trail.difficulty === difficulty;
      return matchesSearch && matchesDifficulty;
    });
  }, [difficulty, search, trails]);

  return (
    <PageShell>
      <PageHeader
        title="Explore"
        description="Trails from the API."
        actions={
          <div className="search-input">
            <Search size={18} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search trails" />
          </div>
        }
      />

      <section className="panel">
        <div className="toolbar">
          {difficulties.map((item) => (
            <button key={item} className={`chip ${difficulty === item ? 'active' : ''}`} onClick={() => setDifficulty(item)}>
              {item === 'all' ? 'All' : item}
            </button>
          ))}
        </div>
      </section>

      <div className="mt-4">
        {loading ? <LoadingPanel label="Loading trails..." /> : null}
        {!loading && error ? <ErrorState message={error} /> : null}
        {!loading && !error && filtered.length === 0 ? <EmptyState /> : null}
        {!loading && !error && filtered.length > 0 ? (
          <div className="trail-grid">
            {filtered.map((trail) => (
              <TrailCard key={trail.id} trail={trail} onClick={() => navigate(`/trail/${trail.id}`)} />
            ))}
          </div>
        ) : null}
      </div>
    </PageShell>
  );
}

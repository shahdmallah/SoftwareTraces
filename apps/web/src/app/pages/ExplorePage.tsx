import { useEffect, useState } from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';
import { TrailCard } from '../components/TrailCard';
import { FilterChip, FilterChipsContainer } from '../components/FilterChips';
import { RecommendedTrailsSection } from '../components/RecommendedTrailsSection';
import { downloadOfflineMap } from '../api/offline';
import { getAccessToken } from '../api/client';
import {
  getSavedTrails,
  getTrails,
  saveTrail,
  searchTrails,
  unsaveTrail,
  type Trail,
  type TrailDifficulty,
} from '../api/trails';
import { toTrailCard } from '../utils/trailFormat';

const regions = ['All Regions', 'Northern Range', 'Central Hills', 'Coastal Paths', 'Desert Trails', 'Forest Routes', 'River Valleys'];
const difficulties = ['All', 'Easy', 'Moderate', 'Hard'];

export function ExplorePage() {
  const [search, setSearch] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('All Regions');
  const [selectedDifficulty, setSelectedDifficulty] = useState('All');
  const [trails, setTrails] = useState<Trail[]>([]);
  const [savedTrails, setSavedTrails] = useState<Set<string>>(new Set());
  const [downloadedTrails, setDownloadedTrails] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const isGuest = !getAccessToken();

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      setErrorMessage('');
      try {
        const difficulty = selectedDifficulty === 'All' ? 'all' : selectedDifficulty as TrailDifficulty;
        const nextTrails = search.trim() || difficulty !== 'all'
          ? await searchTrails({ q: search.trim() || undefined, difficulty })
          : await getTrails(1, 50);
        if (!cancelled) setTrails(nextTrails);
      } catch (error) {
        if (!cancelled) setErrorMessage(error instanceof Error ? error.message : 'Unable to load trails.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    const timer = window.setTimeout(load, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [search, selectedDifficulty]);

  useEffect(() => {
    if (isGuest) return;

    getSavedTrails()
      .then((items) => setSavedTrails(new Set(items.map((trail) => trail.id))))
      .catch(() => setSavedTrails(new Set()));
  }, [isGuest]);

  const toggleSave = async (id: string) => {
    if (isGuest) {
      setErrorMessage('Sign in to save trails across devices.');
      return;
    }

    const shouldSave = !savedTrails.has(id);
    setSavedTrails((prev) => {
      const next = new Set(prev);
      if (shouldSave) next.add(id);
      else next.delete(id);
      return next;
    });

    try {
      if (shouldSave) await saveTrail(id);
      else await unsaveTrail(id);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to update saved trail.');
    }
  };

  const handleDownload = async (id: string) => {
    if (isGuest) {
      setErrorMessage('Sign in to download offline map packs.');
      return;
    }

    try {
      await downloadOfflineMap(id);
      setDownloadedTrails((prev) => new Set(prev).add(id));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to download offline map.');
    }
  };

  const filtered = trails.filter((trail) => {
    const matchesSearch =
      trail.name.toLowerCase().includes(search.toLowerCase()) ||
      trail.region.toLowerCase().includes(search.toLowerCase()) ||
      (trail.nameAr ?? '').includes(search);
    const matchesRegion = selectedRegion === 'All Regions' || trail.region === selectedRegion;
    return matchesSearch && matchesRegion;
  });

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-6">
          <h1 className="mb-1">Explore Trails</h1>
          <p className="text-muted-foreground">Live backend trails • {filtered.length} trails found</p>
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search trails, regions..."
            className="w-full pl-12 pr-4 py-3 bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div className="flex flex-col gap-3 mb-6">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <FilterChipsContainer>
              {difficulties.map((d) => (
                <FilterChip
                  key={d}
                  label={d}
                  active={selectedDifficulty === d}
                  onClick={() => setSelectedDifficulty(d)}
                />
              ))}
            </FilterChipsContainer>
          </div>
          <div className="overflow-x-auto scrollbar-hide">
            <FilterChipsContainer>
              {regions.map((r) => (
                <FilterChip
                  key={r}
                  label={r}
                  active={selectedRegion === r}
                  onClick={() => setSelectedRegion(r)}
                />
              ))}
            </FilterChipsContainer>
          </div>
        </div>

        {errorMessage && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-6">{errorMessage}</div>
        )}

        <RecommendedTrailsSection />

        {isLoading ? (
          <div className="bg-card rounded-xl border border-border p-12 text-center text-muted-foreground">Loading trails...</div>
        ) : filtered.length === 0 ? (
          <div className="bg-card rounded-xl border border-border p-12 text-center">
            <Search className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="mb-2">No trails found</h3>
            <p className="text-muted-foreground">Try adjusting your filters or search query</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((trail) => (
              <TrailCard
                key={trail.id}
                {...toTrailCard(trail)}
                saved={savedTrails.has(trail.id)}
                downloaded={downloadedTrails.has(trail.id)}
                onSave={() => toggleSave(trail.id)}
                onDownload={() => handleDownload(trail.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

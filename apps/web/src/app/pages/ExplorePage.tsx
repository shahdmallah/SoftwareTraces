import { useEffect, useMemo, useState } from 'react';
import { Search, SlidersHorizontal, ArrowUpDown } from 'lucide-react';
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

const difficulties = ['All', 'Easy', 'Moderate', 'Hard'];
const lengthFilters = [
  { id: 'all', label: 'Any', minLength: undefined, maxLength: undefined },
  { id: 'short', label: 'Short', minLength: undefined, maxLength: 7 },
  { id: 'medium', label: 'Medium', minLength: 7, maxLength: 12 },
  { id: 'long', label: 'Long', minLength: 12, maxLength: undefined },
];
const reviewsFilters = [
  { id: 'all', label: 'All' },
  { id: 'proven', label: 'Proven' },
  { id: 'popular', label: 'Popular' },
  { id: 'legendary', label: 'Legendary' },
];
const featureFilters = [
  { id: 'all', label: 'All' },
  { id: 'water', label: 'Water' },
  { id: 'historical', label: 'Historical' },
  { id: 'olive', label: 'Olive' },
  { id: 'summit', label: 'Summit' },
];

const sortOptions = [
  { id: 'bestMatch', label: 'Best match' },
  { id: 'topRated', label: 'Top rated' },
  { id: 'shortest', label: 'Shortest' },
  { id: 'longest', label: 'Longest' },
  { id: 'mostReviewed', label: 'Most reviewed' },
] as const;

type SortOptionId = (typeof sortOptions)[number]['id'];

function matchesFeatureFilter(trail: Trail, feature: string) {
  if (feature === 'all') return true;
  if (trail.tags?.includes(feature)) return true;
  if (feature === 'water') {
    return trail.features?.some((item) => /spring|river|sea|water/i.test(item));
  }
  return trail.features?.some((item) => item.toLowerCase().includes(feature.toLowerCase()));
}

function matchesReviewsFilter(trail: Trail, filterId: string) {
  if (filterId === 'all') return true;

  if (filterId === 'proven') return trail.reviews >= 10;
  if (filterId === 'popular') return trail.reviews >= 50;
  if (filterId === 'legendary') return trail.reviews >= 200;

  return true;
}

function sortTrails(trails: Trail[], sortBy: SortOptionId) {
  const sorted = [...trails];
  switch (sortBy) {
    case 'topRated':
      return sorted.sort((a, b) => (b.rating === a.rating ? b.reviews - a.reviews : b.rating - a.rating));
    case 'shortest':
      return sorted.sort((a, b) => a.distance - b.distance);
    case 'longest':
      return sorted.sort((a, b) => b.distance - a.distance);
    case 'mostReviewed':
      return sorted.sort((a, b) => (b.reviews === a.reviews ? b.rating - a.rating : b.reviews - a.reviews));
    case 'bestMatch':
    default:
      return sorted.sort((a, b) => {
        const aScore = (a.rating >= 4.5 || a.reviews >= 50 ? 1 : 0);
        const bScore = (b.rating >= 4.5 || b.reviews >= 50 ? 1 : 0);
        if (bScore !== aScore) return bScore - aScore;
        if (b.rating === a.rating) return b.reviews - a.reviews;
        return b.rating - a.rating;
      });
  }
}

export function ExplorePage() {
  const [search, setSearch] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState('All');
  const [selectedLength, setSelectedLength] = useState('all');
  const [selectedReviews, setSelectedReviews] = useState('all');
  const [selectedFeature, setSelectedFeature] = useState('all');
  const [sortBy, setSortBy] = useState<SortOptionId>('bestMatch');
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
        const difficulty = selectedDifficulty === 'All' ? 'all' : (selectedDifficulty as TrailDifficulty);
        const lengthFilter = lengthFilters.find((item) => item.id === selectedLength);

        const nextTrails = search.trim() || difficulty !== 'all' || selectedLength !== 'all'
          ? await searchTrails({
              q: search.trim() || undefined,
              difficulty,
              minLength: lengthFilter?.minLength,
              maxLength: lengthFilter?.maxLength,
            })
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
  }, [search, selectedDifficulty, selectedLength]);

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

  const filtered = useMemo(() => {
    return trails
      .filter((trail) => {
        const normalizedSearch = search.toLowerCase();
        return (
          trail.name.toLowerCase().includes(normalizedSearch) ||
          trail.region.toLowerCase().includes(normalizedSearch) ||
          (trail.nameAr ?? '').toLowerCase().includes(normalizedSearch)
        );
      })
      .filter((trail) => matchesReviewsFilter(trail, selectedReviews))
      .filter((trail) => matchesFeatureFilter(trail, selectedFeature));
  }, [search, selectedReviews, selectedFeature, trails]);

  const sortedTrails = useMemo(() => sortTrails(filtered, sortBy), [filtered, sortBy]);

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-6">
          <h1 className="mb-1">Explore Trails</h1>
          <p className="text-muted-foreground">Browse trails • {sortedTrails.length} results</p>
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search trails..."
            className="w-full pl-12 pr-4 py-3 bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

          <div className="flex items-center justify-end gap-3">
            <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as SortOptionId)}
              className="rounded-full border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              {sortOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
          </div>

        {errorMessage && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-6">{errorMessage}</div>
        )}

        <RecommendedTrailsSection />

        {isLoading ? (
          <div className="bg-card rounded-xl border border-border p-12 text-center text-muted-foreground">Loading trails...</div>
        ) : sortedTrails.length === 0 ? (
          <div className="bg-card rounded-xl border border-border p-12 text-center">
            <Search className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="mb-2">No trails found</h3>
            <p className="text-muted-foreground">Try adjusting your filters or search query.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedTrails.map((trail) => (
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

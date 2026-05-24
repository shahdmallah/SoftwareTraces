import { useEffect, useState } from 'react';
import { Search, Download, BookmarkX } from 'lucide-react';
import { TrailCard } from '../components/TrailCard';
import { FilterChip, FilterChipsContainer } from '../components/FilterChips';
import { downloadOfflineMap } from '../api/offline';
import { getSavedTrails, unsaveTrail, type Trail } from '../api/trails';
import { getAccessToken } from '../api/client';
import { toTrailCard } from '../utils/trailFormat';

export function SavedTrailsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDownloaded, setFilterDownloaded] = useState<'all' | 'downloaded' | 'not-downloaded'>('all');
  const [trails, setTrails] = useState<Trail[]>([]);
  const [downloadedTrails, setDownloadedTrails] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const isGuest = !getAccessToken();

  useEffect(() => {
    if (isGuest) {
      setIsLoading(false);
      return;
    }

    getSavedTrails()
      .then(setTrails)
      .catch((error) => setErrorMessage(error instanceof Error ? error.message : 'Unable to load saved trails.'))
      .finally(() => setIsLoading(false));
  }, [isGuest]);

  const removeSaved = async (id: string) => {
    setTrails((prev) => prev.filter((trail) => trail.id !== id));
    try {
      await unsaveTrail(id);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to remove bookmark.');
    }
  };

  const handleDownload = async (id: string) => {
    try {
      await downloadOfflineMap(id);
      setDownloadedTrails((prev) => new Set(prev).add(id));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to download offline map.');
    }
  };

  const filteredTrails = trails.filter((trail) => {
    const matchesSearch =
      trail.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      trail.region.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (trail.nameAr ?? '').includes(searchQuery);

    const downloaded = downloadedTrails.has(trail.id);
    const matchesDownload =
      filterDownloaded === 'all' ||
      (filterDownloaded === 'downloaded' && downloaded) ||
      (filterDownloaded === 'not-downloaded' && !downloaded);

    return matchesSearch && matchesDownload;
  });

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-6">
          <h1 className="mb-2">Saved Trails</h1>
          <p className="text-secondary">Your backend bookmarks • {filteredTrails.length} trails</p>
        </div>

        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted" />
          <input
            type="text"
            placeholder="Search saved trails..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div className="mb-6">
          <h4 className="text-sm text-secondary mb-2">Filter by Download Status</h4>
          <FilterChipsContainer>
            <FilterChip label="All" active={filterDownloaded === 'all'} onClick={() => setFilterDownloaded('all')} />
            <FilterChip label="Downloaded" icon={<Download className="w-4 h-4" />} active={filterDownloaded === 'downloaded'} onClick={() => setFilterDownloaded('downloaded')} />
            <FilterChip label="Not Downloaded" active={filterDownloaded === 'not-downloaded'} onClick={() => setFilterDownloaded('not-downloaded')} />
          </FilterChipsContainer>
        </div>

        {errorMessage && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-6">{errorMessage}</div>}

        {isLoading ? (
          <div className="bg-card rounded-xl border border-border p-12 text-center text-muted-foreground">Loading saved trails...</div>
        ) : isGuest ? (
          <div className="bg-card rounded-xl border border-border p-12 text-center">
            <BookmarkX className="w-16 h-16 text-muted mx-auto mb-4" />
            <h3 className="mb-2">No saved trails yet</h3>
            <p className="text-secondary">Browse trails freely. Sign in when you want saved trails to sync across devices.</p>
          </div>
        ) : filteredTrails.length === 0 ? (
          <div className="bg-card rounded-xl border border-border p-12 text-center">
            <BookmarkX className="w-16 h-16 text-muted mx-auto mb-4" />
            <h3 className="mb-2">No saved trails</h3>
            <p className="text-secondary">Start exploring and bookmark your favorite trails</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTrails.map((trail) => (
              <TrailCard
                key={trail.id}
                {...toTrailCard(trail)}
                saved
                downloaded={downloadedTrails.has(trail.id)}
                onSave={() => removeSaved(trail.id)}
                onDownload={() => handleDownload(trail.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

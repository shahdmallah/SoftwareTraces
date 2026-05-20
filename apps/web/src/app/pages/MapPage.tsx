import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Link } from 'react-router';
import { ImageWithFallback } from '../components/ImageWithFallback';
import { MapboxTrailMap } from '../components/MapboxTrailMap';
import { getMapBubbles, type MapBubble } from '../api/map';
import { getNearbyTrails, getTrails, type Trail } from '../api/trails';
import { formatDistance, cardDifficulty } from '../utils/trailFormat';

const difficultyColors = {
  easy: '#7A9A3A',
  moderate: '#D4A843',
  hard: '#BB2823',
};

export function MapPage() {
  const [selectedTrail, setSelectedTrail] = useState<Trail | null>(null);
  const [search, setSearch] = useState('');
  const [trails, setTrails] = useState<Trail[]>([]);
  const [bubbles, setBubbles] = useState<MapBubble[]>([]);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let cancelled = false;

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const nextTrails = await getNearbyTrails({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            radius: 80,
          });
          if (!cancelled) setTrails(nextTrails);
        } catch {
          const fallback = await getTrails(1, 50);
          if (!cancelled) setTrails(fallback);
        }
      },
      async () => {
        try {
          const fallback = await getTrails(1, 50);
          if (!cancelled) setTrails(fallback);
        } catch (error) {
          if (!cancelled) setErrorMessage(error instanceof Error ? error.message : 'Unable to load map trails.');
        }
      },
      { enableHighAccuracy: true, timeout: 5000 },
    );

    getMapBubbles({
      ne_lat: 33.8,
      ne_lng: 36.8,
      sw_lat: 29,
      sw_lng: 34,
      zoom: 8,
    })
      .then((items) => { if (!cancelled) setBubbles(items); })
      .catch(() => { if (!cancelled) setBubbles([]); });

    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => trails.filter(
    (trail) =>
      trail.name.toLowerCase().includes(search.toLowerCase()) ||
      trail.region.toLowerCase().includes(search.toLowerCase()) ||
      (trail.nameAr ?? '').includes(search),
  ), [trails, search]);

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-4rem)] bg-background">
      <div className="md:w-80 flex-shrink-0 bg-card border-r border-border flex flex-col order-2 md:order-1 max-h-64 md:max-h-none overflow-hidden">
        <div className="p-4 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search trails on map..."
              className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          {errorMessage && <p className="text-xs text-red-600 mt-2">{errorMessage}</p>}
        </div>

        <div className="flex-1 overflow-y-auto">
          {filtered.map((trail) => {
            const difficulty = cardDifficulty(trail.difficulty);
            return (
              <button
                key={trail.id}
                onClick={() => setSelectedTrail(trail.id === selectedTrail?.id ? null : trail)}
                className={`w-full flex gap-3 p-4 border-b border-border hover:bg-muted/10 transition-colors text-left ${
                  selectedTrail?.id === trail.id ? 'bg-primary/5 border-l-2 border-l-primary' : ''
                }`}
              >
                <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0">
                  <ImageWithFallback src={trail.image} alt={trail.name} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground text-sm truncate">{trail.name}</p>
                  <p className="text-xs text-muted-foreground mb-1">{trail.region}</p>
                  <div className="flex items-center gap-2">
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{ backgroundColor: difficultyColors[difficulty] + '20', color: difficultyColors[difficulty] }}
                    >
                      {trail.difficulty}
                    </span>
                    <span className="text-xs text-muted-foreground">{formatDistance(trail.distance)}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 relative order-1 md:order-2 min-h-64">
        <MapboxTrailMap
          trails={filtered}
          selectedTrailId={selectedTrail?.id}
          routeCoordinates={selectedTrail?.routeCoordinates}
          bubbles={bubbles}
          onSelectTrail={setSelectedTrail}
        />

        {selectedTrail && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-[min(92vw,360px)] bg-card rounded-xl border border-border shadow-lg overflow-hidden">
            <div className="flex gap-3 p-3">
              <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                <ImageWithFallback src={selectedTrail.image} alt={selectedTrail.name} className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-foreground text-sm mb-0.5">{selectedTrail.name}</h4>
                <p className="text-xs text-muted-foreground mb-2">{selectedTrail.region} • {formatDistance(selectedTrail.distance)}</p>
                <Link
                  to={`/trail/${selectedTrail.id}`}
                  className="inline-block px-3 py-1 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors"
                >
                  View Trail
                </Link>
              </div>
            </div>
          </div>
        )}

        <div className="absolute top-4 left-4 bg-card/90 backdrop-blur-sm rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground">
          Palestine Trail Network • {filtered.length} trails • {bubbles.length} photo clusters
        </div>
      </div>
    </div>
  );
}

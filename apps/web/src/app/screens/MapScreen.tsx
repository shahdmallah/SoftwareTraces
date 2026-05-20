import { useState } from 'react';
import { useNavigate } from 'react-router';
import { LocateFixed } from 'lucide-react';
import type { Trail } from '../data/trails';
import { fetchNearbyTrails } from '../lib/api';
import { EmptyState, ErrorState, LoadingPanel, PageHeader, PageShell, TrailCard } from '../components/web';

export function MapScreen() {
  const navigate = useNavigate();
  const [trails, setTrails] = useState<Trail[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [requested, setRequested] = useState(false);

  const loadNearby = () => {
    setRequested(true);
    setError('');

    if (!navigator.geolocation) {
      setError('Location is not available in this browser.');
      return;
    }

    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const items = await fetchNearbyTrails(position.coords.latitude, position.coords.longitude);
          setTrails(items);
        } catch (requestError) {
          setError(requestError instanceof Error ? requestError.message : 'Unable to load nearby trails.');
        } finally {
          setLoading(false);
        }
      },
      () => {
        setLoading(false);
        setError('Location permission was not granted.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <PageShell>
      <PageHeader
        title="Nearby"
        description="Uses your browser location and the nearby trails API."
        actions={
          <button className="btn btn-primary" onClick={loadNearby}>
            <LocateFixed size={18} />
            Find nearby trails
          </button>
        }
      />

      {loading ? <LoadingPanel label="Loading nearby trails..." /> : null}
      {!loading && error ? <ErrorState message={error} /> : null}
      {!loading && !error && requested && trails.length === 0 ? <EmptyState /> : null}
      {!loading && !error && !requested ? <EmptyState title="Location not requested yet." description="Click the button to search nearby trails." /> : null}
      {!loading && !error && trails.length > 0 ? (
        <div className="trail-grid">
          {trails.map((trail) => (
            <TrailCard key={trail.id} trail={trail} onClick={() => navigate(`/trail/${trail.id}`)} />
          ))}
        </div>
      ) : null}
    </PageShell>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ArrowLeft, Heart, Navigation } from 'lucide-react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { EmptyState, ErrorState, LoadingPanel, PageHeader, PageShell, difficultyTone } from '../components/web';
import type { Trail } from '../data/trails';
import { fetchElevationProfile, fetchTrail, fetchTrailReviews, saveTrail, startActivity, type ElevationProfile, type TrailReview } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

export function TrailDetailScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [trail, setTrail] = useState<Trail | null>(null);
  const [reviews, setReviews] = useState<TrailReview[]>([]);
  const [elevation, setElevation] = useState<ElevationProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    let alive = true;
    if (!id) return;
    setLoading(true);
    Promise.all([
      fetchTrail(id),
      fetchTrailReviews(id).catch(() => []),
      fetchElevationProfile(id).catch(() => null),
    ])
      .then(([nextTrail, nextReviews, nextElevation]) => {
        if (!alive) return;
        setTrail(nextTrail);
        setReviews(nextReviews);
        setElevation(nextElevation);
      })
      .catch((requestError) => {
        if (alive) setError(requestError instanceof Error ? requestError.message : 'Unable to load trail.');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [id]);

  const elevationRows = useMemo(() => {
    if (!elevation) return [];
    return elevation.elevations.map((value, index) => ({
      elevation: value,
      distance: Math.round((elevation.distances[index] ?? 0) / 100) / 10,
    }));
  }, [elevation]);

  const handleStart = async () => {
    setActionError('');
    try {
      await startActivity(id);
      navigate('/recording');
    } catch (requestError) {
      setActionError(requestError instanceof Error ? requestError.message : 'Unable to start activity.');
    }
  };

  const handleSave = async () => {
    if (!id) return;
    setActionError('');
    try {
      await saveTrail(id);
    } catch (requestError) {
      setActionError(requestError instanceof Error ? requestError.message : 'Unable to save trail.');
    }
  };

  if (loading) {
    return (
      <div className="app-frame">
        <PageShell>
          <LoadingPanel label="Loading trail..." />
        </PageShell>
      </div>
    );
  }

  if (error || !trail) {
    return (
      <div className="app-frame">
        <PageShell>
          {error ? <ErrorState message={error} /> : <EmptyState />}
        </PageShell>
      </div>
    );
  }

  return (
    <div className="app-frame">
      <PageShell>
        <button className="btn btn-secondary mb-4" onClick={() => navigate(-1)}>
          <ArrowLeft size={18} />
          Back
        </button>

        <PageHeader
          title={trail.name}
          description={trail.region || undefined}
          actions={
            <>
              <button className="btn btn-primary" onClick={handleStart}>
                <Navigation size={18} />
                Start activity
              </button>
              {isAuthenticated ? (
                <button className="btn btn-secondary" onClick={handleSave}>
                  <Heart size={18} />
                  Save
                </button>
              ) : null}
            </>
          }
        />

        {actionError ? <div className="mb-4"><ErrorState message={actionError} /></div> : null}

        <section className="grid-2">
          <div className="panel">
            {trail.image ? <img className="detail-image" src={trail.image} alt={trail.name} /> : <EmptyState title="No image available." />}
          </div>
          <div className="panel detail-facts">
            <span className={`difficulty-pill difficulty-pill--${difficultyTone[trail.difficulty]} static`}>{trail.difficulty}</span>
            <dl>
              <div><dt>Distance</dt><dd>{trail.distance} km</dd></div>
              {trail.duration ? <div><dt>Duration</dt><dd>{trail.duration}</dd></div> : null}
              <div><dt>Elevation gain</dt><dd>{Math.round(trail.elevationGain)} m</dd></div>
              {trail.reviews > 0 ? <div><dt>Rating</dt><dd>{trail.rating.toFixed(1)}</dd></div> : null}
            </dl>
            {trail.description ? <p>{trail.description}</p> : null}
            {trail.features.length > 0 ? (
              <div className="toolbar">
                {trail.features.map((feature) => <span className="chip" key={feature}>{feature}</span>)}
              </div>
            ) : null}
            {trail.hasCheckpoint && trail.checkpointNote ? <div className="alert">{trail.checkpointNote}</div> : null}
          </div>
        </section>

        <section className="panel mt-4">
          <h2>Elevation</h2>
          {elevationRows.length > 0 ? (
            <div className="chart-box">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={elevationRows} margin={{ top: 10, right: 10, bottom: 0, left: -18 }}>
                  <XAxis dataKey="distance" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Area dataKey="elevation" stroke="#7a1215" fill="#7a121522" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState />
          )}
        </section>

        <section className="panel mt-4">
          <h2>Reviews</h2>
          {reviews.length === 0 ? <EmptyState /> : null}
          {reviews.length > 0 ? (
            <div className="grid gap-3">
              {reviews.map((review) => (
                <article className="review-card" key={review.id}>
                  <strong>{review.title || `${review.rating}/5`}</strong>
                  {review.content ? <p>{review.content}</p> : null}
                  {review.created_at ? <span>{new Date(review.created_at).toLocaleDateString()}</span> : null}
                </article>
              ))}
            </div>
          ) : null}
        </section>
      </PageShell>
    </div>
  );
}

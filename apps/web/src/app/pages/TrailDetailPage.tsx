import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router';
import {
  ArrowLeft, MapPin, Clock, TrendingUp, Star, Bookmark, Download,
  Share2, Play, Users, MessageCircle, ChevronRight, Flag,
} from 'lucide-react';
import { ImageWithFallback } from '../components/ImageWithFallback';
import { StatCard } from '../components/StatCard';
import { MapboxTrailMap } from '../components/MapboxTrailMap';
import { downloadOfflineMap } from '../api/offline';
import { getAccessToken } from '../api/client';
import {
  getTrailById,
  getTrailConditions,
  getTrailPhotos,
  getTrailReviews,
  saveTrail,
  unsaveTrail,
  type Trail,
  type TrailCondition,
  type TrailReview,
} from '../api/trails';
import { cardDifficulty, formatDistance, formatElevation } from '../utils/trailFormat';

const difficultyConfig = {
  easy: { label: 'Easy', className: 'bg-green-100 text-green-700' },
  moderate: { label: 'Moderate', className: 'bg-yellow-100 text-yellow-700' },
  hard: { label: 'Hard', className: 'bg-red-100 text-red-700' },
};

function reviewName(review: TrailReview) {
  return review.user?.full_name || review.profile?.full_name || review.full_name || 'Trail friend';
}

export function TrailDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [trail, setTrail] = useState<Trail | null>(null);
  const [reviews, setReviews] = useState<TrailReview[]>([]);
  const [conditions, setConditions] = useState<TrailCondition[]>([]);
  const [photos, setPhotos] = useState<Array<{ id: string; url: string }>>([]);
  const [saved, setSaved] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const isGuest = !getAccessToken();

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      setErrorMessage('');
      try {
        const [nextTrail, nextReviews, nextConditions, nextPhotos] = await Promise.all([
          getTrailById(id),
          getTrailReviews(id).catch(() => []),
          getTrailConditions(id).catch(() => []),
          getTrailPhotos(id).catch(() => []),
        ]);
        if (!cancelled) {
          setTrail(nextTrail);
          setReviews(nextReviews);
          setConditions(nextConditions);
          setPhotos(nextPhotos);
        }
      } catch (error) {
        if (!cancelled) setErrorMessage(error instanceof Error ? error.message : 'Unable to load trail.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const toggleSave = async () => {
    if (!trail) return;
    if (isGuest) {
      setErrorMessage('Sign in to save trails across devices.');
      return;
    }

    const shouldSave = !saved;
    setSaved(shouldSave);
    try {
      if (shouldSave) await saveTrail(trail.id);
      else await unsaveTrail(trail.id);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to update saved trail.');
    }
  };

  const handleDownload = async () => {
    if (!trail) return;
    if (isGuest) {
      setErrorMessage('Sign in to download offline map packs.');
      return;
    }

    try {
      await downloadOfflineMap(trail.id);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to download offline map.');
    }
  };

  if (isLoading) {
    return <div className="min-h-screen bg-background p-8 text-center text-muted-foreground">Loading trail...</div>;
  }

  if (!trail) {
    return (
      <div className="min-h-screen bg-background p-8 text-center">
        <p className="text-red-700 mb-4">{errorMessage || 'Trail not found.'}</p>
        <Link to="/explore" className="text-primary font-medium">Back to Explore</Link>
      </div>
    );
  }

  const difficulty = difficultyConfig[cardDifficulty(trail.difficulty)];
  const gallery = photos.length ? photos.map((photo) => photo.url) : [trail.image, ...(trail.images ?? [])].filter(Boolean);

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-8">
      <div className="relative h-72 md:h-96 overflow-hidden">
        <ImageWithFallback src={trail.image} alt={trail.name} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#2C2418]/65 via-[#630E13]/10 to-transparent" />

        <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
          <Link to="/" className="p-2 bg-white/90 backdrop-blur-sm rounded-full hover:bg-white transition-colors shadow-sm">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </Link>
          <div className="flex items-center gap-2">
            <button className="p-2 bg-white/90 backdrop-blur-sm rounded-full hover:bg-white transition-colors shadow-sm">
              <Share2 className="w-5 h-5 text-foreground" />
            </button>
            <button onClick={toggleSave} className="p-2 bg-white/90 backdrop-blur-sm rounded-full hover:bg-white transition-colors shadow-sm">
              <Bookmark className={`w-5 h-5 ${saved ? 'fill-primary text-primary' : 'text-foreground'}`} />
            </button>
          </div>
        </div>

        <div className="absolute bottom-4 left-4 right-4">
          <div className="flex items-center gap-2 mb-2">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${difficulty.className}`}>{difficulty.label}</span>
            <div className="flex items-center gap-1 text-white">
              <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
              <span className="font-medium">{Number(trail.rating || 0).toFixed(1)}</span>
              <span className="text-white/80">({trail.reviews || reviews.length})</span>
            </div>
          </div>
          <h1 className="text-white mb-1">{trail.name}</h1>
          <div className="flex items-center gap-1 text-white/90">
            <MapPin className="w-4 h-4" />
            <span>{trail.region}</span>
            {trail.nameAr && <span className="mx-1">•</span>}
            {trail.nameAr && <span>{trail.nameAr}</span>}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {errorMessage && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4">{errorMessage}</div>}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={<TrendingUp className="w-4 h-4" />} label="Distance" value={formatDistance(trail.distance)} />
          <StatCard icon={<Clock className="w-4 h-4" />} label="Duration" value={trail.duration || 'Unknown'} />
          <StatCard icon={<TrendingUp className="w-4 h-4" />} label="Elevation" value={formatElevation(trail.elevationGain)} />
          <StatCard icon={<Users className="w-4 h-4" />} label="Reviews" value={trail.reviews || reviews.length} />
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Link to="/recording" className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors">
            <Play className="w-5 h-5" />
            <span>Start Hike</span>
          </Link>
          <button onClick={handleDownload} className="flex-1 flex items-center justify-center gap-2 px-6 py-3 border border-border rounded-xl hover:bg-muted/20 transition-colors">
            <Download className="w-5 h-5" />
            <span>Download Offline</span>
          </button>
        </div>

        <div className="bg-card rounded-xl border border-border p-6">
          <h3 className="mb-3">About this Trail</h3>
          <p className="text-muted-foreground mb-4">{trail.description || 'No description yet.'}</p>
          {trail.descriptionAr && <p className="text-muted-foreground text-sm" dir="rtl">{trail.descriptionAr}</p>}
        </div>

        <div className="bg-card rounded-xl border border-border p-6">
          <h3 className="mb-3">Features</h3>
          <div className="flex flex-wrap gap-2">
            {(trail.features?.length ? trail.features : trail.tags ?? []).map((feature) => (
              <span key={feature} className="px-3 py-1.5 bg-background border border-border rounded-full text-sm text-foreground">
                {feature}
              </span>
            ))}
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-6">
          <h3 className="mb-3">Route Map</h3>
          <div className="aspect-video rounded-lg overflow-hidden">
            <MapboxTrailMap trails={[trail]} selectedTrailId={trail.id} routeCoordinates={trail.routeCoordinates} heightClassName="h-full" />
          </div>
        </div>

        {conditions.length > 0 && (
          <div className="bg-card rounded-xl border border-border p-6">
            <h3 className="mb-3">Trail Conditions</h3>
            <div className="space-y-3">
              {conditions.map((condition) => (
                <div key={condition.id} className="rounded-lg border border-border p-3">
                  <p className="font-medium text-foreground">{condition.condition_type.replace('_', ' ')}</p>
                  <p className="text-sm text-muted-foreground">{condition.description || condition.severity || 'Reported recently'}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {gallery.length > 0 && (
          <div className="bg-card rounded-xl border border-border p-6">
            <h3 className="mb-3">Photos</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {gallery.slice(0, 8).map((url) => (
                <ImageWithFallback key={url} src={url} alt={trail.name} className="aspect-square rounded-lg object-cover" />
              ))}
            </div>
          </div>
        )}

        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-muted-foreground" />
              <h3>Reviews</h3>
            </div>
            <button className="text-sm text-primary font-medium hover:underline">Write a review</button>
          </div>

          <div className="space-y-4">
            {reviews.length === 0 ? (
              <p className="text-sm text-muted-foreground">No reviews yet.</p>
            ) : reviews.slice(0, 5).map((review) => (
              <div key={review.id} className="border-b border-border last:border-0 pb-4 last:pb-0">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-medium text-primary">{reviewName(review).slice(0, 2).toUpperCase()}</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-foreground">{reviewName(review)}</span>
                      <span className="text-xs text-muted-foreground">{new Date(review.created_at).toLocaleDateString()}</span>
                    </div>
                    <div className="flex gap-0.5 mb-2">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className={`w-3.5 h-3.5 ${i < review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`} />
                      ))}
                    </div>
                    <p className="text-sm text-muted-foreground">{review.content}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-3 border border-border rounded-lg hover:bg-muted/10 transition-colors text-sm text-muted-foreground">
            <ChevronRight className="w-4 h-4" />
            <span>Load more reviews</span>
          </button>
        </div>

        <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-destructive transition-colors">
          <Flag className="w-4 h-4" />
          <span>Report an issue</span>
        </button>
      </div>
    </div>
  );
}

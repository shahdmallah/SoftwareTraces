import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router';
import {
  ArrowLeft, MapPin, Clock, TrendingUp, Star, Bookmark, Download,
  Share2, Users, MessageCircle, ChevronRight, Flag, Shield,
} from 'lucide-react';
import { ImageWithFallback } from '../components/ImageWithFallback';
import { StatCard } from '../components/StatCard';
import { MapboxTrailMap } from '../components/MapboxTrailMap';
import { downloadOfflineMap } from '../api/offline';
import { getAccessToken } from '../api/client';
import { getMapBubblePhotos, getMapBubbles } from '../api/map';
import {
  addTrailCondition,
  createTrailReview,
  getTrailById,
  getTrailConditions,
  getTrailPhotos,
  getTrailReviews,
  saveTrail,
  unsaveTrail,
  uploadTrailPhoto,
  type Trail,
  type TrailCondition,
  type TrailPhoto,
  type TrailReview,
} from '../api/trails';
import { getTrailSafety, type TrailSafety } from '../api/safety';
import { getWeatherForecast, type WeatherForecast } from '../api/weather';
import { cardDifficulty, formatDistance, formatElevation } from '../utils/trailFormat';

const difficultyConfig = {
  easy: { label: 'Easy', className: 'bg-green-100 text-green-700' },
  moderate: { label: 'Moderate', className: 'bg-yellow-100 text-yellow-700' },
  hard: { label: 'Hard', className: 'bg-red-100 text-red-700' },
};

function reviewName(review: TrailReview) {
  return review.user?.full_name || review.profile?.full_name || review.full_name || 'Trail friend';
}

const WEST_BANK_LAT_MIN = 29;
const WEST_BANK_LAT_MAX = 33.8;
const WEST_BANK_LNG_MIN = 34;
const WEST_BANK_LNG_MAX = 36.8;

function trailPointToLatLng(point: [number, number]): { lat: number; lng: number } | null {
  const [a, b] = point;

  if (a >= WEST_BANK_LAT_MIN && a <= WEST_BANK_LAT_MAX && b >= WEST_BANK_LNG_MIN && b <= WEST_BANK_LNG_MAX) {
    return { lat: a, lng: b };
  }

  if (a >= WEST_BANK_LNG_MIN && a <= WEST_BANK_LNG_MAX && b >= WEST_BANK_LAT_MIN && b <= WEST_BANK_LAT_MAX) {
    return { lat: b, lng: a };
  }

  if (Math.abs(a) <= 90 && Math.abs(b) <= 180) {
    return { lat: a, lng: b };
  }

  if (Math.abs(b) <= 90 && Math.abs(a) <= 180) {
    return { lat: b, lng: a };
  }

  return null;
}

function getTrailMediaBounds(trail: Trail) {
  const points = [
    ...(Array.isArray(trail.routeCoordinates) ? trail.routeCoordinates : []),
    trail.coordinates,
  ]
    .map(trailPointToLatLng)
    .filter((point): point is { lat: number; lng: number } => Boolean(point));

  if (!points.length) return null;

  const lats = points.map((point) => point.lat);
  const lngs = points.map((point) => point.lng);
  const latPadding = Math.max((Math.max(...lats) - Math.min(...lats)) * 0.08, 0.003);
  const lngPadding = Math.max((Math.max(...lngs) - Math.min(...lngs)) * 0.08, 0.003);

  return {
    ne_lat: Math.min(90, Math.max(...lats) + latPadding),
    ne_lng: Math.min(180, Math.max(...lngs) + lngPadding),
    sw_lat: Math.max(-90, Math.min(...lats) - latPadding),
    sw_lng: Math.max(-180, Math.min(...lngs) - lngPadding),
  };
}

async function getTrailMediaRouteImageUrls(trail: Trail) {
  const bounds = getTrailMediaBounds(trail);
  if (!bounds) return [];

  const bubbles = await getMapBubbles({ ...bounds, zoom: 17 });
  const mediaIds = Array.from(new Set(bubbles.flatMap((bubble) => bubble.media_ids))).slice(0, 100);
  if (!mediaIds.length) return [];

  const mediaPhotos = await getMapBubblePhotos(mediaIds);
  return mediaPhotos
    .map((photo) => photo.url ?? photo.public_url ?? photo.thumbnail_url)
    .filter((url): url is string => Boolean(url));
}

export function TrailDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [trail, setTrail] = useState<Trail | null>(null);
  const [reviews, setReviews] = useState<TrailReview[]>([]);
  const [conditions, setConditions] = useState<TrailCondition[]>([]);
  const [photos, setPhotos] = useState<TrailPhoto[]>([]);
  const [mediaRouteImages, setMediaRouteImages] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewContent, setReviewContent] = useState('');
  const [conditionType, setConditionType] = useState('good');
  const [conditionNote, setConditionNote] = useState('');
  const [trailSafety, setTrailSafety] = useState<TrailSafety | null>(null);
  const [weather, setWeather] = useState<WeatherForecast | null>(null);
  const isGuest = !getAccessToken();

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      setErrorMessage('');
      try {
        const nextTrail = await getTrailById(id);
        const point = trailPointToLatLng(nextTrail.coordinates);
        const [nextReviews, nextConditions, nextPhotos, nextMediaRouteImages, nextSafety, nextWeather] = await Promise.all([
          getTrailReviews(id).catch(() => []),
          getTrailConditions(id).catch(() => []),
          getTrailPhotos(id).catch(() => []),
          getTrailMediaRouteImageUrls(nextTrail).catch(() => []),
          getTrailSafety(id).catch(() => null),
          point
            ? getWeatherForecast({
                lat: point.lat,
                lng: point.lng,
                date: new Date().toISOString().slice(0, 10),
              }).catch(() => null)
            : Promise.resolve(null),
        ]);
        if (!cancelled) {
          setTrail(nextTrail);
          setReviews(nextReviews);
          setConditions(nextConditions);
          setPhotos(nextPhotos);
          setMediaRouteImages(nextMediaRouteImages);
          setTrailSafety(nextSafety);
          setWeather(nextWeather);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : 'Unable to load trail.');
          setMediaRouteImages([]);
        }
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

  const handleSubmitReview = async () => {
    if (!trail || !reviewContent.trim()) return;
    if (isGuest) {
      setErrorMessage('Sign in to write a review.');
      return;
    }

    try {
      const created = await createTrailReview(trail.id, {
        rating: reviewRating,
        content: reviewContent.trim(),
      });
      setReviews((current) => [created, ...current]);
      setReviewContent('');
      setShowReviewForm(false);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to submit review.');
    }
  };

  const handleReportCondition = async () => {
    if (!trail) return;
    if (isGuest) {
      setErrorMessage('Sign in to report trail conditions.');
      return;
    }

    try {
      const created = await addTrailCondition(trail.id, {
        condition_type: conditionType,
        description: conditionNote.trim() || undefined,
      });
      setConditions((current) => [created, ...current]);
      setConditionNote('');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to report condition.');
    }
  };

  const handleUploadPhoto = async (file: File | null) => {
    if (!trail || !file) return;
    if (isGuest) {
      setErrorMessage('Sign in to upload trail photos.');
      return;
    }

    try {
      const uploaded = await uploadTrailPhoto(trail.id, file);
      setPhotos((current) => [{ id: uploaded.id, url: uploaded.url, created_at: new Date().toISOString() }, ...current]);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to upload photo.');
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
  const gallery = [
    ...photos.map((photo) => photo.url),
    ...mediaRouteImages,
    ...(photos.length || mediaRouteImages.length ? [] : [trail.image, ...(trail.images ?? [])]),
  ].filter((url, index, collection): url is string => Boolean(url) && collection.indexOf(url) === index);

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

        {(trailSafety || weather) && (
          <div className="grid md:grid-cols-2 gap-4">
            {trailSafety && (
              <div className="bg-card rounded-xl border border-border p-5">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h3>Trail safety</h3>
                  <Link to="/safety" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                    <Shield className="w-3.5 h-3.5" />
                    Safety Center
                  </Link>
                </div>
                <p className="text-sm text-secondary">
                  Score <strong>{trailSafety.safety_score}</strong> · Risk <strong>{trailSafety.risk_level}</strong>
                  {trailSafety.incident_count_48h > 0 ? ` · ${trailSafety.incident_count_48h} incident(s) in 48h` : ''}
                </p>
                {trailSafety.nearest_settlement && (
                  <p className="text-xs text-secondary mt-1">Nearest settlement: {trailSafety.nearest_settlement.name}</p>
                )}
                {trailSafety.warnings.length > 0 && (
                  <ul className="mt-2 text-sm text-secondary list-disc pl-5">
                    {trailSafety.warnings.slice(0, 3).map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {weather && (
              <div className="bg-card rounded-xl border border-border p-5">
                <h3 className="mb-2">Weather forecast</h3>
                <p className="text-sm text-secondary">
                  {weather.condition} · {weather.temperature_c}°C
                  {weather.precipitation_probability != null ? ` · ${weather.precipitation_probability}% rain` : ''}
                </p>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
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

        <div className="bg-card rounded-xl border border-border p-6">
          <h3 className="mb-3">Trail Conditions</h3>
          {conditions.length > 0 ? (
            <div className="space-y-3 mb-4">
              {conditions.map((condition) => (
                <div key={condition.id} className="rounded-lg border border-border p-3">
                  <p className="font-medium text-foreground">{condition.condition_type.replace('_', ' ')}</p>
                  <p className="text-sm text-muted-foreground">{condition.description || condition.severity || 'Reported recently'}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground mb-4">No recent condition reports.</p>
          )}
          {!isGuest && (
            <div className="grid md:grid-cols-[180px_1fr_auto] gap-2">
              <select value={conditionType} onChange={(event) => setConditionType(event.target.value)} className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
                <option value="good">Good</option>
                <option value="fair">Fair</option>
                <option value="mud">Mud</option>
                <option value="snow">Snow</option>
                <option value="closure">Closure</option>
              </select>
              <input
                value={conditionNote}
                onChange={(event) => setConditionNote(event.target.value)}
                placeholder="Optional notes"
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
              <button type="button" onClick={() => void handleReportCondition()} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm">
                Report
              </button>
            </div>
          )}
        </div>

        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center justify-between mb-3">
            <h3>Photos</h3>
            {!isGuest && (
              <label className="text-sm text-primary font-medium hover:underline cursor-pointer">
                Upload photo
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => void handleUploadPhoto(event.target.files?.[0] ?? null)}
                />
              </label>
            )}
          </div>
          {gallery.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {gallery.slice(0, 8).map((url) => (
                <ImageWithFallback key={url} src={url} alt={trail.name} className="aspect-square rounded-lg object-cover" />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No photos yet.</p>
          )}
        </div>

        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-muted-foreground" />
              <h3>Reviews</h3>
            </div>
            <button type="button" onClick={() => setShowReviewForm((current) => !current)} className="text-sm text-primary font-medium hover:underline">
              {showReviewForm ? 'Cancel' : 'Write a review'}
            </button>
          </div>

          {showReviewForm && !isGuest && (
            <div className="mb-4 rounded-lg border border-border p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-secondary">Rating</span>
                <select value={reviewRating} onChange={(event) => setReviewRating(Number(event.target.value))} className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
                  {[5, 4, 3, 2, 1].map((value) => (
                    <option key={value} value={value}>{value} stars</option>
                  ))}
                </select>
              </div>
              <textarea
                value={reviewContent}
                onChange={(event) => setReviewContent(event.target.value)}
                placeholder="Share your experience on this trail"
                className="w-full min-h-24 rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
              <button type="button" onClick={() => void handleSubmitReview()} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm">
                Submit review
              </button>
            </div>
          )}

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
                    {review.photos?.length ? (
                      <div className="mt-3 grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {review.photos.filter((photo) => photo.url).slice(0, 4).map((photo) => (
                          <ImageWithFallback
                            key={photo.id}
                            src={photo.url}
                            alt={`${reviewName(review)} review photo`}
                            className="aspect-square rounded-lg object-cover"
                          />
                        ))}
                      </div>
                    ) : null}
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

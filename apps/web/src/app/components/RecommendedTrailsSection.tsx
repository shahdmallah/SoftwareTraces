import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { AlertCircle, MapPin, Route, ShieldCheck, Star } from 'lucide-react';
import { getAccessToken } from '../api/client';
import { getTrailRecommendations, type TrailRecommendation } from '../api/recommendations';
import { ImageWithFallback } from './ImageWithFallback';
import { Badge } from './ui/badge';
import { Skeleton } from './ui/skeleton';

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1511497584788-876760111969?w=900&auto=format&fit=crop';

function formatDifficulty(difficulty?: string | null) {
  if (!difficulty) return 'Trail';
  return difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
}

function formatRiskLevel(riskLevel?: string | null) {
  return riskLevel ? riskLevel.replace(/_/g, ' ') : '';
}

function riskClassName(riskLevel?: string | null) {
  switch (riskLevel) {
    case 'safe':
      return 'bg-green-50 text-green-700 border-green-200';
    case 'caution':
      return 'bg-yellow-50 text-yellow-700 border-yellow-200';
    case 'dangerous':
    case 'avoid':
      return 'bg-red-50 text-red-700 border-red-200';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
}

function RecommendationSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <Skeleton className="h-32 w-full rounded-none" />
      <div className="p-4 space-y-3">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <div className="grid grid-cols-3 gap-2">
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
        </div>
        <Skeleton className="h-12 w-full" />
      </div>
    </div>
  );
}

function RecommendationCard({ recommendation }: { recommendation: TrailRecommendation }) {
  const riskLabel = formatRiskLevel(recommendation.risk_level);
  const safetyAvailable = recommendation.safety_score !== null && recommendation.safety_score !== undefined;

  return (
    <Link
      to={`/trail/${recommendation.trail_id}`}
      className="group rounded-xl border border-border bg-card overflow-hidden hover:shadow-md transition-shadow"
    >
      <div className="relative h-32 overflow-hidden">
        <ImageWithFallback
          src={recommendation.image || FALLBACK_IMAGE}
          alt={recommendation.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
        <div className="absolute left-3 top-3">
          <span className="inline-flex items-center rounded-full border border-white/50 bg-white/90 px-2.5 py-1 text-xs font-medium text-foreground shadow-sm">
            {recommendation.score}% match
          </span>
        </div>
      </div>

      <div className="p-4">
        <div className="mb-3">
          <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2">
            {recommendation.name}
          </h3>
          <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" />
            <span>{recommendation.region || 'Unspecified region'}</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="rounded-lg bg-background p-2 text-center">
            <Route className="mx-auto mb-1 h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-xs font-medium text-foreground">{Number(recommendation.length_km || 0).toFixed(1)} km</p>
          </div>
          <div className="rounded-lg bg-background p-2 text-center">
            <Star className="mx-auto mb-1 h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
            <p className="text-xs font-medium text-foreground">{Number(recommendation.rating || 0).toFixed(1)}</p>
          </div>
          <div className="rounded-lg bg-background p-2 text-center">
            <ShieldCheck className="mx-auto mb-1 h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-xs font-medium text-foreground">{safetyAvailable ? recommendation.safety_score : 'N/A'}</p>
          </div>
        </div>

        <div className="mb-3 flex flex-wrap gap-2">
          <Badge variant="outline">{formatDifficulty(recommendation.difficulty)}</Badge>
          {riskLabel && (
            <Badge variant="outline" className={riskClassName(recommendation.risk_level)}>
              {riskLabel}
            </Badge>
          )}
        </div>

        <p className="mb-3 text-sm leading-relaxed text-muted-foreground line-clamp-3">
          {recommendation.reason || 'Recommended for your hiking profile.'}
        </p>

        {recommendation.match_tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {recommendation.match_tags.slice(0, 4).map((tag) => (
              <span key={tag} className="rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}

export function RecommendedTrailsSection() {
  const isAuthenticated = Boolean(getAccessToken());
  const [recommendations, setRecommendations] = useState<TrailRecommendation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      setRecommendations([]);
      setIsLoading(false);
      setFailed(false);
      return;
    }

    let cancelled = false;

    const loadRecommendations = async () => {
      setIsLoading(true);
      setFailed(false);

      try {
        const nextRecommendations = await getTrailRecommendations();
        if (!cancelled) setRecommendations(nextRecommendations);
      } catch {
        if (!cancelled) {
          setRecommendations([]);
          setFailed(true);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void loadRecommendations();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  const visibleRecommendations = useMemo(() => recommendations.slice(0, 6), [recommendations]);

  if (!isAuthenticated) {
    return null;
  }

  return (
    <section className="mb-8">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Recommended for You</h2>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <RecommendationSkeleton key={item} />
          ))}
        </div>
      ) : failed ? (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-muted-foreground">
          <AlertCircle className="h-5 w-5 text-primary" />
          <span>Couldn&apos;t load recommendations right now.</span>
        </div>
      ) : visibleRecommendations.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-5 text-muted-foreground">
          Start saving or completing trails to get better recommendations.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleRecommendations.map((recommendation) => (
            <RecommendationCard key={recommendation.trail_id} recommendation={recommendation} />
          ))}
        </div>
      )}
    </section>
  );
}

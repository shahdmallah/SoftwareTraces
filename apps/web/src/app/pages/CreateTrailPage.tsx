import { useState } from 'react';
import { ArrowLeft, Save, Send, MapPin, Image as ImageIcon, RotateCcw, Sparkles } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { MapboxTrailMap } from '../components/MapboxTrailMap';
import { createTrail, getNearbyTrails, getTrailStats, searchOrGenerateTrail, type Trail } from '../api/trails';
import { getAccessToken } from '../api/client';
import { translateTrailContentToArabic } from '../utils/translateTrailContent';

const DUPLICATE_LOOKUP_RADIUS_METERS = 160;
const DUPLICATE_ENDPOINT_THRESHOLD_METERS = 45;
const DUPLICATE_LENGTH_TOLERANCE_METERS = 120;
const DUPLICATE_LENGTH_TOLERANCE_RATIO = 0.04;

function getDistanceMeters(left: [number, number], right: [number, number]) {
  const earthRadiusMeters = 6371000;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const [leftLng, leftLat] = left;
  const [rightLng, rightLat] = right;
  const deltaLat = toRadians(rightLat - leftLat);
  const deltaLng = toRadians(rightLng - leftLng);
  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(toRadians(leftLat)) *
      Math.cos(toRadians(rightLat)) *
      Math.sin(deltaLng / 2) *
      Math.sin(deltaLng / 2);

  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getPathDistanceMeters(points: [number, number][]) {
  return points.reduce((sum, point, index) => (index === 0 ? sum : sum + getDistanceMeters(points[index - 1], point)), 0);
}

function normalizeTrailName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function hasSimilarEndpoints(candidate: [number, number][], existing: [number, number][]) {
  const candidateStart = candidate[0];
  const candidateEnd = candidate[candidate.length - 1];
  const existingStart = existing[0];
  const existingEnd = existing[existing.length - 1];

  if (!candidateStart || !candidateEnd || !existingStart || !existingEnd) return false;

  const sameDirection =
    getDistanceMeters(candidateStart, existingStart) <= DUPLICATE_ENDPOINT_THRESHOLD_METERS &&
    getDistanceMeters(candidateEnd, existingEnd) <= DUPLICATE_ENDPOINT_THRESHOLD_METERS;
  const reverseDirection =
    getDistanceMeters(candidateStart, existingEnd) <= DUPLICATE_ENDPOINT_THRESHOLD_METERS &&
    getDistanceMeters(candidateEnd, existingStart) <= DUPLICATE_ENDPOINT_THRESHOLD_METERS;

  return sameDirection || reverseDirection;
}

function isSimilarLength(leftMeters: number, rightMeters: number) {
  const tolerance = Math.max(DUPLICATE_LENGTH_TOLERANCE_METERS, Math.max(leftMeters, rightMeters) * DUPLICATE_LENGTH_TOLERANCE_RATIO);
  return Math.abs(leftMeters - rightMeters) <= tolerance;
}

function isPotentialDuplicateTrail(candidateName: string, candidateRoute: [number, number][], candidateLengthMeters: number, existingTrail: Trail) {
  const existingRoute = existingTrail.routeCoordinates;
  if (!existingRoute || existingRoute.length < 2 || candidateRoute.length < 2) return false;

  const sameName = normalizeTrailName(candidateName) === normalizeTrailName(existingTrail.name);
  const existingLengthMeters = existingTrail.distance > 0 ? existingTrail.distance * 1000 : getPathDistanceMeters(existingRoute);

  return hasSimilarEndpoints(candidateRoute, existingRoute) && (sameName || isSimilarLength(candidateLengthMeters, existingLengthMeters));
}

export function CreateTrailPage() {
  const navigate = useNavigate();
  const [trailName, setTrailName] = useState('');
  const [description, setDescription] = useState('');
  const [region, setRegion] = useState('');
  const [features, setFeatures] = useState<string[]>([]);
  const [trailPrompt, setTrailPrompt] = useState('');
  const [isGeneratingTrail, setIsGeneratingTrail] = useState(false);
  const [generatedMessage, setGeneratedMessage] = useState('');
  const [routePoints, setRoutePoints] = useState<[number, number][]>([
    [35.235, 31.776],
    [35.255, 31.785],
  ]);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const isGuest = !getAccessToken();

  const handleGenerateTrail = async () => {
    const prompt = trailPrompt.trim();
    if (!prompt) {
      setErrorMessage('Describe the trail you want to generate.');
      return;
    }

    setIsGeneratingTrail(true);
    setErrorMessage('');
    setGeneratedMessage('');
    try {
      const result = await searchOrGenerateTrail(prompt);
      const generatedTrail = result.generated_trail;

      if (!generatedTrail || generatedTrail.coordinates.length < 2) {
        const firstExistingTrail = result.existing_trails[0];
        setGeneratedMessage(
          firstExistingTrail
            ? `Found an existing match: ${firstExistingTrail.name}. Adjust the description to generate a new draft.`
            : 'No generated route came back. Try adding a region, distance, or difficulty.',
        );
        return;
      }

      setRoutePoints(generatedTrail.coordinates);
      setTrailName(generatedTrail.name_suggestion || result.parsed.name_suggestion || 'Suggested Trail');
      setDescription(generatedTrail.description_suggestion || result.parsed.description_suggestion || prompt);
      setRegion(result.parsed.region || '');
      setFeatures(Array.from(new Set((generatedTrail.labels.length ? generatedTrail.labels : result.parsed.labels).filter(Boolean))));
      setGeneratedMessage('Generated a route draft from your description. Review the map and details before creating it.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to generate a trail from that description.');
    } finally {
      setIsGeneratingTrail(false);
    }
  };

  const handleSubmit = async () => {
    if (isGuest) {
      setErrorMessage('Sign in to create and publish trails. You can still use this page to sketch a route.');
      return;
    }

    if (!trailName.trim()) {
      setErrorMessage('Trail name is required.');
      return;
    }
    if (routePoints.length < 2) {
      setErrorMessage('Add at least two route points on the map.');
      return;
    }

    setIsSaving(true);
    setErrorMessage('');
    try {
      const stats = await getTrailStats(routePoints);
      const start = routePoints[0];
      const nearbyTrails = start
        ? await getNearbyTrails({ lat: start[1], lng: start[0], radius: DUPLICATE_LOOKUP_RADIUS_METERS }).catch(() => [])
        : [];
      const duplicateTrail = nearbyTrails.find((trail) =>
        isPotentialDuplicateTrail(trailName.trim(), routePoints, stats.length_meters, trail),
      );

      if (duplicateTrail) {
        const shouldCreateAnyway = window.confirm(
          `"${duplicateTrail.name}" already starts near this route and looks very similar.\n\nCreate this trail anyway?`,
        );
        if (!shouldCreateAnyway) {
          return;
        }
      }

      const translatedTrail = await translateTrailContentToArabic({
        name: trailName.trim(),
        description: description.trim() || undefined,
        region: region.trim() || undefined,
        features,
      });
      const trail = await createTrail({
        name: trailName.trim(),
        nameAr: translatedTrail.nameAr,
        description: description.trim(),
        descriptionAr: translatedTrail.descriptionAr,
        region: region.trim() || undefined,
        regionAr: translatedTrail.regionAr,
        features,
        featuresAr: translatedTrail.featuresAr,
        tags: features,
        coordinates: routePoints,
        stats,
      });
      navigate(`/trail/${trail.id}`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to create trail.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-8">
      <div className="bg-card border-b border-border sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link to="/" className="p-2 hover:bg-muted/20 rounded-lg transition-colors">
                <ArrowLeft className="w-5 h-5 text-secondary" />
              </Link>
              <div>
                <h2 className="font-semibold text-foreground">Create New Trail</h2>
                <p className="text-sm text-secondary">Click the map to define the route</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setRoutePoints([])}
                className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg hover:bg-muted/20 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                <span className="hidden sm:inline">Clear</span>
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSaving || !trailName}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                <span className="hidden sm:inline">{isSaving ? 'Publishing...' : 'Create'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {errorMessage && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4">{errorMessage}</div>}

        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-primary" />
            <h3>Generate from Description</h3>
          </div>
          <div className="space-y-3">
            <textarea
              value={trailPrompt}
              onChange={(event) => setTrailPrompt(event.target.value)}
              placeholder="e.g., easy 5km loop near Ramallah with views and a shaded picnic stop"
              rows={3}
              className="w-full px-4 py-3 bg-input-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
            />
            <button
              type="button"
              onClick={handleGenerateTrail}
              disabled={isGeneratingTrail || !trailPrompt.trim()}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              <span>{isGeneratingTrail ? 'Generating...' : 'Generate Route'}</span>
            </button>
            {generatedMessage && <p className="text-sm text-secondary">{generatedMessage}</p>}
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-6">
          <h3 className="mb-4">Basic Information</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-secondary mb-2">Trail Name *</label>
              <input
                type="text"
                value={trailName}
                onChange={(e) => setTrailName(e.target.value)}
                placeholder="e.g., Canyon Ridge Trail"
                className="w-full px-4 py-3 bg-input-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label className="block text-sm text-secondary mb-2">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the trail, highlights, and safety notes..."
                rows={4}
                className="w-full px-4 py-3 bg-input-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
              />
            </div>
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-6">
          <h3 className="mb-4">Trail Photo</h3>
          <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
            <ImageIcon className="w-12 h-12 text-muted mx-auto mb-3" />
            <p className="text-secondary mb-2">Photo upload is available after the trail is created.</p>
            <p className="text-sm text-muted">Use the trail detail media tools after publishing.</p>
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center justify-between mb-4">
            <h3>Route Map</h3>
            <div className="flex items-center gap-2 text-sm text-secondary">
              <MapPin className="w-4 h-4" />
              <span>{routePoints.length} points</span>
            </div>
          </div>
          <div className="aspect-video rounded-lg overflow-hidden border border-border">
            <MapboxTrailMap
              routeCoordinates={routePoints}
              heightClassName="h-full"
              onMapClick={(point) => setRoutePoints((prev) => [...prev, point])}
            />
          </div>
          <p className="text-sm text-muted mt-3">Click the map to add route points. The backend calculates distance, elevation, duration, and difficulty before creation.</p>
        </div>

        <div className="bg-accent/10 border border-accent/20 rounded-lg p-4">
          <p className="text-sm text-secondary">
            <strong className="text-foreground">Trail Guidelines:</strong> Ensure your trail description is accurate, includes safety information, and respects local communities and the environment.
          </p>
        </div>

        <button
          onClick={handleSubmit}
          disabled={isSaving || !trailName}
          className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          <Save className="w-5 h-5" />
          <span>{isSaving ? 'Creating trail...' : 'Create Trail'}</span>
        </button>
      </div>
    </div>
  );
}

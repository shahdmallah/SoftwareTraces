import { useState } from 'react';
import { ArrowLeft, Save, Send, MapPin, Image as ImageIcon, RotateCcw } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { FilterChip, FilterChipsContainer } from '../components/FilterChips';
import { MapboxTrailMap } from '../components/MapboxTrailMap';
import { createTrail, getTrailStats } from '../api/trails';

export function CreateTrailPage() {
  const navigate = useNavigate();
  const [trailName, setTrailName] = useState('');
  const [description, setDescription] = useState('');
  const [features, setFeatures] = useState<string[]>([]);
  const [routePoints, setRoutePoints] = useState<[number, number][]>([
    [35.235, 31.776],
    [35.255, 31.785],
  ]);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const toggleFeature = (feature: string) => {
    setFeatures((prev) => prev.includes(feature) ? prev.filter((f) => f !== feature) : [...prev, feature]);
  };

  const handleSubmit = async () => {
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
      const trail = await createTrail({
        name: trailName.trim(),
        description: description.trim(),
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
          <h3 className="mb-4">Basic Information</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-secondary mb-2">Trail Name *</label>
              <input
                type="text"
                value={trailName}
                onChange={(e) => setTrailName(e.target.value)}
                placeholder="e.g., Wadi Qelt Canyon Trail"
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
            <div>
              <label className="block text-sm text-secondary mb-2">Trail Features</label>
              <FilterChipsContainer>
                {['Water', 'Historical', 'Olive Groves', 'Summit', 'Wildlife', 'Canyon'].map((feature) => (
                  <FilterChip key={feature} label={feature} active={features.includes(feature)} onClick={() => toggleFeature(feature)} />
                ))}
              </FilterChipsContainer>
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

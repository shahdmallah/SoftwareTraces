import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Edit, Save, Send, Trash2, FileText, CheckCircle } from 'lucide-react';
import { Link } from 'react-router';
import { StatCard } from '../components/StatCard';
import { ImageWithFallback } from '../components/ImageWithFallback';
import { deleteTrail, getMyTrailDrafts, getTrailById, publishTrail, updateTrail, type Trail } from '../api/trails';
import { getAccessToken } from '../api/client';
import { cardDifficulty, formatDistance } from '../utils/trailFormat';

export function TrailDraftsPage() {
  const [drafts, setDrafts] = useState<Trail[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [trackId, setTrackId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const isGuest = !getAccessToken();

  const loadDrafts = async () => {
    if (isGuest) {
      setDrafts([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    try {
      setDrafts(await getMyTrailDrafts());
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to load drafts.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadDrafts();
  }, [isGuest]);

  const handleTrack = async () => {
    if (!trackId.trim()) return;
    try {
      const trail = await getTrailById(trackId.trim());
      setDrafts((prev) => [trail, ...prev.filter((item) => item.id !== trail.id)]);
      setTrackId('');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to find that trail.');
    }
  };

  const handleEdit = (draft: Trail) => {
    setEditingId(draft.id);
    setEditName(draft.name);
    setEditDescription(draft.description ?? '');
  };

  const handleSave = async (id: string) => {
    try {
      await updateTrail(id, { name: editName, description: editDescription });
      setDrafts((prev) => prev.map((draft) => draft.id === id ? { ...draft, name: editName, description: editDescription } : draft));
      setEditingId(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to save draft.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this draft?')) return;
    setDrafts((prev) => prev.filter((draft) => draft.id !== id));
    try {
      await deleteTrail(id);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to delete draft.');
    }
  };

  const handlePublish = async (id: string) => {
    if (!confirm('Publish this trail? It will be visible to all users.')) return;
    try {
      await publishTrail(id);
      setDrafts((prev) => prev.filter((draft) => draft.id !== id));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to publish draft.');
    }
  };

  const totals = useMemo(() => ({
    ready: drafts.filter((draft) => draft.name && draft.description).length,
    distance: drafts.reduce((sum, draft) => sum + Number(draft.distance || 0), 0),
  }), [drafts]);

  const difficultyColors = {
    easy: 'bg-success/10 text-success-foreground border-success/30',
    moderate: 'bg-accent/20 text-accent-foreground border-accent/30',
    hard: 'bg-destructive/10 text-destructive-foreground border-destructive/30',
  };

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="mb-2">Trail Drafts</h1>
            <p className="text-secondary">Your trail drafts</p>
          </div>
          <Link to="/create" className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
            New Trail
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <StatCard icon={<FileText className="w-4 h-4" />} label="Total Drafts" value={drafts.length} />
          <StatCard icon={<CheckCircle className="w-4 h-4" />} label="Ready to Publish" value={totals.ready} variant="success" />
          <StatCard icon={<RefreshCw className="w-4 h-4" />} label="Total Distance" value={totals.distance.toFixed(1)} unit="km" />
        </div>

        <div className="bg-card rounded-xl border border-border p-4 mb-6">
          <label className="block text-sm text-secondary mb-2">Track Draft by ID</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={trackId}
              onChange={(e) => setTrackId(e.target.value)}
              placeholder="Enter draft ID..."
              className="flex-1 px-4 py-2 bg-input-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <button onClick={handleTrack} className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
              Track
            </button>
          </div>
        </div>

        {errorMessage && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-6">{errorMessage}</div>}

        {isLoading ? (
          <div className="bg-card rounded-xl border border-border p-12 text-center text-muted-foreground">Loading drafts...</div>
        ) : isGuest ? (
          <div className="bg-card rounded-xl border border-border p-12 text-center">
            <FileText className="w-16 h-16 text-muted mx-auto mb-4" />
            <h3 className="mb-2">Drafts are available after sign-in</h3>
            <p className="text-secondary mb-6">You can still browse trails and use the map without an account.</p>
            <Link to="/explore" className="inline-block px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
              Explore Trails
            </Link>
          </div>
        ) : drafts.length === 0 ? (
          <div className="bg-card rounded-xl border border-border p-12 text-center">
            <FileText className="w-16 h-16 text-muted mx-auto mb-4" />
            <h3 className="mb-2">No drafts yet</h3>
            <p className="text-secondary mb-6">Start creating a new trail to see it here</p>
            <Link to="/create" className="inline-block px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
              Create Your First Trail
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {drafts.map((draft) => {
              const isEditing = editingId === draft.id;
              const difficulty = cardDifficulty(draft.difficulty);
              const isReady = Boolean(draft.name && draft.description);

              return (
                <div key={draft.id} className="bg-card rounded-xl border border-border overflow-hidden hover:shadow-md transition-shadow">
                  <div className="flex flex-col md:flex-row gap-4 p-4">
                    <div className="w-full md:w-48 h-32 rounded-lg overflow-hidden flex-shrink-0">
                      <ImageWithFallback src={draft.image} alt={draft.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      {isEditing ? (
                        <div className="space-y-3">
                          <input value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full px-3 py-2 bg-input-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" />
                          <textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={2} className="w-full px-3 py-2 bg-input-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none" />
                        </div>
                      ) : (
                        <>
                          <h3 className="font-semibold text-foreground mb-2">{draft.name || 'Untitled trail'}</h3>
                          <p className="text-sm text-secondary mb-3">{draft.description || 'No description yet.'}</p>
                        </>
                      )}

                      <div className="flex flex-wrap items-center gap-2 mb-4">
                        <span className="text-sm text-secondary">{formatDistance(draft.distance)}</span>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${difficultyColors[difficulty]}`}>{draft.difficulty}</span>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${isReady ? 'bg-success/10 text-success-foreground border-success/30' : 'bg-muted/20 text-muted border-border'}`}>
                          {isReady ? 'Ready' : 'Incomplete'}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {isEditing ? (
                          <>
                            <button
                              onClick={() => handleSave(draft.id)}
                              className="flex items-center gap-2 px-4 py-2 bg-success text-success-foreground rounded-lg hover:bg-success/90 transition-colors"
                            >
                              <Save className="w-4 h-4" />
                              <span>Save</span>
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="px-4 py-2 border border-border rounded-lg hover:bg-muted/20 transition-colors"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => handleEdit(draft)}
                              className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg hover:bg-muted/20 transition-colors"
                            >
                              <Edit className="w-4 h-4" />
                              <span>Edit</span>
                            </button>
                            {isReady && (
                              <button
                                onClick={() => handlePublish(draft.id)}
                                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                              >
                                <Send className="w-4 h-4" />
                                <span>Publish</span>
                              </button>
                            )}
                            <button
                              onClick={() => handleDelete(draft.id)}
                              className="flex items-center gap-2 px-4 py-2 border border-destructive/30 text-destructive rounded-lg hover:bg-destructive/10 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                              <span>Delete</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-6 flex justify-center">
          <button onClick={loadDrafts} className="flex items-center gap-2 px-4 py-2 text-secondary hover:text-primary transition-colors">
            <RefreshCw className="w-4 h-4" />
            <span>Refresh Drafts</span>
          </button>
        </div>
      </div>
    </div>
  );
}

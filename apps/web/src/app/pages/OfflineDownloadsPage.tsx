import { useEffect, useState } from 'react';
import { Download, Trash2, HardDrive, MapPin } from 'lucide-react';
import { ImageWithFallback } from '../components/ImageWithFallback';
import { getSavedTrails, type Trail } from '../api/trails';
import { downloadOfflineMap } from '../api/offline';
import { getAccessToken } from '../api/client';

export function OfflineDownloadsPage() {
  const [downloads, setDownloads] = useState<Trail[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const isGuest = !getAccessToken();

  useEffect(() => {
    if (isGuest) return;

    getSavedTrails()
      .then(setDownloads)
      .catch((error) => setErrorMessage(error instanceof Error ? error.message : 'Unable to load downloadable trails.'));
  }, [isGuest]);

  const handleDownload = async (trail: Trail) => {
    try {
      await downloadOfflineMap(trail.id);
      setDownloads((prev) => [trail, ...prev.filter((item) => item.id !== trail.id)]);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to download offline map.');
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Delete this offline map? You can download it again later.')) {
      setDownloads((prev) => prev.filter((d) => d.id !== id));
    }
  };

  const totalSizeMB = (downloads.length * 24.5).toFixed(1);

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-6">
          <h1 className="mb-2">Offline Downloads</h1>
          <p className="text-secondary">Offline map requests use /api/offline/maps/:trailId</p>
        </div>

        {errorMessage && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-6">{errorMessage}</div>}

        <div className="bg-card rounded-xl border border-border p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <HardDrive className="w-5 h-5 text-secondary" />
              <h3>Storage Usage</h3>
            </div>
            <span className="text-sm text-secondary">{totalSizeMB} MB / 500 MB</span>
          </div>
          <div className="h-3 bg-muted/20 rounded-full overflow-hidden mb-2">
            <div className="h-full bg-gradient-to-r from-primary to-success rounded-full transition-all" style={{ width: `${Math.min(100, (downloads.length * 24.5 / 500) * 100)}%` }} />
          </div>
          <p className="text-sm text-muted">{downloads.length} trail maps available/downloaded</p>
        </div>

        {downloads.length === 0 ? (
          <div className="bg-card rounded-xl border border-border p-12 text-center">
            <Download className="w-16 h-16 text-muted mx-auto mb-4" />
            <h3 className="mb-2">No offline maps</h3>
            <p className="text-secondary mb-2">
              {isGuest ? 'Browse trails freely. Sign in when you want offline map packs synced to your account.' : 'Save trails first, then download their map packs here.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4 mb-6">
            {downloads.map((trail) => (
              <div key={trail.id} className="bg-card rounded-xl border border-border overflow-hidden hover:shadow-md transition-shadow">
                <div className="flex gap-4 p-4">
                  <div className="w-24 h-24 rounded-lg overflow-hidden flex-shrink-0">
                    <ImageWithFallback src={trail.image} alt={trail.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground mb-1">{trail.name}</h3>
                    {trail.nameAr && <p className="text-sm text-secondary mb-2">{trail.nameAr}</p>}
                    <div className="flex items-center gap-4 text-sm text-muted mb-3">
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />
                        <span>{trail.region}</span>
                      </div>
                      <span>•</span>
                      <span>~24.5 MB</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleDownload(trail)} className="flex items-center gap-1.5 px-3 py-1.5 bg-success/10 text-success-foreground rounded-lg text-sm">
                        <Download className="w-3.5 h-3.5" />
                        <span>Download/Refresh</span>
                      </button>
                      <button onClick={() => handleDelete(trail.id)} className="flex items-center gap-1.5 px-3 py-1.5 border border-destructive/30 text-destructive rounded-lg text-sm hover:bg-destructive/10 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

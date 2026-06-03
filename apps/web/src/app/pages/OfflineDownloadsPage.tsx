import { useEffect, useMemo, useState } from 'react';
import { Download, Trash2, HardDrive, MapPin, RefreshCw } from 'lucide-react';
import { ImageWithFallback } from '../components/ImageWithFallback';
import { getTrailById, type Trail } from '../api/trails';
import { deleteOfflineMap, downloadOfflineMap, getUserOfflineMaps, type OfflineMapRecord } from '../api/offline';
import { getAccessToken } from '../api/client';

type OfflineDownloadItem = {
  record: OfflineMapRecord;
  trail?: Trail;
};

function formatBytes(bytes?: number) {
  if (!bytes || !Number.isFinite(bytes)) {
    return '~24.5 MB';
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDownloadedAt(value?: string | null) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function dedupeDownloadsByTrail(records: OfflineMapRecord[]) {
  const byTrailId = new Map<string, OfflineMapRecord>();

  records.forEach((record) => {
    if (!byTrailId.has(record.trail_id)) {
      byTrailId.set(record.trail_id, record);
    }
  });

  return [...byTrailId.values()];
}

export function OfflineDownloadsPage() {
  const [downloads, setDownloads] = useState<OfflineDownloadItem[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [busyTrailId, setBusyTrailId] = useState<string | null>(null);
  const isGuest = !getAccessToken();

  const loadDownloads = async () => {
    if (isGuest) return;

    setLoading(true);
    setErrorMessage('');

    try {
      const records = dedupeDownloadsByTrail(await getUserOfflineMaps());
      const items = await Promise.all(
        records.map(async (record) => {
          try {
            return { record, trail: await getTrailById(record.trail_id) };
          } catch {
            return { record };
          }
        }),
      );
      setDownloads(items);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to load downloaded trails.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDownloads();
  }, [isGuest]);

  const handleDownload = async (trailId: string) => {
    try {
      setBusyTrailId(trailId);
      await downloadOfflineMap(trailId);
      await loadDownloads();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to download offline map.');
    } finally {
      setBusyTrailId(null);
    }
  };

  const handleDelete = async (recordId: string) => {
    if (!confirm('Delete this offline map? You can download it again later.')) {
      return;
    }

    try {
      await deleteOfflineMap(recordId);
      setDownloads((prev) => prev.filter((item) => item.record.id !== recordId));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to delete offline map.');
    }
  };

  const totalBytes = useMemo(
    () => downloads.reduce((total, item) => total + (item.record.metadata?.bytes ?? 0), 0),
    [downloads],
  );
  const totalSizeLabel = totalBytes > 0 ? formatBytes(totalBytes) : (downloads.length * 24.5).toFixed(1) + ' MB';

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-6">
          <h1 className="mb-2">Offline Downloads</h1>
          <p className="text-secondary">Downloaded trail map packs synced to your account.</p>
        </div>

        {errorMessage && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-6">{errorMessage}</div>}

        <div className="bg-card rounded-xl border border-border p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <HardDrive className="w-5 h-5 text-secondary" />
              <h3>Storage Usage</h3>
            </div>
            <span className="text-sm text-secondary">{totalSizeLabel} / 500 MB</span>
          </div>
          <div className="h-3 bg-muted/20 rounded-full overflow-hidden mb-2">
            <div className="h-full bg-gradient-to-r from-primary to-success rounded-full transition-all" style={{ width: `${Math.min(100, (downloads.length * 24.5 / 500) * 100)}%` }} />
          </div>
          <p className="text-sm text-muted">{downloads.length} downloaded trail map{downloads.length === 1 ? '' : 's'}</p>
        </div>

        {isGuest ? (
          <div className="bg-card rounded-xl border border-border p-12 text-center">
            <Download className="w-16 h-16 text-muted mx-auto mb-4" />
            <h3 className="mb-2">Sign in to see downloads</h3>
            <p className="text-secondary mb-2">Offline map packs are synced to your account.</p>
          </div>
        ) : loading ? (
          <div className="bg-card rounded-xl border border-border p-12 text-center">
            <RefreshCw className="w-12 h-12 text-muted mx-auto mb-4 animate-spin" />
            <h3 className="mb-2">Loading downloads</h3>
          </div>
        ) : downloads.length === 0 ? (
          <div className="bg-card rounded-xl border border-border p-12 text-center">
            <Download className="w-16 h-16 text-muted mx-auto mb-4" />
            <h3 className="mb-2">No downloaded trails</h3>
            <p className="text-secondary mb-2">Use the download action on a trail to add its map pack here.</p>
          </div>
        ) : (
          <div className="space-y-4 mb-6">
            {downloads.map(({ record, trail }) => {
              const name = trail?.name || record.trail_name || 'Downloaded trail';
              const image = trail?.image || '';
              const downloadedAt = formatDownloadedAt(record.downloaded_at ?? record.created_at);
              const sizeLabel = formatBytes(record.metadata?.bytes);

              return (
                <div key={record.id} className="bg-card rounded-xl border border-border overflow-hidden hover:shadow-md transition-shadow">
                  <div className="flex gap-4 p-4">
                    <div className="w-24 h-24 rounded-lg overflow-hidden flex-shrink-0 bg-muted/20">
                      <ImageWithFallback src={image} alt={name} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground mb-1">{name}</h3>
                      {trail?.nameAr && <p className="text-sm text-secondary mb-2">{trail.nameAr}</p>}
                      <div className="flex flex-wrap items-center gap-3 text-sm text-muted mb-3">
                        {trail?.region && (
                          <div className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5" />
                            <span>{trail.region}</span>
                          </div>
                        )}
                        {downloadedAt && <span>Downloaded {downloadedAt}</span>}
                        <span>{sizeLabel}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleDownload(record.trail_id)}
                          disabled={busyTrailId === record.trail_id}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-success/10 text-success-foreground rounded-lg text-sm disabled:opacity-60"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>{busyTrailId === record.trail_id ? 'Refreshing...' : 'Download/Refresh'}</span>
                        </button>
                        <button onClick={() => handleDelete(record.id)} className="flex items-center gap-1.5 px-3 py-1.5 border border-destructive/30 text-destructive rounded-lg text-sm hover:bg-destructive/10 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

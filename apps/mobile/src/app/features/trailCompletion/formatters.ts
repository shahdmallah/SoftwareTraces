export function formatCompletionDuration(ms: number, isArabic: boolean): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  if (h > 0) {
    return isArabic ? `${h}س ${m}د` : `${h}h ${m}m`;
  }
  return isArabic ? `${Math.max(1, m)} دقيقة` : `${Math.max(1, m)} min`;
}

export function formatCompletionDate(iso: string, isArabic: boolean): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  return new Intl.DateTimeFormat(isArabic ? 'ar-PS' : 'en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(d);
}

export function formatDistanceKm(km: number | undefined, isArabic: boolean): string {
  if (km == null || !Number.isFinite(km)) return isArabic ? '—' : '—';
  return isArabic ? `${km.toFixed(1)} كم` : `${km.toFixed(1)} km`;
}

export function formatElevation(m: number | undefined, isArabic: boolean): string {
  if (m == null || !Number.isFinite(m)) return isArabic ? '—' : '—';
  return isArabic ? `${Math.round(m)} م` : `${Math.round(m)} m`;
}

export function formatSpeedKph(kph: number | undefined, isArabic: boolean): string {
  if (kph == null || !Number.isFinite(kph) || kph <= 0) return isArabic ? '—' : '—';
  return isArabic ? `${kph.toFixed(1)} كم/س` : `${kph.toFixed(1)} km/h`;
}

export function formatPaceMinPerKm(minPerKm: number | undefined, isArabic: boolean): string {
  if (minPerKm == null || !Number.isFinite(minPerKm) || minPerKm <= 0) return isArabic ? '—' : '—';

  const totalSeconds = Math.max(1, Math.round(minPerKm * 60));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const suffix = isArabic ? '/كم' : '/km';

  return `${minutes}:${String(seconds).padStart(2, '0')} ${suffix}`;
}

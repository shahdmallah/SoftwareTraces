import { useEffect, useState } from 'react';
import { getTrailById } from '../../api/trailsApi';
import { buildForecast } from '../../utils/weatherUtils';
import type { TrailCompletionDraft } from './types';

export type CompletionWeatherLine = {
  summary: string;
  tempC: number;
};

/**
 * Loads trail (if needed) and derives a plausible conditions line from the same
 * forecast heuristic used elsewhere in the app (buildForecast).
 */
export function useCompletionWeather(draft: TrailCompletionDraft | undefined, language: 'ar' | 'en') {
  const [weather, setWeather] = useState<CompletionWeatherLine | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!draft?.trailId) {
      setWeather(null);
      return () => {
        cancelled = true;
      };
    }

    const run = async () => {
      try {
        const nextTrail = await getTrailById(draft.trailId);
        if (cancelled) return;
        const days = buildForecast(nextTrail, language);
        const firstHour = days[0]?.hours?.[0];
        if (firstHour) {
          setWeather({ summary: firstHour.condition, tempC: firstHour.temperatureC });
        } else {
          setWeather(null);
        }
      } catch {
        if (!cancelled) {
          setWeather(null);
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [draft?.trailId, language]);

  return { weather };
}

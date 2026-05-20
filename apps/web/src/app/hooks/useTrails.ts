import { useEffect, useState } from 'react';
import type { Trail } from '../data/trails';
import { fetchTrails } from '../lib/api';

type TrailState = {
  trails: Trail[];
  loading: boolean;
  error: string;
};

export function useTrails() {
  const [state, setState] = useState<TrailState>({
    trails: [],
    loading: true,
    error: '',
  });

  useEffect(() => {
    let alive = true;

    fetchTrails()
      .then((nextTrails) => {
        if (!alive) return;
        setState({
          trails: nextTrails,
          loading: false,
          error: '',
        });
      })
      .catch((error) => {
        if (!alive) return;
        setState({
          trails: [],
          loading: false,
          error: error instanceof Error ? error.message : 'Unable to load trails.',
        });
      });

    return () => {
      alive = false;
    };
  }, []);

  return state;
}

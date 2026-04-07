import { create } from "zustand";
import type { ActivityPoint } from "@traces/shared-types";

interface LiveStats {
  distanceKm: number;
  elevationGainM: number;
  durationSec: number;
}

interface RecordingStore {
  isRecording: boolean;
  points: ActivityPoint[];
  stats: LiveStats;
  start: () => void;
  stop: () => void;
  pushPoint: (point: ActivityPoint) => void;
  reset: () => void;
}

export const useRecordingStore = create<RecordingStore>((set) => ({
  isRecording: false,
  points: [],
  stats: { distanceKm: 0, elevationGainM: 0, durationSec: 0 },
  start: () => set({ isRecording: true }),
  stop: () => set({ isRecording: false }),
  pushPoint: (point) =>
    set((state) => ({
      points: [...state.points, point],
      stats: {
        ...state.stats,
        durationSec: state.stats.durationSec + 5
      }
    })),
  reset: () => set({ isRecording: false, points: [], stats: { distanceKm: 0, elevationGainM: 0, durationSec: 0 } })
}));

import { create } from "zustand";
import type { Difficulty, Trail } from "@traces/shared-types";

interface TrailFilters {
  difficulty?: Difficulty;
  minLength?: number;
  maxLength?: number;
}

interface TrailStore {
  trails: Trail[];
  savedTrailIds: string[];
  filters: TrailFilters;
  setTrails: (trails: Trail[]) => void;
  toggleSavedTrail: (trailId: string) => void;
  setFilters: (filters: TrailFilters) => void;
}

export const useTrailStore = create<TrailStore>((set) => ({
  trails: [],
  savedTrailIds: [],
  filters: {},
  setTrails: (trails) => set({ trails }),
  toggleSavedTrail: (trailId) =>
    set((state) => ({
      savedTrailIds: state.savedTrailIds.includes(trailId)
        ? state.savedTrailIds.filter((id) => id !== trailId)
        : [...state.savedTrailIds, trailId]
    })),
  setFilters: (filters) => set({ filters })
}));

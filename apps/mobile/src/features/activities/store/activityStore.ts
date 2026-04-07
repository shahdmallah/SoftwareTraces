import { create } from "zustand";
import type { Activity } from "@traces/shared-types";

interface ActivityStore {
  activities: Activity[];
  pendingSyncIds: string[];
  setActivities: (activities: Activity[]) => void;
  markPendingSync: (activityId: string) => void;
  clearPendingSync: (activityId: string) => void;
}

export const useActivityStore = create<ActivityStore>((set) => ({
  activities: [],
  pendingSyncIds: [],
  setActivities: (activities) => set({ activities }),
  markPendingSync: (activityId) =>
    set((state) => ({
      pendingSyncIds: state.pendingSyncIds.includes(activityId)
        ? state.pendingSyncIds
        : [...state.pendingSyncIds, activityId]
    })),
  clearPendingSync: (activityId) =>
    set((state) => ({
      pendingSyncIds: state.pendingSyncIds.filter((id) => id !== activityId)
    }))
}));

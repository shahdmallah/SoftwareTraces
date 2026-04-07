import api from "../api/client";
import { getPendingActivities, markActivitySynced } from "../offline/storage";
import { useActivityStore } from "../../../features/activities/store/activityStore";

/**
 * Uploads pending offline activities using last-write-wins semantics on the API.
 */
export async function syncOfflineActivities(): Promise<void> {
  const pending = await getPendingActivities();
  if (pending.length === 0) {
    return;
  }

  const response = await api.post<{ data: { uploaded: string[]; conflicts: string[] } }>("/offline/sync", {
    activities: pending
  });

  for (const activityId of response.data.data.uploaded) {
    await markActivitySynced(activityId);
    useActivityStore.getState().clearPendingSync(activityId);
  }
}

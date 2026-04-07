import { useEffect } from "react";
import { syncOfflineActivities } from "../services/sync/syncManager";

export function useOfflineSync(): void {
  useEffect(() => {
    async function bootstrapSync(): Promise<void> {
      try {
        await syncOfflineActivities();
      } catch (error) {
        console.warn("Offline sync failed", error);
      }
    }

    void bootstrapSync();
  }, []);
}

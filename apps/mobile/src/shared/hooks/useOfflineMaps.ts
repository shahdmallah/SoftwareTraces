import { useCallback, useEffect, useState } from "react";
import { getTrailOfflineBundle } from "../services/api/client";
import {
  deleteOfflineMap,
  getOfflineMap,
  getOfflineMaps,
  saveOfflineMap,
  saveOfflineMapStatus,
  type OfflineMapRecord,
} from "../services/offline/storage";

export function useOfflineMaps() {
  const [maps, setMaps] = useState<OfflineMapRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      setMaps(await getOfflineMaps());
    } finally {
      setIsLoading(false);
    }
  }, []);

  const download = useCallback(async (trailId: string, title = "Offline trail") => {
    await saveOfflineMapStatus(trailId, title, "downloading");
    await refresh();

    try {
      const bundle = await getTrailOfflineBundle(trailId);
      await saveOfflineMap(bundle, "downloaded");
      await refresh();
      return bundle;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await saveOfflineMapStatus(trailId, title, "failed", message);
      await refresh();
      throw error;
    }
  }, [refresh]);

  const remove = useCallback(async (trailId: string) => {
    await deleteOfflineMap(trailId);
    await refresh();
  }, [refresh]);

  const getOne = useCallback((trailId: string) => getOfflineMap(trailId), []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    maps,
    isLoading,
    refresh,
    download,
    remove,
    getOne,
  };
}

import cron from "node-cron";
import { pool } from "../../db/pool";
import { fetchOchaIncidents } from "./ocha.fetcher";

let hasStartedSafetyCron = false;

export function startSafetyCron(): void {
  console.log("[startSafetyCron] Starting safety cron jobs");

  if (hasStartedSafetyCron) {
    console.log("[startSafetyCron] Safety cron already started");
    return;
  }

  hasStartedSafetyCron = true;

  cron.schedule("0 */6 * * *", async () => {
    console.log("[safety.cron] Starting scheduled OCHA fetch");
    try {
      const result = await fetchOchaIncidents();
      console.log("[safety.cron] OCHA fetch complete:", result);
    } catch (error) {
      console.error("[safety.cron] OCHA fetch failed:", error);
    }
  });

  cron.schedule("0 * * * *", async () => {
    console.log("[safety.cron] Starting expired incident cleanup");
    try {
      const result = await pool.query(
        `UPDATE safety_incidents
         SET is_resolved = true
         WHERE expires_at < NOW() AND is_resolved = false`
      );
      console.log(`[safety.cron] Expired incident cleanup complete. Rows updated: ${result.rowCount ?? 0}`);
    } catch (error) {
      console.error("[safety.cron] Expired incident cleanup failed:", error);
    }
  });

  cron.schedule("0 2 * * *", async () => {
    console.log("[safety.cron] Starting stale safety score cache invalidation");
    try {
      const result = await pool.query(
        `DELETE FROM trail_safety_scores
         WHERE last_calculated < NOW() - INTERVAL '24 hours'`
      );
      console.log(`[safety.cron] Stale cache invalidation complete. Rows deleted: ${result.rowCount ?? 0}`);
    } catch (error) {
      console.error("[safety.cron] Stale cache invalidation failed:", error);
    }
  });
}

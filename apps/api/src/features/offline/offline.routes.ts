import { Router } from "express";
import { z } from "zod";
import { deleteOfflineMap, downloadOfflineMap, getPendingSync, getUserOfflineMaps, syncOfflineActivities } from "./offline.controller";
import { asyncHandler } from "../../lib/asyncHandler";
import { authenticate } from "../../middleware/auth";
import { validate } from "../../middleware/validate";

const router = Router();
const offlineActivitySchema = z.object({
  id: z.string().uuid(),
  trailId: z.string().uuid().optional(),
  title: z.string().min(1),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime().optional(),
  durationSec: z.number().nonnegative().optional(),
  distanceKm: z.number().nonnegative().optional(),
  elevationGainM: z.number().nonnegative().optional(),
  avgSpeedKph: z.number().nonnegative().optional(),
  maxSpeedKph: z.number().nonnegative().optional(),
  status: z.enum(["draft", "recording", "completed", "synced"]).optional(),
  matchedTrailConfidence: z.number().min(0).max(1).optional(),
  updatedAt: z.string().datetime().optional()
});

router.use(authenticate);
router.get("/sync", asyncHandler(getPendingSync));
router.post("/sync", validate(z.object({ activities: z.array(offlineActivitySchema) })), asyncHandler(syncOfflineActivities));
router.post("/maps/:trailId", asyncHandler(downloadOfflineMap));
router.get("/maps", asyncHandler(getUserOfflineMaps));
router.delete("/maps/:id", asyncHandler(deleteOfflineMap));

export default router;

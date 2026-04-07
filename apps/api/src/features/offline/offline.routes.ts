import { Router } from "express";
import { z } from "zod";
import { downloadOfflineMap, getPendingSync, syncOfflineActivities } from "./offline.controller";
import { asyncHandler } from "../../lib/asyncHandler";
import { authenticate } from "../../middleware/auth";
import { validate } from "../../middleware/validate";

const router = Router();

router.use(authenticate);
router.get("/sync", asyncHandler(getPendingSync));
router.post("/sync", validate(z.object({ activities: z.array(z.record(z.any())) })), asyncHandler(syncOfflineActivities));
router.get("/maps/:trailId", asyncHandler(downloadOfflineMap));

export default router;

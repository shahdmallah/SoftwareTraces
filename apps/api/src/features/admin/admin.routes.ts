import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler";
import { authenticate } from "../../middleware/auth";
import { requireAdmin } from "../safety/admin";
import {
  adminArchiveChallenge,
  adminCreateChallenge,
  adminGetChallenge,
  adminListChallenges,
  adminPatchChallenge,
  adminPublishChallenge,
  adminRecalculateChallenge,
} from "../challenges/challenges.controller";
import {
  dashboard,
  deleteBadge,
  deleteDangerousLocation,
  getBadge,
  getBadges,
  getCheckpointReports,
  getDangerousLocations,
  getIncidents,
  getOchaLogs,
  getSosEvents,
  patchBadge,
  patchDangerousLocation,
  patchIncidentModeration,
  postBadge,
  postDangerousLocation,
  postOchaFetch,
} from "./admin.controller";

const router = Router();

router.use(authenticate, asyncHandler(requireAdmin));

router.get("/dashboard", asyncHandler(dashboard));

router.get("/challenges", asyncHandler(adminListChallenges));
router.post("/challenges", asyncHandler(adminCreateChallenge));
router.get("/challenges/:id", asyncHandler(adminGetChallenge));
router.patch("/challenges/:id", asyncHandler(adminPatchChallenge));
router.delete("/challenges/:id", asyncHandler(adminArchiveChallenge));
router.post("/challenges/:id/publish", asyncHandler(adminPublishChallenge));
router.post("/challenges/:id/archive", asyncHandler(adminArchiveChallenge));
router.post("/challenges/:id/recalculate", asyncHandler(adminRecalculateChallenge));

router.get("/badges", asyncHandler(getBadges));
router.post("/badges", asyncHandler(postBadge));
router.get("/badges/:id", asyncHandler(getBadge));
router.patch("/badges/:id", asyncHandler(patchBadge));
router.delete("/badges/:id", asyncHandler(deleteBadge));

router.get("/incidents", asyncHandler(getIncidents));
router.patch("/incidents/:id/moderation", asyncHandler(patchIncidentModeration));

router.get("/dangerous-locations", asyncHandler(getDangerousLocations));
router.post("/dangerous-locations", asyncHandler(postDangerousLocation));
router.patch("/dangerous-locations/:id", asyncHandler(patchDangerousLocation));
router.delete("/dangerous-locations/:id", asyncHandler(deleteDangerousLocation));

router.get("/checkpoint-reports", asyncHandler(getCheckpointReports));
router.get("/sos-events", asyncHandler(getSosEvents));
router.get("/ocha/logs", asyncHandler(getOchaLogs));
router.post("/ocha/fetch", asyncHandler(postOchaFetch));

export default router;

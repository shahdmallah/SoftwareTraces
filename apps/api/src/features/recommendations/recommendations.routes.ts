import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler";
import { authenticate } from "../../middleware/auth";
import { getPreferences, getRecommendedTrails, updatePreferences } from "./recommendations.controller";

const router = Router();

router.get("/trails", authenticate, asyncHandler(getRecommendedTrails));
router.get("/preferences", authenticate, asyncHandler(getPreferences));
router.put("/preferences", authenticate, asyncHandler(updatePreferences));

export default router;

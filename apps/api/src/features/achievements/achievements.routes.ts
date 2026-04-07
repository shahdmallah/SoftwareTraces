import { Router } from "express";
import { checkAchievements, getAchievements, getUserAchievements } from "./achievements.controller";
import { asyncHandler } from "../../lib/asyncHandler";
import { authenticate } from "../../middleware/auth";

const router = Router();

router.get("/", asyncHandler(getAchievements));
router.get("/users/:userId/achievements", asyncHandler(getUserAchievements));
router.post("/check", authenticate, asyncHandler(checkAchievements));

export default router;

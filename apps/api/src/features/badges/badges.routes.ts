import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler";
import { authenticate } from "../../middleware/auth";
import { getBadges, getMyBadges } from "./badges.controller";

const router = Router();

router.get("/", asyncHandler(getBadges));
router.get("/me", authenticate, asyncHandler(getMyBadges));

export default router;

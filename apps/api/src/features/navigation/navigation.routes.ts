import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler";
import { authenticate } from "../../middleware/auth";
import { checkPosition, endNavigation, startNavigation } from "./navigation.controller";

const router = Router();

router.post("/start", authenticate, asyncHandler(startNavigation));
router.post("/:id/location", authenticate, asyncHandler(checkPosition));
router.post("/:id/end", authenticate, asyncHandler(endNavigation));

export default router;

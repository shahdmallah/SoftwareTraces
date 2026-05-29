import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler";
import { authenticate } from "../../middleware/auth";
import { flagPhoto, getPhotoStatus, votePhoto } from "./photos.controller";

const router = Router();

router.post("/:id/vote", authenticate, asyncHandler(votePhoto));
router.post("/:id/flag", authenticate, asyncHandler(flagPhoto));
router.get("/:id/status", asyncHandler(getPhotoStatus));

export default router;

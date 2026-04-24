import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler";
import { getProfile, getProfilePhotos, getProfileReviews } from "./profiles.controller";

const router = Router();

router.get("/:id", asyncHandler(getProfile));
router.get("/:id/reviews", asyncHandler(getProfileReviews));
router.get("/:id/photos", asyncHandler(getProfilePhotos));

export default router;

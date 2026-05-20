import { Router } from "express";
import multer from "multer";
import { asyncHandler } from "../../lib/asyncHandler";
import { authenticate } from "../../middleware/auth";
import { getProfile, getProfilePhotos, getProfileReviews, updateMyProfile, uploadMyAvatar } from "./profiles.controller";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.patch("/me", authenticate, asyncHandler(updateMyProfile));
router.post("/me/avatar", authenticate, upload.single("avatar"), asyncHandler(uploadMyAvatar));
router.get("/:id", asyncHandler(getProfile));
router.get("/:id/reviews", asyncHandler(getProfileReviews));
router.get("/:id/photos", asyncHandler(getProfilePhotos));

export default router;

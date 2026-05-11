import { Router } from "express";
import multer from "multer";
import {
  addActivityMedia,
  cancelActivity,
  completeActivity,
  exportGPX,
  getActivityById,
  getActivityMedia,
  getMyActivities,
  getUserActivities,
  shareActivity,
  startActivity,
  syncPoints,
  updateActivityStatus,
} from "./activities.controller";
import { asyncHandler } from "../../lib/asyncHandler";
import { authenticate, optionalAuthenticate } from "../../middleware/auth";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

router.get("/", authenticate, asyncHandler(getMyActivities));
router.get("/me", authenticate, asyncHandler(getMyActivities));
router.get("/user/:userId", asyncHandler(getUserActivities));
router.post("/", authenticate, asyncHandler(startActivity));
router.get("/:id/gpx", optionalAuthenticate, asyncHandler(exportGPX));
router.get("/:id/media", optionalAuthenticate, asyncHandler(getActivityMedia));
router.post("/:id/media", authenticate, upload.single("photo"), asyncHandler(addActivityMedia));
router.post("/:id/share", authenticate, asyncHandler(shareActivity));
router.post("/:id/points", authenticate, asyncHandler(syncPoints));
router.patch("/:id/status", authenticate, asyncHandler(updateActivityStatus));
router.put("/:id", authenticate, asyncHandler(completeActivity));
router.delete("/:id", authenticate, asyncHandler(cancelActivity));
router.get("/:id", optionalAuthenticate, asyncHandler(getActivityById));

export default router;

import { Router } from "express";
import { z } from "zod";
import multer from "multer";
import {
  analyzeRoute,
  calculateTrailStats,
  checkDuplicateTrail,
  checkSavedStatus,
  createTrail,
  createTrailCondition,
  createTrailNatureSighting,
  createTrailReview,
  deleteReviewPhoto,
  deleteTrailReview,
  deleteTrail,
  deleteTrailPhoto,
  getElevationProfile,
  getAllTrails,
  getNearbyTrails,
  getTrailById,
  getTrailConditions,
  getTrailNatureSightings,
  getTrailPhotos,
  getTrailReviews,
  parseTrailDescription,
  getSavedTrails,
  publishTrail,
  saveTrail,
  searchOrGenerateTrail,
  searchTrails,
  setPrimaryPhoto,
  unpublishTrail,
  unsaveTrail,
  updateReviewPhotoCaption,
  updateTrail,
  updateTrailPhotoCaption,
  uploadTrailPhoto,
} from "./trails.controller";
import { getMyTrailDrafts } from "./trailDrafts.controller";
import { getMyTrails } from "./ownedTrails.controller";
import { asyncHandler } from "../../lib/asyncHandler";
import { authenticate } from "../../middleware/auth";
import { validate } from "../../middleware/validate";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

router.get("/ping", (_req, res) => {
  console.log("[trails] PING route hit!");
  res.json({ pong: true, timestamp: new Date().toISOString() });
});

router.post("/calculate", asyncHandler(calculateTrailStats));
router.post("/analyze-route", asyncHandler(analyzeRoute));
router.post("/parse-description", asyncHandler(parseTrailDescription));
router.post("/search-or-generate", asyncHandler(searchOrGenerateTrail));
router.post("/check-duplicate", authenticate, asyncHandler(checkDuplicateTrail));
router.post("/", authenticate, asyncHandler(createTrail));
router.get("/", asyncHandler(getAllTrails));
router.get("/nearby", validate(z.object({ lat: z.coerce.number(), lng: z.coerce.number(), radius: z.coerce.number().optional() }), "query"), asyncHandler(getNearbyTrails));
router.get("/search", validate(z.object({ q: z.string().optional(), difficulty: z.string().optional(), minLength: z.coerce.number().optional(), maxLength: z.coerce.number().optional() }), "query"), asyncHandler(searchTrails));
router.get("/saved", authenticate, asyncHandler(getSavedTrails));
router.get("/mine", authenticate, asyncHandler(getMyTrails));
router.get("/drafts", authenticate, asyncHandler(getMyTrailDrafts));
router.get("/:id/elevation-profile", asyncHandler(getElevationProfile));
router.get("/:id/photos", asyncHandler(getTrailPhotos));
router.get("/:id/nature-sightings", asyncHandler(getTrailNatureSightings));
router.post("/:id/nature-sightings", authenticate, asyncHandler(createTrailNatureSighting));
router.get("/:id", asyncHandler(getTrailById));
router.patch("/:id/publish", authenticate, asyncHandler(publishTrail));
router.patch("/:id/unpublish", authenticate, asyncHandler(unpublishTrail));
router.get("/:id/reviews", asyncHandler(getTrailReviews));
router.post("/:id/reviews", authenticate, upload.array("photos", 10), asyncHandler(createTrailReview));
router.delete("/reviews/:id", authenticate, asyncHandler(deleteTrailReview));
router.get("/:id/conditions", asyncHandler(getTrailConditions));
router.post("/:id/conditions", authenticate, validate(z.object({ condition_type: z.enum(['snow', 'ice', 'mud', 'flood', 'fallen_trees', 'wildfire', 'closure', 'good', 'fair']), severity: z.enum(['low', 'medium', 'high', 'extreme']).optional(), description: z.string().optional() })), asyncHandler(createTrailCondition));
router.post("/:id/photos", authenticate, upload.single("photo"), asyncHandler(uploadTrailPhoto));
router.patch("/review-photos/:id", authenticate, asyncHandler(updateReviewPhotoCaption));
router.delete("/review-photos/:id", authenticate, asyncHandler(deleteReviewPhoto));
router.post("/:id/save", authenticate, asyncHandler(saveTrail));
router.delete("/:id/save", authenticate, asyncHandler(unsaveTrail));
router.get("/:id/saved-status", authenticate, asyncHandler(checkSavedStatus));
router.patch("/photos/:id", authenticate, asyncHandler(updateTrailPhotoCaption));
router.delete("/photos/:id", authenticate, asyncHandler(deleteTrailPhoto));
router.patch("/photos/:id/primary", authenticate, asyncHandler(setPrimaryPhoto));
router.patch("/:id", authenticate, asyncHandler(updateTrail));
router.delete("/:id", authenticate, asyncHandler(deleteTrail));

export default router;

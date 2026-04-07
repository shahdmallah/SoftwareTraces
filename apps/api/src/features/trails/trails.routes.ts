import { Router } from "express";
import { z } from "zod";
import { createTrailCondition, createTrailReview, getNearbyTrails, getTrailById, getTrailConditions, getTrailReviews, searchTrails } from "./trails.controller";
import { asyncHandler } from "../../lib/asyncHandler";
import { authenticate } from "../../middleware/auth";
import { validate } from "../../middleware/validate";

const router = Router();

router.get("/nearby", validate(z.object({ lat: z.coerce.number(), lng: z.coerce.number(), radius: z.coerce.number().optional() }), "query"), asyncHandler(getNearbyTrails));
router.get("/search", validate(z.object({ q: z.string().optional(), difficulty: z.string().optional(), minLength: z.coerce.number().optional(), maxLength: z.coerce.number().optional() }), "query"), asyncHandler(searchTrails));
router.get("/:id", asyncHandler(getTrailById));
router.get("/:id/reviews", asyncHandler(getTrailReviews));
router.post("/:id/reviews", authenticate, validate(z.object({ rating: z.number().min(1).max(5), comment: z.string().min(2) })), asyncHandler(createTrailReview));
router.get("/:id/conditions", asyncHandler(getTrailConditions));
router.post("/:id/conditions", authenticate, validate(z.object({ status: z.string().min(2), note: z.string().min(2) })), asyncHandler(createTrailCondition));

export default router;

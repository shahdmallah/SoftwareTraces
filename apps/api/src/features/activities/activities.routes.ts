import { Router } from "express";
import { z } from "zod";
import { addActivityPoints, completeActivity, createActivity, deleteActivity, exportActivityGpx, getActivityById, getUserActivities } from "./activities.controller";
import { asyncHandler } from "../../lib/asyncHandler";
import { authenticate } from "../../middleware/auth";
import { validate } from "../../middleware/validate";

const router = Router();

router.use(authenticate);
router.get("/user/:userId", asyncHandler(getUserActivities));
router.get("/:id", asyncHandler(getActivityById));
router.post("/", validate(z.object({ title: z.string().min(2), startedAt: z.string(), trailId: z.string().uuid().optional() })), asyncHandler(createActivity));
router.post("/:id/points", validate(z.object({ points: z.array(z.object({ lat: z.number(), lng: z.number(), elevation: z.number().optional(), accuracy: z.number().optional(), speedMps: z.number().optional(), recordedAt: z.string() })) })), asyncHandler(addActivityPoints));
router.put("/:id", validate(z.object({ endedAt: z.string(), distanceKm: z.number(), elevationGainM: z.number(), avgSpeedKph: z.number(), maxSpeedKph: z.number() })), asyncHandler(completeActivity));
router.delete("/:id", asyncHandler(deleteActivity));
router.get("/:id/gpx", asyncHandler(exportActivityGpx));

export default router;

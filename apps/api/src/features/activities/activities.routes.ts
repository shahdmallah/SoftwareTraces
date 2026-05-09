import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import jwt from "jsonwebtoken";
import multer from "multer";
import { z } from "zod";
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
  sosAlert,
  startActivity,
  syncPoints,
  updateActivityStatus
} from "./activities.controller";
import { env } from "../../config/env";
import { asyncHandler } from "../../lib/asyncHandler";
import { HttpError } from "../../lib/httpError";
import { authenticate } from "../../middleware/auth";
import { validate } from "../../middleware/validate";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }
});

function uploadActivityMedia(req: Request, res: Response, next: NextFunction): void {
  upload.single("photo")(req, res, (error) => {
    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      next(new HttpError(400, "Media file must be 50MB or smaller"));
      return;
    }

    next(error);
  });
}

function optionalAuthenticate(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    next();
    return;
  }

  if (!authHeader.startsWith("Bearer ")) {
    next(new HttpError(401, "Missing bearer token"));
    return;
  }

  try {
    const token = authHeader.replace("Bearer ", "");
    const payload = jwt.verify(token, env.JWT_SECRET);

    if (
      typeof payload !== "object" ||
      payload === null ||
      typeof payload.sub !== "string" ||
      typeof payload.email !== "string"
    ) {
      throw new HttpError(401, "Invalid token payload");
    }

    req.auth = {
      sub: payload.sub,
      email: payload.email
    };
    next();
  } catch {
    next(new HttpError(401, "Invalid token"));
  }
}

router.get("/me", authenticate, asyncHandler(getMyActivities));
router.get("/user/:userId", authenticate, asyncHandler(getUserActivities));
router.get("/:id/media", optionalAuthenticate, asyncHandler(getActivityMedia));
router.get("/:id", optionalAuthenticate, asyncHandler(getActivityById));
router.post("/", authenticate, validate(z.object({ trail_id: z.string().uuid().optional(), started_at: z.string() })), asyncHandler(startActivity));
router.post("/:id/media", authenticate, uploadActivityMedia, asyncHandler(addActivityMedia));
router.post(
  "/:id/share",
  authenticate,
  validate(z.object({ visibility: z.enum(["public", "friends", "private"]).optional(), caption: z.string().optional(), review_id: z.string().uuid().optional() })),
  asyncHandler(shareActivity)
);
router.post(
  "/:id/points",
  authenticate,
  validate(
    z.object({
      points: z.array(
        z.object({
          latitude: z.number(),
          longitude: z.number(),
          elevation: z.number().optional(),
          accuracy: z.number().optional(),
          speed_mps: z.number().optional(),
          recorded_at: z.string()
        })
      )
    })
  ),
  asyncHandler(syncPoints)
);
router.put(
  "/:id",
  authenticate,
  validate(
    z.object({
      ended_at: z.string(),
      distance_meters: z.number(),
      elevation_gain_meters: z.number(),
      elevation_loss_meters: z.number(),
      max_elevation_meters: z.number(),
      min_elevation_meters: z.number(),
      max_speed_mps: z.number(),
      avg_speed_mps: z.number()
    })
  ),
  asyncHandler(completeActivity)
);
router.patch("/:id/status", authenticate, asyncHandler(updateActivityStatus));
router.delete("/:id", authenticate, asyncHandler(cancelActivity));
router.get("/:id/gpx", optionalAuthenticate, asyncHandler(exportGPX));
router.post("/sos", authenticate, asyncHandler(sosAlert));

export default router;

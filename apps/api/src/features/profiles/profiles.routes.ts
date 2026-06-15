import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import jwt from "jsonwebtoken";
import multer from "multer";
import { z } from "zod";
import { env } from "../../config/env";
import { asyncHandler } from "../../lib/asyncHandler";
import { HttpError } from "../../lib/httpError";
import { authenticate } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { getProfile, getProfilePhotos, getProfileReviews, searchProfiles, updateMyProfile } from "./profiles.controller";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

function optionalAuthenticate(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    next();
    return;
  }

  try {
    const token = authHeader.replace("Bearer ", "");
    const payload = jwt.verify(token, env.JWT_SECRET);

    if (
      typeof payload === "object" &&
      payload !== null &&
      typeof payload.sub === "string" &&
      typeof payload.email === "string"
    ) {
      req.auth = {
        sub: payload.sub,
        email: payload.email,
      };
    }
  } catch (error) {
    console.warn("[profiles.routes] Optional auth token ignored:", error instanceof Error ? error.message : error);
  }

  next();
}

function uploadProfileAvatar(req: Request, res: Response, next: NextFunction): void {
  upload.single("avatar")(req, res, (error) => {
    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      next(new HttpError(400, "Avatar image must be 10MB or smaller"));
      return;
    }

    next(error);
  });
}

router.get(
  "/search",
  validate(
    z.object({ q: z.string().min(1), page: z.coerce.number().min(1).optional(), limit: z.coerce.number().min(1).max(100).optional() }),
    "query"
  ),
  asyncHandler(searchProfiles)
);

router.patch("/me", authenticate, uploadProfileAvatar, asyncHandler(updateMyProfile));
router.get("/:id", optionalAuthenticate, asyncHandler(getProfile));
router.get("/:id/reviews", asyncHandler(getProfileReviews));
router.get("/:id/photos", asyncHandler(getProfilePhotos));

export default router;

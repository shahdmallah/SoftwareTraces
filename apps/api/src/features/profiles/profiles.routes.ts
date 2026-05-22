import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import jwt from "jsonwebtoken";
import { env } from "../../config/env";
import { asyncHandler } from "../../lib/asyncHandler";
import { getProfile, getProfilePhotos, getProfileReviews } from "./profiles.controller";

const router = Router();

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

router.get("/:id", optionalAuthenticate, asyncHandler(getProfile));
router.get("/:id/reviews", asyncHandler(getProfileReviews));
router.get("/:id/photos", asyncHandler(getProfilePhotos));

export default router;

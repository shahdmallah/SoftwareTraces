import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import jwt from "jsonwebtoken";
import { env } from "../../config/env";
import { asyncHandler } from "../../lib/asyncHandler";
import { authenticate } from "../../middleware/auth";
import {
  checkAchievements,
  getAchievements,
  getLeaderboard,
  getMyAchievements,
  getUserAchievements,
} from "./achievements.controller";

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
    console.warn("[achievements.routes] Optional auth token ignored:", error instanceof Error ? error.message : error);
  }

  next();
}

router.get("/", optionalAuthenticate, asyncHandler(getAchievements));
router.get("/leaderboard", asyncHandler(getLeaderboard));
router.get("/users/:userId", asyncHandler(getUserAchievements));
router.get("/me", authenticate, asyncHandler(getMyAchievements));
router.post("/check", authenticate, asyncHandler(checkAchievements));

export default router;

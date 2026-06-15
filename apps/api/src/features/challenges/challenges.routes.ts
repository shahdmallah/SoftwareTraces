import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import jwt from "jsonwebtoken";
import { env } from "../../config/env";
import { asyncHandler } from "../../lib/asyncHandler";
import { authenticate } from "../../middleware/auth";
import {
  getMyChallengeList,
  getPublicChallenge,
  listChallenges,
  postJoinChallenge,
} from "./challenges.controller";

const router = Router();

function optionalAuthenticate(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    next();
    return;
  }

  try {
    const payload = jwt.verify(authHeader.replace("Bearer ", ""), env.JWT_SECRET);
    if (
      typeof payload === "object" &&
      payload !== null &&
      typeof payload.sub === "string" &&
      typeof payload.email === "string"
    ) {
      req.auth = { sub: payload.sub, email: payload.email };
    }
  } catch {
    // Optional auth: public challenge browsing still works without a valid token.
  }

  next();
}

router.get("/", optionalAuthenticate, asyncHandler(listChallenges));
router.get("/me", authenticate, asyncHandler(getMyChallengeList));
router.get("/:id", optionalAuthenticate, asyncHandler(getPublicChallenge));
router.post("/:id/join", authenticate, asyncHandler(postJoinChallenge));

export default router;

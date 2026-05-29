import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import jwt from "jsonwebtoken";
import { env } from "../../config/env";
import { asyncHandler } from "../../lib/asyncHandler";
import { authenticate } from "../../middleware/auth";
import {
  createMeetupHandler,
  getMeetupHandler,
  joinMeetupHandler,
  leaveMeetupHandler,
  listMeetupsHandler,
} from "./meetups.controller";

const router = Router();

function optionalAuthenticate(req: Request, _res: Response, next: NextFunction): void {
  console.log("[meetups.routes] optionalAuthenticate start");
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

    next();
  } catch (error) {
    console.warn("[meetups.routes] Optional auth token ignored:", error instanceof Error ? error.message : error);
    next();
  }
}

router.get("/", optionalAuthenticate, asyncHandler(listMeetupsHandler));
router.get("/:id", optionalAuthenticate, asyncHandler(getMeetupHandler));
router.post("/", authenticate, asyncHandler(createMeetupHandler));
router.post("/:id/join", authenticate, asyncHandler(joinMeetupHandler));
router.delete("/:id/join", authenticate, asyncHandler(leaveMeetupHandler));

export default router;

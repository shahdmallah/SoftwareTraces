import { Router } from "express";
import { z } from "zod";
import { commentOnActivity, followUser, getFeed, getFollowers, likeActivity, unfollowUser } from "./social.controller";
import { asyncHandler } from "../../lib/asyncHandler";
import { authenticate } from "../../middleware/auth";
import { validate } from "../../middleware/validate";

const router = Router();

router.use(authenticate);
router.get("/users/:id/followers", asyncHandler(getFollowers));
router.post("/users/:id/follow", asyncHandler(followUser));
router.delete("/users/:id/follow", asyncHandler(unfollowUser));
router.get("/feed", asyncHandler(getFeed));
router.post("/activities/:id/like", asyncHandler(likeActivity));
router.post("/activities/:id/comments", validate(z.object({ body: z.string().min(1).max(1000) })), asyncHandler(commentOnActivity));

export default router;

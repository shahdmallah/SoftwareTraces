import { Router } from "express";
import { z } from "zod";
import { addReviewComment, commentOnActivity, deleteReviewComment, followUser, getFeed, getFollowers, getFollowing, getReviewComments, getReviewLikes, likeActivity, likeReview, unlikeReview, unfollowUser } from "./social.controller";
import { asyncHandler } from "../../lib/asyncHandler";
import { authenticate } from "../../middleware/auth";
import { validate } from "../../middleware/validate";

const router = Router();

router.get("/users/:id/followers", asyncHandler(getFollowers));
router.get("/users/:id/following", asyncHandler(getFollowing));
router.post("/users/:id/follow", authenticate, asyncHandler(followUser));
router.delete("/users/:id/follow", authenticate, asyncHandler(unfollowUser));
router.get("/feed", authenticate, asyncHandler(getFeed));
router.post("/reviews/:id/like", authenticate, asyncHandler(likeReview));
router.delete("/reviews/:id/like", authenticate, asyncHandler(unlikeReview));
router.get("/reviews/:id/likes", asyncHandler(getReviewLikes));
router.post("/reviews/:id/comments", authenticate, validate(z.object({ content: z.string().min(1).max(1000) })), asyncHandler(addReviewComment));
router.get("/reviews/:id/comments", asyncHandler(getReviewComments));
router.delete("/comments/:id", authenticate, asyncHandler(deleteReviewComment));
router.post("/activities/:id/like", authenticate, asyncHandler(likeActivity));
router.post("/activities/:id/comments", authenticate, validate(z.object({ body: z.string().min(1).max(1000) })), asyncHandler(commentOnActivity));

export default router;

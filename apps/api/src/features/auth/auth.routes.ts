import { Router } from "express";
import { z } from "zod";
import { login, logout, me, refresh, register } from "./auth.controller";
import { asyncHandler } from "../../lib/asyncHandler";
import { authenticate } from "../../middleware/auth";
import { authRateLimit } from "../../middleware/rateLimit";
import { validate } from "../../middleware/validate";

const router = Router();

router.post(
  "/register",
  authRateLimit,
  validate(z.object({ email: z.string().email(), username: z.string().min(3), password: z.string().min(8), fullName: z.string().min(2), locale: z.enum(["en", "ar"]).optional() })),
  asyncHandler(register)
);
router.post("/login", authRateLimit, validate(z.object({ email: z.string().email(), password: z.string().min(8) })), asyncHandler(login));
router.post("/refresh", validate(z.object({ refreshToken: z.string().min(1) })), asyncHandler(refresh));
router.post("/logout", asyncHandler(logout));
router.get("/me", authenticate, asyncHandler(me));

export default router;

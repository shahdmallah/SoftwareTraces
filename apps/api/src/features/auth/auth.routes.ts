import { Router } from "express";
import { loginSchema, signupSchema } from "../../validation/auth.validation";
import { login, logout, me, refresh, signup } from "./auth.controller";
import { asyncHandler } from "../../lib/asyncHandler";
import { authenticate } from "../../middleware/auth";
import { authRateLimit } from "../../middleware/rateLimit";
import { validate } from "../../middleware/validate";

const router = Router();

router.post("/signup", authRateLimit, validate(signupSchema), asyncHandler(signup));
router.post("/login", authRateLimit, validate(loginSchema), asyncHandler(login));
router.post("/refresh", asyncHandler(refresh));
router.post("/logout", asyncHandler(logout));
router.get("/me", authenticate, asyncHandler(me));

export default router;

import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler";
import { authenticate } from "../../middleware/auth";
import {
  getAlternativeRoute,
  getTrailAccess,
  setTrailAccess,
} from "./access.controller";

const router = Router();

router.get("/:id/access", asyncHandler(getTrailAccess));
router.post("/:id/access", authenticate, asyncHandler(setTrailAccess));
router.get("/:id/access/avoid", asyncHandler(getAlternativeRoute));

export default router;

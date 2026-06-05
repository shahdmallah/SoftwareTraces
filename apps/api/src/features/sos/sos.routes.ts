import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler";
import { authenticate } from "../../middleware/auth";
import {
  createSos,
  deleteContact,
  getContacts,
  getMySos,
  getSosById,
  patchContact,
  patchSosStatus,
  postContact,
} from "./sos.controller";

const router = Router();

router.post("/", authenticate, asyncHandler(createSos));
router.get("/my", authenticate, asyncHandler(getMySos));
router.get("/contacts", authenticate, asyncHandler(getContacts));
router.post("/contacts", authenticate, asyncHandler(postContact));
router.patch("/contacts/:id", authenticate, asyncHandler(patchContact));
router.delete("/contacts/:id", authenticate, asyncHandler(deleteContact));
router.get("/:id", authenticate, asyncHandler(getSosById));
router.patch("/:id/status", authenticate, asyncHandler(patchSosStatus));

export default router;

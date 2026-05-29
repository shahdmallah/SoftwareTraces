import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler";
import { authenticate } from "../../middleware/auth";
import {
  deleteNotification,
  getNotifications,
  markAllAsRead,
  markAsRead,
  registerPushToken,
  removePushToken,
} from "./notifications.controller";

const router = Router();

router.get("/", authenticate, asyncHandler(getNotifications));
router.patch("/read-all", authenticate, asyncHandler(markAllAsRead));
router.patch("/:id/read", authenticate, asyncHandler(markAsRead));
router.post("/push-token", authenticate, asyncHandler(registerPushToken));
router.delete("/push-token", authenticate, asyncHandler(removePushToken));
router.delete("/:id", authenticate, asyncHandler(deleteNotification));

export default router;

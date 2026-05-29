import type { Request, Response } from "express";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth";
import {
  deleteNotification as deleteNotificationService,
  getUserNotifications,
  markAllAsRead as markAllAsReadService,
  markAsRead as markAsReadService,
  registerPushToken as registerPushTokenService,
  removePushToken as removePushTokenService,
} from "./notifications.service";

const pushTokenSchema = z.object({
  token: z.string().min(1),
  platform: z.enum(["ios", "android", "web"]),
  device_id: z.string().optional(),
});

const removePushTokenSchema = z.object({
  token: z.string().min(1),
});

function getRequestId(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] : (value ?? "");
}

function sendNotificationError(functionName: string, res: Response, error: unknown): void {
  console.error(`[notifications.${functionName}] ERROR CAUGHT:`, error);
  console.error(`[notifications.${functionName}] Error message:`, error instanceof Error ? error.message : String(error));
  console.error(`[notifications.${functionName}] Error stack:`, error instanceof Error ? error.stack : "No stack");

  if (error instanceof z.ZodError) {
    res.status(400).json({ error: "Validation failed", details: error.flatten() });
    return;
  }

  if (error instanceof Error && error.message === "NOTIFICATION_NOT_FOUND") {
    res.status(404).json({ error: "Notification not found" });
    return;
  }

  res.status(500).json({
    error: `${functionName} failed`,
    details: error instanceof Error ? error.message : String(error),
  });
}

export async function getNotifications(req: Request, res: Response): Promise<void> {
  const functionName = "getNotifications";
  console.log("[notifications.getNotifications] ========== START ==========");
  console.log("[notifications.getNotifications] Query:", req.query);

  try {
    const auth = requireAuth(req);
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const unreadOnly = req.query.unreadOnly === "true" || req.query.unread_only === "true";

    console.log("[notifications.getNotifications] Fetching notifications:", {
      userId: auth.sub,
      page,
      limit,
      unreadOnly,
    });
    const result = await getUserNotifications(auth.sub, page, limit, unreadOnly);

    res.json({
      data: result.data,
      unread_count: result.unread_count,
      pagination: {
        page,
        limit,
        total: result.total,
        pages: result.pages,
      },
    });
  } catch (error) {
    sendNotificationError(functionName, res, error);
  }
}

export async function markAsRead(req: Request, res: Response): Promise<void> {
  const functionName = "markAsRead";
  console.log("[notifications.markAsRead] ========== START ==========");
  console.log("[notifications.markAsRead] Params:", req.params);

  try {
    const auth = requireAuth(req);
    const notificationId = getRequestId(req.params.id);
    const notification = await markAsReadService(notificationId, auth.sub);

    res.json({ data: notification });
  } catch (error) {
    sendNotificationError(functionName, res, error);
  }
}

export async function markAllAsRead(req: Request, res: Response): Promise<void> {
  const functionName = "markAllAsRead";
  console.log("[notifications.markAllAsRead] ========== START ==========");

  try {
    const auth = requireAuth(req);
    const updated = await markAllAsReadService(auth.sub);

    res.json({ updated });
  } catch (error) {
    sendNotificationError(functionName, res, error);
  }
}

export async function deleteNotification(req: Request, res: Response): Promise<void> {
  const functionName = "deleteNotification";
  console.log("[notifications.deleteNotification] ========== START ==========");
  console.log("[notifications.deleteNotification] Params:", req.params);

  try {
    const auth = requireAuth(req);
    const notificationId = getRequestId(req.params.id);
    const deleted = await deleteNotificationService(notificationId, auth.sub);

    if (!deleted) {
      res.status(404).json({ error: "Notification not found" });
      return;
    }

    res.json({ deleted: true });
  } catch (error) {
    sendNotificationError(functionName, res, error);
  }
}

export async function registerPushToken(req: Request, res: Response): Promise<void> {
  const functionName = "registerPushToken";
  console.log("[notifications.registerPushToken] ========== START ==========");
  console.log("[notifications.registerPushToken] Body:", {
    ...req.body,
    token: typeof req.body?.token === "string" ? `[length:${req.body.token.length}]` : req.body?.token,
  });

  try {
    const auth = requireAuth(req);
    const body = pushTokenSchema.parse(req.body);
    const pushToken = await registerPushTokenService(auth.sub, body.token, body.platform, body.device_id);

    res.status(201).json({ data: pushToken });
  } catch (error) {
    sendNotificationError(functionName, res, error);
  }
}

export async function removePushToken(req: Request, res: Response): Promise<void> {
  const functionName = "removePushToken";
  console.log("[notifications.removePushToken] ========== START ==========");
  console.log("[notifications.removePushToken] Body:", {
    ...req.body,
    token: typeof req.body?.token === "string" ? `[length:${req.body.token.length}]` : req.body?.token,
  });

  try {
    const auth = requireAuth(req);
    const body = removePushTokenSchema.parse(req.body);
    const removed = await removePushTokenService(auth.sub, body.token);

    res.json({ removed });
  } catch (error) {
    sendNotificationError(functionName, res, error);
  }
}

import { pool } from "../../db/pool";
import type {
  CreateNotificationInput,
  Notification,
  NotificationActor,
  NotificationEntity,
  NotificationType,
  PushToken,
} from "./notifications.types";

interface NotificationRow {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  actor_id: string | null;
  actor_full_name: string | null;
  actor_avatar_url: string | null;
  entity_type: string | null;
  entity_id: string | null;
  data: Record<string, unknown> | null;
  read_at: string | Date | null;
  created_at: string | Date;
}

function toIsoString(value: string | Date | null): string | null {
  if (value === null) {
    return null;
  }

  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function formatNotification(row: NotificationRow): Notification {
  const actor: NotificationActor | null = row.actor_id
    ? {
        id: row.actor_id,
        full_name: row.actor_full_name,
        avatar_url: row.actor_avatar_url,
      }
    : null;

  const entity: NotificationEntity = {
    type: row.entity_type,
    id: row.entity_id,
    data: row.data ?? null,
  };

  return {
    id: row.id,
    user_id: row.user_id,
    type: row.type,
    title: row.title,
    body: row.body,
    actor,
    entity,
    read_at: toIsoString(row.read_at),
    created_at: toIsoString(row.created_at) ?? new Date().toISOString(),
  };
}

function notificationSelectSql(): string {
  return `
    n.id,
    n.user_id,
    n.type,
    n.title,
    n.body,
    n.actor_id,
    actor.full_name AS actor_full_name,
    actor.avatar_url AS actor_avatar_url,
    n.entity_type,
    n.entity_id,
    n.data,
    n.read_at,
    n.created_at
  `;
}

async function fetchNotificationById(notificationId: string, userId: string): Promise<Notification | null> {
  console.log("[notifications.service.fetchNotificationById] Fetching notification:", { notificationId, userId });
  const result = await pool.query<NotificationRow>(
    `SELECT ${notificationSelectSql()}
     FROM notifications n
     LEFT JOIN profiles actor ON actor.id = n.actor_id
     WHERE n.id = $1::uuid
       AND n.user_id = $2::uuid
     LIMIT 1`,
    [notificationId, userId]
  );

  return result.rows[0] ? formatNotification(result.rows[0]) : null;
}

export async function createNotification(input: CreateNotificationInput): Promise<Notification> {
  console.log("[notifications.service.createNotification] ========== START ==========");
  console.log("[notifications.service.createNotification] Input:", input);

  const result = await pool.query<{ id: string }>(
    `INSERT INTO notifications (
       user_id,
       actor_id,
       type,
       title,
       body,
       entity_type,
       entity_id,
       data
     )
     VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7::uuid, $8::jsonb)
     RETURNING id`,
    [
      input.user_id,
      input.actor_id ?? null,
      input.type,
      input.title,
      input.body,
      input.entity_type ?? null,
      input.entity_id ?? null,
      JSON.stringify(input.data ?? {}),
    ]
  );

  const notification = await fetchNotificationById(result.rows[0].id, input.user_id);
  if (!notification) {
    throw new Error("Created notification could not be fetched");
  }

  console.log("[notifications.service.createNotification] Created:", notification.id);
  void sendPushNotification(input.user_id, input.title, input.body, {
    notification_id: notification.id,
    type: input.type,
    entity_type: input.entity_type,
    entity_id: input.entity_id,
    ...(input.data ?? {}),
  });

  return notification;
}

export async function getUserNotifications(
  userId: string,
  page: number,
  limit: number,
  unreadOnly: boolean
): Promise<{ data: Notification[]; unread_count: number; total: number; pages: number }> {
  console.log("[notifications.service.getUserNotifications] ========== START ==========");
  console.log("[notifications.service.getUserNotifications] Params:", { userId, page, limit, unreadOnly });

  const offset = (page - 1) * limit;
  const whereParts = ["n.user_id = $1::uuid"];
  const values: unknown[] = [userId];

  if (unreadOnly) {
    whereParts.push("n.read_at IS NULL");
  }

  const [unreadResult, countResult, notificationsResult] = await Promise.all([
    pool.query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM notifications WHERE user_id = $1::uuid AND read_at IS NULL",
      [userId]
    ),
    pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM notifications n
       WHERE ${whereParts.join(" AND ")}`,
      values
    ),
    pool.query<NotificationRow>(
      `SELECT ${notificationSelectSql()}
       FROM notifications n
       LEFT JOIN profiles actor ON actor.id = n.actor_id
       WHERE ${whereParts.join(" AND ")}
       ORDER BY n.created_at DESC
       LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, limit, offset]
    ),
  ]);

  const total = Number(countResult.rows[0]?.count ?? 0);
  const unreadCount = Number(unreadResult.rows[0]?.count ?? 0);
  console.log("[notifications.service.getUserNotifications] Counts:", { total, unreadCount });

  return {
    data: notificationsResult.rows.map(formatNotification),
    unread_count: unreadCount,
    total,
    pages: total === 0 ? 0 : Math.ceil(total / limit),
  };
}

export async function markAsRead(notificationId: string, userId: string): Promise<Notification> {
  console.log("[notifications.service.markAsRead] ========== START ==========");
  console.log("[notifications.service.markAsRead] Params:", { notificationId, userId });

  const result = await pool.query<{ id: string }>(
    `UPDATE notifications
     SET read_at = COALESCE(read_at, NOW())
     WHERE id = $1::uuid
       AND user_id = $2::uuid
     RETURNING id`,
    [notificationId, userId]
  );

  if (result.rows.length === 0) {
    throw new Error("NOTIFICATION_NOT_FOUND");
  }

  const notification = await fetchNotificationById(notificationId, userId);
  if (!notification) {
    throw new Error("NOTIFICATION_NOT_FOUND");
  }

  return notification;
}

export async function markAllAsRead(userId: string): Promise<number> {
  console.log("[notifications.service.markAllAsRead] ========== START ==========");
  console.log("[notifications.service.markAllAsRead] userId:", userId);

  const result = await pool.query(
    `UPDATE notifications
     SET read_at = NOW()
     WHERE user_id = $1::uuid
       AND read_at IS NULL`,
    [userId]
  );

  console.log("[notifications.service.markAllAsRead] Updated rows:", result.rowCount ?? 0);
  return result.rowCount ?? 0;
}

export async function deleteNotification(notificationId: string, userId: string): Promise<boolean> {
  console.log("[notifications.service.deleteNotification] ========== START ==========");
  console.log("[notifications.service.deleteNotification] Params:", { notificationId, userId });

  const result = await pool.query(
    `DELETE FROM notifications
     WHERE id = $1::uuid
       AND user_id = $2::uuid`,
    [notificationId, userId]
  );

  console.log("[notifications.service.deleteNotification] Deleted rows:", result.rowCount ?? 0);
  return (result.rowCount ?? 0) > 0;
}

export async function registerPushToken(
  userId: string,
  token: string,
  platform: string,
  deviceId?: string
): Promise<PushToken> {
  console.log("[notifications.service.registerPushToken] ========== START ==========");
  console.log("[notifications.service.registerPushToken] Params:", { userId, platform, deviceId, tokenLength: token.length });

  const updateResult = await pool.query<PushToken>(
    `UPDATE push_tokens
     SET platform = $3,
         device_id = $4,
         updated_at = NOW()
     WHERE user_id = $1::uuid
       AND token = $2
     RETURNING id, user_id, token, platform, device_id, created_at, updated_at`,
    [userId, token, platform, deviceId ?? null]
  );

  if (updateResult.rows[0]) {
    console.log("[notifications.service.registerPushToken] Updated existing token:", updateResult.rows[0].id);
    return updateResult.rows[0];
  }

  const insertResult = await pool.query<PushToken>(
    `INSERT INTO push_tokens (user_id, token, platform, device_id)
     VALUES ($1::uuid, $2, $3, $4)
     RETURNING id, user_id, token, platform, device_id, created_at, updated_at`,
    [userId, token, platform, deviceId ?? null]
  );

  console.log("[notifications.service.registerPushToken] Inserted token:", insertResult.rows[0].id);
  return insertResult.rows[0];
}

export async function removePushToken(userId: string, token: string): Promise<boolean> {
  console.log("[notifications.service.removePushToken] ========== START ==========");
  console.log("[notifications.service.removePushToken] Params:", { userId, tokenLength: token.length });

  const result = await pool.query(
    `DELETE FROM push_tokens
     WHERE user_id = $1::uuid
       AND token = $2`,
    [userId, token]
  );

  console.log("[notifications.service.removePushToken] Deleted rows:", result.rowCount ?? 0);
  return (result.rowCount ?? 0) > 0;
}

async function sendFcmPush(token: PushToken, title: string, body: string, data?: object): Promise<void> {
  console.log("[notifications.service.sendFcmPush] FCM push requested:", {
    token_id: token.id,
    title,
    body,
    hasData: Boolean(data),
  });
}

async function sendApnsPush(token: PushToken, title: string, body: string, data?: object): Promise<void> {
  console.log("[notifications.service.sendApnsPush] APNS push requested:", {
    token_id: token.id,
    title,
    body,
    hasData: Boolean(data),
  });
}

async function sendWebPush(token: PushToken, title: string, body: string, data?: object): Promise<void> {
  console.log("[notifications.service.sendWebPush] Web push requested:", {
    token_id: token.id,
    title,
    body,
    hasData: Boolean(data),
  });
}

export async function sendPushNotification(userId: string, title: string, body: string, data?: object): Promise<void> {
  console.log("[notifications.service.sendPushNotification] ========== START ==========");
  console.log("[notifications.service.sendPushNotification] Params:", { userId, title, hasData: Boolean(data) });

  try {
    const result = await pool.query<PushToken>(
      `SELECT id, user_id, token, platform, device_id, created_at, updated_at
       FROM push_tokens
       WHERE user_id = $1::uuid`,
      [userId]
    );
    console.log("[notifications.service.sendPushNotification] Tokens found:", result.rows.length);

    for (const token of result.rows) {
      try {
        if (token.platform === "android") {
          await sendFcmPush(token, title, body, data);
        } else if (token.platform === "ios") {
          await sendApnsPush(token, title, body, data);
        } else {
          await sendWebPush(token, title, body, data);
        }
      } catch (pushError) {
        console.error("[notifications.service.sendPushNotification] Push send failed:", {
          token_id: token.id,
          platform: token.platform,
          error: pushError instanceof Error ? pushError.message : String(pushError),
        });
      }
    }
  } catch (error) {
    console.error("[notifications.service.sendPushNotification] Failed to load push tokens:", error);
  }
}

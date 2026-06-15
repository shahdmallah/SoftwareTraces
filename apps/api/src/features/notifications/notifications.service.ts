import { pool } from "../../db/pool";
import type {
  CreateNotificationInput,
  Notification,
  NotificationActor,
  NotificationEntity,
  NotificationType,
  PushToken,
} from "./notifications.types";
import { sendFcmPushNotification } from "./fcmProvider";

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

type PushProvider = "expo" | "fcm" | "apns" | "webpush";

interface PushDeliveryResult {
  token_id: string;
  provider: PushProvider;
  status: "sent" | "skipped" | "failed";
  reason?: string;
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
  deviceId?: string,
  provider?: PushProvider,
  appVersion?: string
): Promise<PushToken> {
  console.log("[notifications.service.registerPushToken] ========== START ==========");
  console.log("[notifications.service.registerPushToken] Params:", { userId, platform, provider, deviceId, appVersion, tokenLength: token.length });
  const resolvedProvider = provider ?? inferProvider(platform, token);

  const updateResult = await pool.query<PushToken>(
    `UPDATE push_tokens
     SET platform = $3,
         device_id = $4,
         provider = $5,
         app_version = $6,
         last_seen_at = NOW(),
         is_active = true,
         updated_at = NOW()
     WHERE user_id = $1::uuid
       AND token = $2
     RETURNING id, user_id, token, platform, provider, device_id, app_version, last_seen_at, is_active, created_at, updated_at`,
    [userId, token, platform, deviceId ?? null, resolvedProvider, appVersion ?? null]
  );

  if (updateResult.rows[0]) {
    console.log("[notifications.service.registerPushToken] Updated existing token:", updateResult.rows[0].id);
    return updateResult.rows[0];
  }

  const insertResult = await pool.query<PushToken>(
    `INSERT INTO push_tokens (user_id, token, platform, provider, device_id, app_version, last_seen_at, is_active)
     VALUES ($1::uuid, $2, $3, $4, $5, $6, NOW(), true)
     RETURNING id, user_id, token, platform, provider, device_id, app_version, last_seen_at, is_active, created_at, updated_at`,
    [userId, token, platform, resolvedProvider, deviceId ?? null, appVersion ?? null]
  );

  console.log("[notifications.service.registerPushToken] Inserted token:", insertResult.rows[0].id);
  return insertResult.rows[0];
}

export async function removePushToken(userId: string, token: string): Promise<boolean> {
  console.log("[notifications.service.removePushToken] ========== START ==========");
  console.log("[notifications.service.removePushToken] Params:", { userId, tokenLength: token.length });

  const result = await pool.query(
    `UPDATE push_tokens
     SET is_active = false,
         updated_at = NOW()
     WHERE user_id = $1::uuid
       AND token = $2`,
    [userId, token]
  );

  console.log("[notifications.service.removePushToken] Deleted rows:", result.rowCount ?? 0);
  return (result.rowCount ?? 0) > 0;
}

function inferProvider(platform: string, token: string): PushProvider {
  if (token.startsWith("ExponentPushToken[")) {
    return "expo";
  }

  if (platform === "ios") {
    return "apns";
  }

  if (platform === "android") {
    return "fcm";
  }

  return "webpush";
}

async function sendExpoPush(token: PushToken, title: string, body: string, data?: object): Promise<PushDeliveryResult> {
  try {
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: token.token,
        title,
        body,
        data: data ?? {},
      }),
    });

    if (!response.ok) {
      return { token_id: token.id, provider: "expo", status: "failed", reason: `Expo responded ${response.status}` };
    }

    return { token_id: token.id, provider: "expo", status: "sent" };
  } catch (error) {
    return { token_id: token.id, provider: "expo", status: "failed", reason: error instanceof Error ? error.message : String(error) };
  }
}

async function sendApnsPush(token: PushToken, _title: string, _body: string, _data?: object): Promise<PushDeliveryResult> {
  if (!process.env.APNS_KEY_ID || !process.env.APNS_TEAM_ID || !process.env.APNS_PRIVATE_KEY) {
    return { token_id: token.id, provider: "apns", status: "skipped", reason: "APNS credentials are not configured" };
  }

  return { token_id: token.id, provider: "apns", status: "skipped", reason: "APNS provider adapter is configured for future credential integration" };
}

async function sendWebPush(token: PushToken, _title: string, _body: string, _data?: object): Promise<PushDeliveryResult> {
  if (!process.env.WEB_PUSH_VAPID_PUBLIC_KEY || !process.env.WEB_PUSH_VAPID_PRIVATE_KEY) {
    return { token_id: token.id, provider: "webpush", status: "skipped", reason: "WebPush VAPID credentials are not configured" };
  }

  return { token_id: token.id, provider: "webpush", status: "skipped", reason: "WebPush provider adapter is configured for future credential integration" };
}

async function deliverPush(token: PushToken, title: string, body: string, data?: object): Promise<PushDeliveryResult> {
  const provider = (token.provider ?? inferProvider(token.platform, token.token)) as PushProvider;
  if (provider === "expo") {
    return sendExpoPush(token, title, body, data);
  }

  if (provider === "apns") {
    return sendApnsPush(token, title, body, data);
  }

  return sendWebPush(token, title, body, data);
}

export async function sendPushNotification(userId: string, title: string, body: string, data?: object): Promise<PushDeliveryResult[]> {
  console.log("[notifications.service.sendPushNotification] ========== START ==========");
  console.log("[notifications.service.sendPushNotification] Params:", { userId, title, hasData: Boolean(data) });

  try {
    const result = await pool.query<PushToken>(
      `SELECT id, user_id, token, platform, provider, device_id, app_version, last_seen_at, is_active, created_at, updated_at
       FROM push_tokens
       WHERE user_id = $1::uuid
         AND COALESCE(is_active, true) = true
         AND COALESCE(provider, '') <> 'fcm'`,
      [userId]
    );
    console.log("[notifications.service.sendPushNotification] Tokens found:", result.rows.length);
    const deliveries: PushDeliveryResult[] = [];

    for (const token of result.rows) {
      const delivery = await deliverPush(token, title, body, data);
      deliveries.push(delivery);
      console.log("[notifications.service.sendPushNotification] Delivery result:", delivery);
    }

    const fcmDeliveries = await sendFcmPushNotification(userId, title, body, data);
    for (const delivery of fcmDeliveries) {
      deliveries.push(delivery);
      console.log("[notifications.service.sendPushNotification] FCM delivery result:", delivery);
    }

    return deliveries;
  } catch (error) {
    console.error("[notifications.service.sendPushNotification] Failed to load push tokens:", error);
    return [];
  }
}

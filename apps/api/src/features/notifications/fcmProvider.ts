import { pool } from "../../db/pool";
import { firebaseAdmin } from "../../lib/firebaseAdmin";
import type { PushToken } from "./notifications.types";

export interface PushDeliveryResult {
  token_id: string;
  provider: "fcm";
  status: "sent" | "skipped" | "failed";
  reason?: string;
}

function stringifyData(data?: object): Record<string, string> {
  if (!data) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(data).flatMap(([key, value]) => {
      if (value === undefined || value === null) {
        return [];
      }

      return [[key, typeof value === "string" ? value : JSON.stringify(value)]];
    })
  );
}

function isInvalidFcmToken(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const code = "code" in error ? String((error as { code?: unknown }).code) : "";
  return code === "messaging/registration-token-not-registered" ||
    code === "messaging/invalid-registration-token";
}

async function deactivatePushToken(tokenId: string, reason: string): Promise<void> {
  await pool.query(
    `UPDATE push_tokens
     SET is_active = false,
         updated_at = NOW()
     WHERE id = $1::uuid`,
    [tokenId]
  );
  console.warn("[fcmProvider] Deactivated invalid FCM token:", { tokenId, reason });
}

async function sendFcmToken(token: PushToken, title: string, body: string, data?: object): Promise<PushDeliveryResult> {
  try {
    await firebaseAdmin.messaging().send({
      token: token.token,
      notification: {
        title,
        body,
      },
      data: stringifyData(data),
      android: {
        priority: "high",
        notification: {
          channelId: "default",
          sound: "default",
        },
      },
      apns: {
        payload: {
          aps: {
            sound: "default",
          },
        },
      },
    });

    return { token_id: token.id, provider: "fcm", status: "sent" };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    if (isInvalidFcmToken(error)) {
      await deactivatePushToken(token.id, reason);
    }

    return { token_id: token.id, provider: "fcm", status: "failed", reason };
  }
}

export async function sendFcmPushNotification(
  userId: string,
  title: string,
  body: string,
  data?: object
): Promise<PushDeliveryResult[]> {
  try {
    const result = await pool.query<PushToken>(
      `SELECT id, user_id, token, platform, provider, device_id, app_version, last_seen_at, is_active, created_at, updated_at
       FROM push_tokens
       WHERE user_id = $1::uuid
         AND provider = 'fcm'
         AND is_active = true`,
      [userId]
    );

    const deliveries: PushDeliveryResult[] = [];
    for (const token of result.rows) {
      deliveries.push(await sendFcmToken(token, title, body, data));
    }

    return deliveries;
  } catch (error) {
    console.error("[fcmProvider] Failed to send FCM push notifications:", error);
    return [];
  }
}

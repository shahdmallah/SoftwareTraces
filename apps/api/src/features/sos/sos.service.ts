import { pool } from "../../db/pool";
import { HttpError } from "../../lib/httpError";
import { getOrCreateDirectConversation, sendConversationMessageWithMetadata } from "../messages/messages.service";
import { emitMessageNew } from "../messages/messages.socket";
import { createNotification } from "../notifications/notifications.service";

export type SosStatus = "created" | "notifying" | "notified" | "acknowledged" | "resolved" | "cancelled" | "failed";

export interface CreateSosInput {
  userId: string;
  activityId?: string | null;
  latitude: number;
  longitude: number;
  message?: string | null;
  occurredAt: string;
}

export interface EmergencyContact {
  id: string;
  user_id: string;
  contact_user_id: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  relationship: string | null;
  priority: number;
  notify_by_sms: boolean;
  notify_by_email: boolean;
  notify_by_push: boolean;
  notify_on_sos: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const allowedTransitions: Record<SosStatus, SosStatus[]> = {
  created: ["notifying", "acknowledged", "cancelled", "failed"],
  notifying: ["notified", "failed", "cancelled"],
  notified: ["acknowledged", "resolved", "failed", "cancelled"],
  acknowledged: ["resolved", "cancelled", "failed"],
  resolved: [],
  cancelled: [],
  failed: ["notifying", "cancelled"],
};

function toIsoString(value: string | Date | null | undefined): string {
  if (!value) {
    return new Date(0).toISOString();
  }

  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toBool(value: unknown): boolean {
  return value === true;
}

function formatContact(row: Record<string, any>): EmergencyContact {
  return {
    id: row.id,
    user_id: row.user_id,
    contact_user_id: row.contact_user_id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    relationship: row.relationship,
    priority: Number(row.priority ?? 1),
    notify_by_sms: toBool(row.notify_by_sms),
    notify_by_email: toBool(row.notify_by_email),
    notify_by_push: toBool(row.notify_by_push),
    notify_on_sos: row.notify_on_sos !== false,
    is_active: row.is_active !== false,
    created_at: toIsoString(row.created_at),
    updated_at: toIsoString(row.updated_at),
  };
}

function formatSos(row: Record<string, any>) {
  return {
    id: row.id,
    user_id: row.user_id,
    activity_id: row.activity_id,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    message: row.message,
    occurred_at: toIsoString(row.occurred_at),
    status: row.status as SosStatus,
    status_note: row.status_note,
    contact_count: Number(row.contact_count ?? 0),
    notified_contact_count: Number(row.notified_contact_count ?? 0),
    acknowledged_at: row.acknowledged_at ? toIsoString(row.acknowledged_at) : null,
    resolved_at: row.resolved_at ? toIsoString(row.resolved_at) : null,
    cancelled_at: row.cancelled_at ? toIsoString(row.cancelled_at) : null,
    failed_at: row.failed_at ? toIsoString(row.failed_at) : null,
    created_at: toIsoString(row.created_at),
    updated_at: toIsoString(row.updated_at),
  };
}

export async function listEmergencyContacts(userId: string): Promise<EmergencyContact[]> {
  const result = await pool.query(
    `SELECT id, user_id, name, phone, email, relationship, priority,
            contact_user_id, notify_by_sms, notify_by_email, notify_by_push, notify_on_sos, is_active, created_at, updated_at
     FROM emergency_contacts
     WHERE user_id = $1::uuid
     ORDER BY is_active DESC, priority ASC, created_at ASC`,
    [userId]
  );

  return result.rows.map(formatContact);
}

export async function createEmergencyContact(userId: string, input: {
  name: string;
  phone?: string | null;
  email?: string | null;
  contact_user_id?: string | null;
  relationship?: string | null;
  priority?: number;
  notify_by_sms?: boolean;
  notify_by_email?: boolean;
  notify_by_push?: boolean;
  notify_on_sos?: boolean;
}): Promise<EmergencyContact> {
  const result = await pool.query(
    `INSERT INTO emergency_contacts (
       user_id, contact_user_id, name, phone, email, relationship, priority,
       notify_by_sms, notify_by_email, notify_by_push, notify_on_sos
     )
     VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING id, user_id, contact_user_id, name, phone, email, relationship, priority,
               notify_by_sms, notify_by_email, notify_by_push, notify_on_sos, is_active, created_at, updated_at`,
    [
      userId,
      input.contact_user_id ?? null,
      input.name,
      input.phone ?? null,
      input.email ?? null,
      input.relationship ?? null,
      input.priority ?? 1,
      input.notify_by_sms ?? true,
      input.notify_by_email ?? true,
      input.notify_by_push ?? true,
      input.notify_on_sos ?? true,
    ]
  );

  return formatContact(result.rows[0]);
}

export async function updateEmergencyContact(userId: string, contactId: string, input: Partial<{
  name: string;
  contact_user_id: string | null;
  phone: string | null;
  email: string | null;
  relationship: string | null;
  priority: number;
  notify_by_sms: boolean;
  notify_by_email: boolean;
  notify_by_push: boolean;
  notify_on_sos: boolean;
  is_active: boolean;
}>): Promise<EmergencyContact> {
  const result = await pool.query(
    `UPDATE emergency_contacts
     SET name = COALESCE($3, name),
         contact_user_id = CASE WHEN $4::boolean THEN $5::uuid ELSE contact_user_id END,
         phone = CASE WHEN $6::boolean THEN $7 ELSE phone END,
         email = CASE WHEN $8::boolean THEN $9 ELSE email END,
         relationship = CASE WHEN $10::boolean THEN $11 ELSE relationship END,
         priority = COALESCE($12, priority),
         notify_by_sms = COALESCE($13, notify_by_sms),
         notify_by_email = COALESCE($14, notify_by_email),
         notify_by_push = COALESCE($15, notify_by_push),
         notify_on_sos = COALESCE($16, notify_on_sos),
         is_active = COALESCE($17, is_active),
         updated_at = NOW()
     WHERE id = $1::uuid
       AND user_id = $2::uuid
     RETURNING id, user_id, contact_user_id, name, phone, email, relationship, priority,
               notify_by_sms, notify_by_email, notify_by_push, notify_on_sos, is_active, created_at, updated_at`,
    [
      contactId,
      userId,
      input.name ?? null,
      Object.prototype.hasOwnProperty.call(input, "contact_user_id"),
      input.contact_user_id ?? null,
      Object.prototype.hasOwnProperty.call(input, "phone"),
      input.phone ?? null,
      Object.prototype.hasOwnProperty.call(input, "email"),
      input.email ?? null,
      Object.prototype.hasOwnProperty.call(input, "relationship"),
      input.relationship ?? null,
      input.priority ?? null,
      input.notify_by_sms ?? null,
      input.notify_by_email ?? null,
      input.notify_by_push ?? null,
      input.notify_on_sos ?? null,
      input.is_active ?? null,
    ]
  );

  if (!result.rows[0]) {
    throw new HttpError(404, "Emergency contact not found");
  }

  return formatContact(result.rows[0]);
}

export async function deleteEmergencyContact(userId: string, contactId: string): Promise<void> {
  const result = await pool.query(
    `DELETE FROM emergency_contacts
     WHERE id = $1::uuid
       AND user_id = $2::uuid`,
    [contactId, userId]
  );

  if ((result.rowCount ?? 0) === 0) {
    throw new HttpError(404, "Emergency contact not found");
  }
}

async function resolveContactUserId(contact: EmergencyContact): Promise<string | null> {
  if (contact.contact_user_id) {
    return contact.contact_user_id;
  }

  if (contact.email) {
    const result = await pool.query<{ id: string }>(
      `SELECT id
       FROM users
       WHERE lower(email) = lower($1)
       LIMIT 1`,
      [contact.email]
    );
    return result.rows[0]?.id ?? null;
  }

  return null;
}

async function recordSosContactDelivery(input: {
  sosId: string;
  contactId: string;
  recipientUserId?: string | null;
  conversationId?: string | null;
  messageId?: string | null;
  status: "queued" | "sent" | "failed" | "skipped";
  error?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const values = [
    input.sosId,
    input.contactId,
    input.recipientUserId ?? null,
    input.conversationId ?? null,
    input.messageId ?? null,
    input.status,
    JSON.stringify(input.metadata ?? {}),
    input.error ?? null,
  ];
  const updated = await pool.query(
    `UPDATE sos_contact_notifications
     SET recipient_user_id = $3::uuid,
         conversation_id = COALESCE(conversation_id, $4::uuid),
         message_id = COALESCE(message_id, $5::uuid),
         status = CASE
           WHEN status = 'sent' THEN status
           ELSE $6
         END,
         metadata = metadata || $7::jsonb,
         error = $8,
         updated_at = NOW()
     WHERE sos_event_id = $1::uuid
       AND contact_id = $2::uuid
       AND channel = 'in_app_message'`,
    values
  );

  if ((updated.rowCount ?? 0) > 0) {
    return;
  }

  await pool.query(
    `INSERT INTO sos_contact_notifications (
       sos_event_id, contact_id, recipient_user_id, conversation_id, message_id,
       channel, status, metadata, error, updated_at
     )
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'in_app_message', $6, $7::jsonb, $8, NOW())`,
    [
      ...values,
    ]
  );
}

async function hasSentSosMessage(sosId: string, contactId: string): Promise<boolean> {
  const result = await pool.query<{ id: string }>(
    `SELECT id
     FROM sos_contact_notifications
     WHERE sos_event_id = $1::uuid
       AND contact_id = $2::uuid
       AND channel = 'in_app_message'
       AND status = 'sent'
     LIMIT 1`,
    [sosId, contactId]
  );

  return Boolean(result.rows[0]);
}

async function sendSosInAppMessage(sosId: string, contact: EmergencyContact, input: CreateSosInput): Promise<boolean> {
  const recipientUserId = await resolveContactUserId(contact);
  if (!recipientUserId || recipientUserId === input.userId) {
    await recordSosContactDelivery({
      sosId,
      contactId: contact.id,
      recipientUserId,
      status: "failed",
      error: recipientUserId === input.userId ? "Emergency contact resolves to SOS user" : "Emergency contact is not a registered app user",
    });
    return false;
  }

  if (await hasSentSosMessage(sosId, contact.id)) {
    return true;
  }

  const content = `Emergency SOS triggered. I may need help. Last known location: ${input.latitude}, ${input.longitude}. Time: ${input.occurredAt}.`;
  const metadata = {
    type: "sos",
    sos_event_id: sosId,
    latitude: input.latitude,
    longitude: input.longitude,
    occurred_at: input.occurredAt,
  };

  try {
    const conversation = await getOrCreateDirectConversation(input.userId, recipientUserId);
    const message = await sendConversationMessageWithMetadata(input.userId, conversation.id, content, metadata);
    emitMessageNew(message);
    const notificationData = {
      ...metadata,
      conversation_id: conversation.id,
      message_id: message.id,
    };
    await createNotification({
      user_id: recipientUserId,
      actor_id: message.sender_id,
      type: "sos_alert",
      title: "Emergency SOS",
      body: "An emergency contact triggered SOS and may need help.",
      entity_type: "sos",
      entity_id: sosId,
      data: notificationData,
    });
    await recordSosContactDelivery({
      sosId,
      contactId: contact.id,
      recipientUserId,
      conversationId: conversation.id,
      messageId: message.id,
      status: "sent",
      metadata: notificationData,
    });
    return true;
  } catch (error) {
    await recordSosContactDelivery({
      sosId,
      contactId: contact.id,
      recipientUserId,
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
      metadata,
    });
    return false;
  }
}

async function notifyEmergencyContactsBestEffort(sosId: string, input: CreateSosInput): Promise<{ total: number; notified: number }> {
  const contacts = await listEmergencyContacts(input.userId);
  const activeContacts = contacts.filter((contact) => contact.is_active && contact.notify_on_sos);

  let notified = 0;
  for (const contact of activeContacts) {
    if (await sendSosInAppMessage(sosId, contact, input)) {
      notified += 1;
    }
  }

  try {
    await createNotification({
      user_id: input.userId,
      type: "danger_alert",
      title: "SOS created",
      body: activeContacts.length > 0
        ? `${notified}/${activeContacts.length} emergency contact${activeContacts.length === 1 ? "" : "s"} received an in-app SOS message.`
        : "SOS was saved, but no active emergency contacts are configured.",
      entity_type: "sos",
      entity_id: sosId,
      data: {
        latitude: input.latitude,
        longitude: input.longitude,
        contact_count: activeContacts.length,
      },
    });
  } catch (error) {
    console.error("[sos.notifyEmergencyContactsBestEffort] User notification failed:", error);
  }

  return { total: activeContacts.length, notified };
}

export async function createSosEvent(input: CreateSosInput) {
  const initialResult = await pool.query(
    `INSERT INTO sos_events (
       user_id, activity_id, latitude, longitude, message, occurred_at, status, created_at, updated_at
     )
     VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6::timestamptz, 'created', NOW(), NOW())
     RETURNING *`,
    [
      input.userId,
      input.activityId ?? null,
      input.latitude,
      input.longitude,
      input.message ?? null,
      input.occurredAt,
    ]
  );

  const sosId = initialResult.rows[0].id;
  await updateSosStatus(input.userId, sosId, "notifying", "Emergency contact notification started");
  const delivery = await notifyEmergencyContactsBestEffort(sosId, input);
  await pool.query(
    `UPDATE sos_events
     SET contact_count = $2,
         notified_contact_count = $3,
         updated_at = NOW()
     WHERE id = $1::uuid`,
    [sosId, delivery.total, delivery.notified]
  );
  const finalStatus: SosStatus = delivery.notified > 0 ? "notified" : "failed";
  const final = await updateSosStatus(
    input.userId,
    sosId,
    finalStatus,
    delivery.notified > 0
      ? `Queued ${delivery.notified}/${delivery.total} emergency contacts`
      : "No emergency contacts could be queued"
  );

  return final;
}

export async function getSosEvent(userId: string, sosId: string) {
  const result = await pool.query(
    `SELECT *
     FROM sos_events
     WHERE id = $1::uuid
       AND user_id = $2::uuid
     LIMIT 1`,
    [sosId, userId]
  );

  if (!result.rows[0]) {
    throw new HttpError(404, "SOS event not found");
  }

  return formatSos(result.rows[0]);
}

export async function listMySosEvents(userId: string) {
  const result = await pool.query(
    `SELECT *
     FROM sos_events
     WHERE user_id = $1::uuid
     ORDER BY occurred_at DESC, created_at DESC
     LIMIT 100`,
    [userId]
  );

  return result.rows.map(formatSos);
}

export async function updateSosStatus(userId: string, sosId: string, nextStatus: SosStatus, note?: string | null) {
  const existing = await getSosEvent(userId, sosId);
  const allowed = allowedTransitions[existing.status] ?? [];
  if (!allowed.includes(nextStatus)) {
    throw new HttpError(400, `Invalid SOS status transition from ${existing.status} to ${nextStatus}`);
  }

  const timestampColumn =
    nextStatus === "acknowledged" ? "acknowledged_at" :
    nextStatus === "resolved" ? "resolved_at" :
    nextStatus === "cancelled" ? "cancelled_at" :
    nextStatus === "failed" ? "failed_at" :
    null;

  const result = await pool.query(
    `UPDATE sos_events
     SET status = $3,
         status_note = $4,
         updated_at = NOW()
         ${timestampColumn ? `, ${timestampColumn} = COALESCE(${timestampColumn}, NOW())` : ""}
     WHERE id = $1::uuid
       AND user_id = $2::uuid
     RETURNING *`,
    [sosId, userId, nextStatus, note ?? null]
  );

  return formatSos(result.rows[0]);
}

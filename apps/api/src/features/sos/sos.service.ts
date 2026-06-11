import { pool } from "../../db/pool";
import { HttpError } from "../../lib/httpError";
import { createNotification } from "../notifications/notifications.service";
import { buildSosSmsBody, isValidInternationalPhone, sendTwilioSms } from "./twilioSms.service";

export type SosStatus = "created" | "notifying" | "notified" | "acknowledged" | "resolved" | "cancelled" | "failed";
type ContactNotificationStatus = "success" | "partial" | "failed";

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
  full_name: string;
  name: string;
  phone: string | null;
  email: string | null;
  relationship: string | null;
  is_primary: boolean;
  is_active: boolean;
  contact_user_id: string | null;
  notify_by_sms: boolean;
  notify_by_email: boolean;
  notify_by_push: boolean;
  notify_on_sos: boolean;
  created_at: string;
  updated_at: string | null;
}

interface SosDeliverySummary {
  emergency_contacts_count: number;
  contacts_notified: number;
  notification_status: ContactNotificationStatus;
}

export interface SosResponse extends SosDeliverySummary {
  id: string;
  user_id: string | null;
  activity_id: string | null;
  latitude: number;
  longitude: number;
  message: string | null;
  occurred_at: string;
  status: SosStatus;
  status_note?: string | null;
  contact_count?: number;
  notified_contact_count?: number;
  emergency_contacts_notified?: number;
  created_at: string;
  updated_at?: string | null;
}

const allowedTransitions: Record<SosStatus, SosStatus[]> = {
  created: ["notifying", "notified", "acknowledged", "cancelled", "failed"],
  notifying: ["notified", "failed", "cancelled", "acknowledged"],
  notified: ["acknowledged", "resolved", "failed", "cancelled"],
  acknowledged: ["resolved", "cancelled", "failed"],
  resolved: [],
  cancelled: [],
  failed: ["notifying", "cancelled"],
};

const tableColumnCache = new Map<string, Set<string>>();

function toIsoString(value: string | Date | null | undefined): string {
  if (!value) {
    return new Date(0).toISOString();
  }

  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toBool(value: unknown, fallback = false): boolean {
  return value === undefined || value === null ? fallback : value === true;
}

function toNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function getTableColumns(tableName: string): Promise<Set<string>> {
  const cached = tableColumnCache.get(tableName);
  if (cached) return cached;

  const result = await pool.query<{ column_name: string }>(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = $1`,
    [tableName]
  );
  const columns = new Set(result.rows.map((row) => row.column_name));
  tableColumnCache.set(tableName, columns);
  return columns;
}

async function hasTable(tableName: string): Promise<boolean> {
  const columns = await getTableColumns(tableName);
  return columns.size > 0;
}

function selectIf(columns: Set<string>, column: string, fallbackSql: string, alias = column): string {
  return columns.has(column) ? column : `${fallbackSql} AS ${alias}`;
}

function formatContact(row: Record<string, any>): EmergencyContact {
  const fullName = row.full_name ?? row.name ?? "";
  return {
    id: row.id,
    user_id: row.user_id,
    full_name: fullName,
    name: row.name ?? fullName,
    phone: row.phone ?? null,
    email: row.email ?? null,
    relationship: row.relationship ?? null,
    is_primary: toBool(row.is_primary),
    is_active: row.is_active !== false,
    contact_user_id: row.contact_user_id ?? null,
    notify_by_sms: row.notify_by_sms !== false,
    notify_by_email: row.notify_by_email !== false,
    notify_by_push: row.notify_by_push !== false,
    notify_on_sos: row.notify_on_sos !== false,
    created_at: toIsoString(row.created_at),
    updated_at: row.updated_at ? toIsoString(row.updated_at) : null,
  };
}

function formatSos(row: Record<string, any>, delivery?: Partial<SosDeliverySummary>): SosResponse {
  const contactCount = toNumber(row.contact_count ?? delivery?.emergency_contacts_count);
  const notifiedCount = toNumber(row.notified_contact_count ?? row.emergency_contacts_notified ?? delivery?.contacts_notified);
  const notificationStatus = delivery?.notification_status
    ?? (contactCount === 0 || notifiedCount === 0 ? "failed" : notifiedCount < contactCount ? "partial" : "success");

  return {
    id: row.id,
    user_id: row.user_id ?? null,
    activity_id: row.activity_id ?? null,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    message: row.message ?? null,
    occurred_at: toIsoString(row.occurred_at),
    status: (row.status ?? "created") as SosStatus,
    status_note: row.status_note ?? null,
    contact_count: contactCount,
    notified_contact_count: notifiedCount,
    emergency_contacts_notified: toNumber(row.emergency_contacts_notified ?? notifiedCount),
    emergency_contacts_count: delivery?.emergency_contacts_count ?? contactCount,
    contacts_notified: delivery?.contacts_notified ?? notifiedCount,
    notification_status: notificationStatus,
    created_at: toIsoString(row.created_at),
    updated_at: row.updated_at ? toIsoString(row.updated_at) : null,
  };
}

async function contactSelectSql(): Promise<string> {
  const columns = await getTableColumns("emergency_contacts");
  return [
    "id",
    "user_id",
    columns.has("full_name")
      ? "full_name"
      : columns.has("name")
        ? "name AS full_name"
        : "''::text AS full_name",
    columns.has("name")
      ? "name"
      : columns.has("full_name")
        ? "full_name AS name"
        : "''::text AS name",
    selectIf(columns, "phone", "NULL::text"),
    selectIf(columns, "email", "NULL::text"),
    selectIf(columns, "relationship", "NULL::text"),
    selectIf(columns, "is_primary", "false"),
    selectIf(columns, "is_active", "true"),
    selectIf(columns, "contact_user_id", "NULL::uuid"),
    selectIf(columns, "notify_by_sms", "true"),
    selectIf(columns, "notify_by_email", "true"),
    selectIf(columns, "notify_by_push", "true"),
    selectIf(columns, "notify_on_sos", "true"),
    selectIf(columns, "created_at", "NOW()"),
    selectIf(columns, "updated_at", "NULL::timestamptz"),
  ].join(", ");
}

async function sosSelectSql(): Promise<string> {
  const columns = await getTableColumns("sos_events");
  return [
    "id",
    selectIf(columns, "user_id", "NULL::uuid"),
    selectIf(columns, "activity_id", "NULL::uuid"),
    "latitude",
    "longitude",
    selectIf(columns, "message", "NULL::text"),
    selectIf(columns, "status", "'created'::text"),
    selectIf(columns, "status_note", "NULL::text"),
    selectIf(columns, "contact_count", "0"),
    selectIf(columns, "notified_contact_count", "0"),
    selectIf(columns, "emergency_contacts_notified", "0"),
    "occurred_at",
    selectIf(columns, "created_at", "NOW()"),
    selectIf(columns, "updated_at", "NULL::timestamptz"),
  ].join(", ");
}

async function findActiveDuplicateContact(userId: string, input: { full_name: string; phone?: string | null; email?: string | null }): Promise<boolean> {
  const columns = await getTableColumns("emergency_contacts");
  const nameColumn = columns.has("full_name") ? "full_name" : columns.has("name") ? "name" : null;
  const where = ["user_id = $1::uuid"];
  const values: unknown[] = [userId];

  if (columns.has("is_active")) {
    where.push("is_active = true");
  }

  if (input.email && columns.has("email")) {
    values.push(input.email);
    where.push(`lower(email) = lower($${values.length})`);
  } else if (input.phone && columns.has("phone")) {
    values.push(input.phone);
    where.push(`phone = $${values.length}`);
  } else if (nameColumn) {
    values.push(input.full_name);
    where.push(`lower(${nameColumn}) = lower($${values.length})`);
  } else {
    return false;
  }

  const result = await pool.query(`SELECT id FROM emergency_contacts WHERE ${where.join(" AND ")} LIMIT 1`, values);
  return Boolean(result.rows[0]);
}

export async function listEmergencyContacts(userId: string): Promise<EmergencyContact[]> {
  if (!(await hasTable("emergency_contacts"))) {
    return [];
  }

  const columns = await getTableColumns("emergency_contacts");
  const where = ["user_id = $1::uuid"];
  if (columns.has("is_active")) {
    where.push("is_active = true");
  }
  const orderParts = [
    columns.has("is_primary") ? "is_primary DESC" : null,
    columns.has("created_at") ? "created_at ASC" : "id ASC",
  ].filter(Boolean);

  const result = await pool.query(
    `SELECT ${await contactSelectSql()}
     FROM emergency_contacts
     WHERE ${where.join(" AND ")}
     ORDER BY ${orderParts.join(", ")}`,
    [userId]
  );

  return result.rows.map(formatContact);
}

export async function createEmergencyContact(userId: string, input: {
  full_name: string;
  name?: string;
  phone?: string | null;
  email?: string | null;
  relationship?: string | null;
  is_primary?: boolean;
  contact_user_id?: string | null;
  notify_by_sms?: boolean;
  notify_by_email?: boolean;
  notify_by_push?: boolean;
  notify_on_sos?: boolean;
}): Promise<EmergencyContact> {
  if (!(await hasTable("emergency_contacts"))) {
    throw new HttpError(500, "Emergency contacts table is not available");
  }

  const fullName = input.full_name ?? input.name ?? "";
  if (await findActiveDuplicateContact(userId, { full_name: fullName, phone: input.phone, email: input.email })) {
    throw new HttpError(409, "Duplicate emergency contact");
  }

  const columns = await getTableColumns("emergency_contacts");
  const insertColumns = ["user_id"];
  const values: unknown[] = [userId];
  const placeholders = ["$1::uuid"];

  const addColumn = (column: string, value: unknown, cast = "") => {
    if (!columns.has(column)) return;
    values.push(value);
    insertColumns.push(column);
    placeholders.push(`$${values.length}${cast}`);
  };

  addColumn("full_name", fullName);
  addColumn("name", fullName);
  addColumn("phone", input.phone ?? null);
  addColumn("email", input.email ?? null);
  addColumn("relationship", input.relationship ?? null);
  addColumn("is_primary", input.is_primary ?? false);
  addColumn("contact_user_id", input.contact_user_id ?? null, "::uuid");
  addColumn("notify_by_sms", input.notify_by_sms ?? true);
  addColumn("notify_by_email", input.notify_by_email ?? true);
  addColumn("notify_by_push", input.notify_by_push ?? true);
  addColumn("notify_on_sos", input.notify_on_sos ?? true);
  addColumn("is_active", true);

  const result = await pool.query(
    `INSERT INTO emergency_contacts (${insertColumns.join(", ")})
     VALUES (${placeholders.join(", ")})
     RETURNING ${await contactSelectSql()}`,
    values
  );

  return formatContact(result.rows[0]);
}

export async function updateEmergencyContact(userId: string, contactId: string, input: Partial<{
  full_name: string;
  name: string;
  phone: string | null;
  email: string | null;
  relationship: string | null;
  is_primary: boolean;
  is_active: boolean;
  contact_user_id: string | null;
  notify_by_sms: boolean;
  notify_by_email: boolean;
  notify_by_push: boolean;
  notify_on_sos: boolean;
}>): Promise<EmergencyContact> {
  const columns = await getTableColumns("emergency_contacts");
  const updates: string[] = [];
  const values: unknown[] = [contactId, userId];

  const addUpdate = (column: string, value: unknown, cast = "") => {
    if (!columns.has(column)) return;
    values.push(value);
    updates.push(`${column} = $${values.length}${cast}`);
  };

  if (Object.prototype.hasOwnProperty.call(input, "full_name") || Object.prototype.hasOwnProperty.call(input, "name")) {
    const fullName = input.full_name ?? input.name;
    addUpdate("full_name", fullName);
    addUpdate("name", fullName);
  }
  if (Object.prototype.hasOwnProperty.call(input, "phone")) addUpdate("phone", input.phone ?? null);
  if (Object.prototype.hasOwnProperty.call(input, "email")) addUpdate("email", input.email ?? null);
  if (Object.prototype.hasOwnProperty.call(input, "relationship")) addUpdate("relationship", input.relationship ?? null);
  if (Object.prototype.hasOwnProperty.call(input, "is_primary")) addUpdate("is_primary", input.is_primary ?? false);
  if (Object.prototype.hasOwnProperty.call(input, "is_active")) addUpdate("is_active", input.is_active ?? true);
  if (Object.prototype.hasOwnProperty.call(input, "contact_user_id")) addUpdate("contact_user_id", input.contact_user_id ?? null, "::uuid");
  if (Object.prototype.hasOwnProperty.call(input, "notify_by_sms")) addUpdate("notify_by_sms", input.notify_by_sms ?? true);
  if (Object.prototype.hasOwnProperty.call(input, "notify_by_email")) addUpdate("notify_by_email", input.notify_by_email ?? true);
  if (Object.prototype.hasOwnProperty.call(input, "notify_by_push")) addUpdate("notify_by_push", input.notify_by_push ?? true);
  if (Object.prototype.hasOwnProperty.call(input, "notify_on_sos")) addUpdate("notify_on_sos", input.notify_on_sos ?? true);
  if (columns.has("updated_at")) updates.push("updated_at = NOW()");

  if (updates.length === 0) {
    throw new HttpError(400, "No supported emergency contact fields provided");
  }

  const result = await pool.query(
    `UPDATE emergency_contacts
     SET ${updates.join(", ")}
     WHERE id = $1::uuid
       AND user_id = $2::uuid
     RETURNING ${await contactSelectSql()}`,
    values
  );

  if (!result.rows[0]) {
    throw new HttpError(404, "Emergency contact not found");
  }

  return formatContact(result.rows[0]);
}

export async function deleteEmergencyContact(userId: string, contactId: string): Promise<void> {
  const columns = await getTableColumns("emergency_contacts");
  const result = columns.has("is_active")
    ? await pool.query(
        `UPDATE emergency_contacts
         SET is_active = false${columns.has("updated_at") ? ", updated_at = NOW()" : ""}
         WHERE id = $1::uuid
           AND user_id = $2::uuid`,
        [contactId, userId]
      )
    : await pool.query(
        `DELETE FROM emergency_contacts
         WHERE id = $1::uuid
           AND user_id = $2::uuid`,
        [contactId, userId]
      );

  if ((result.rowCount ?? 0) === 0) {
    throw new HttpError(404, "Emergency contact not found");
  }
}

async function recordSosContactDelivery(input: {
  sosId: string;
  contactId: string;
  userId?: string | null;
  recipientUserId?: string | null;
  channel: "sms" | "email" | "push" | "in_app_message";
  provider?: string | null;
  recipientPhone?: string | null;
  recipientEmail?: string | null;
  status: "queued" | "sent" | "failed" | "skipped";
  notificationId?: string | null;
  providerMessageId?: string | null;
  error?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    if (!(await hasTable("sos_contact_notifications"))) {
      return;
    }

    const columns = await getTableColumns("sos_contact_notifications");
    const insertColumns = ["sos_event_id", "contact_id", "channel", "status"];
    const values: unknown[] = [input.sosId, input.contactId, input.channel, input.status];
    const placeholders = ["$1::uuid", "$2::uuid", "$3", "$4"];

    const addColumn = (column: string, value: unknown, cast = "") => {
      if (!columns.has(column)) return;
      values.push(value);
      insertColumns.push(column);
      placeholders.push(`$${values.length}${cast}`);
    };

    addColumn("user_id", input.userId ?? null, "::uuid");
    addColumn("recipient_user_id", input.recipientUserId ?? null, "::uuid");
    addColumn("notification_id", input.notificationId ?? null, "::uuid");
    addColumn("provider", input.provider ?? null);
    addColumn("recipient_phone", input.recipientPhone ?? null);
    addColumn("recipient_email", input.recipientEmail ?? null);
    addColumn("provider_message_id", input.providerMessageId ?? null);
    addColumn("metadata", JSON.stringify(input.metadata ?? {}), "::jsonb");
    addColumn("error", input.error ?? null);
    if (columns.has("updated_at")) {
      insertColumns.push("updated_at");
      placeholders.push("NOW()");
    }

    const conflictTarget = columns.has("sos_event_id") && columns.has("contact_id") && columns.has("channel")
      ? " ON CONFLICT (sos_event_id, contact_id, channel) DO UPDATE SET status = EXCLUDED.status"
      : "";
    const updateParts = [
      columns.has("user_id") ? "user_id = EXCLUDED.user_id" : null,
      columns.has("recipient_user_id") ? "recipient_user_id = EXCLUDED.recipient_user_id" : null,
      columns.has("notification_id") ? "notification_id = EXCLUDED.notification_id" : null,
      columns.has("provider") ? "provider = EXCLUDED.provider" : null,
      columns.has("recipient_phone") ? "recipient_phone = EXCLUDED.recipient_phone" : null,
      columns.has("recipient_email") ? "recipient_email = EXCLUDED.recipient_email" : null,
      columns.has("provider_message_id") ? "provider_message_id = EXCLUDED.provider_message_id" : null,
      columns.has("metadata") ? "metadata = COALESCE(sos_contact_notifications.metadata, '{}'::jsonb) || EXCLUDED.metadata" : null,
      columns.has("error") ? "error = EXCLUDED.error" : null,
      columns.has("updated_at") ? "updated_at = NOW()" : null,
    ].filter(Boolean);

    await pool.query(
      `INSERT INTO sos_contact_notifications (${insertColumns.join(", ")})
       VALUES (${placeholders.join(", ")})
       ${conflictTarget}${conflictTarget && updateParts.length ? `, ${updateParts.join(", ")}` : ""}`,
      values
    );
  } catch (error) {
    console.warn("[sos.recordSosContactDelivery] failed:", error);
  }
}

async function getSosUserDisplayName(userId: string): Promise<string> {
  try {
    const profileColumns = await getTableColumns("profiles");
    const nameCandidates = [
      profileColumns.has("full_name") ? "NULLIF(full_name, '')" : null,
      profileColumns.has("username") ? "NULLIF(username, '')" : null,
      profileColumns.has("handle") ? "NULLIF(handle, '')" : null,
    ].filter(Boolean);
    const nameExpression = nameCandidates.length > 0
      ? `COALESCE(${nameCandidates.join(", ")}, 'A Traces user')`
      : "'A Traces user'";
    const result = await pool.query<{ display_name: string | null }>(
      `SELECT ${nameExpression} AS display_name
       FROM profiles
       WHERE id = $1::uuid OR user_id = $1::uuid
       LIMIT 1`,
      [userId]
    );

    return result.rows[0]?.display_name ?? "A Traces user";
  } catch (error) {
    console.warn("[sos.getSosUserDisplayName] failed:", error);
    return "A Traces user";
  }
}

async function notifyAdminsBestEffort(sosId: string, input: CreateSosInput): Promise<void> {
  try {
    const profileColumns = await getTableColumns("profiles");
    if (!profileColumns.has("role")) {
      return;
    }

    const result = await pool.query<{ id: string }>(
      `SELECT id
       FROM profiles
       WHERE role = 'admin'
         AND id <> $1::uuid`,
      [input.userId]
    );

    for (const admin of result.rows) {
      await createNotification({
        user_id: admin.id,
        actor_id: input.userId,
        type: "sos_alert",
        title: "Emergency SOS triggered",
        body: "A Traces user triggered an SOS alert.",
        entity_type: "sos",
        entity_id: sosId,
        data: {
          sos_event_id: sosId,
          latitude: input.latitude,
          longitude: input.longitude,
          occurred_at: input.occurredAt,
        },
      });
    }
  } catch (error) {
    console.warn("[sos.notifyAdminsBestEffort] failed:", error);
  }
}

async function notifyEmergencyContactBestEffort(sosId: string, contact: EmergencyContact, input: CreateSosInput): Promise<boolean> {
  const userName = await getSosUserDisplayName(input.userId);
  const metadata = {
    sos_event_id: sosId,
    contact_id: contact.id,
    latitude: input.latitude,
    longitude: input.longitude,
    occurred_at: input.occurredAt,
    phone_present: Boolean(contact.phone),
    email_present: Boolean(contact.email),
  };

  let sent = false;

  if (contact.phone) {
    if (!isValidInternationalPhone(contact.phone)) {
      await recordSosContactDelivery({
        sosId,
        contactId: contact.id,
        userId: input.userId,
        channel: "sms",
        provider: "twilio",
        recipientPhone: contact.phone,
        status: "skipped",
        error: "Emergency contact phone is not in international format",
        metadata,
      });
    } else {
      const smsResult = await sendTwilioSms(contact.phone, buildSosSmsBody({
        userName,
        latitude: input.latitude,
        longitude: input.longitude,
        message: input.message,
      }));
      await recordSosContactDelivery({
        sosId,
        contactId: contact.id,
        userId: input.userId,
        channel: "sms",
        provider: smsResult.provider,
        recipientPhone: contact.phone,
        status: smsResult.status,
        providerMessageId: smsResult.provider_message_id,
        error: smsResult.error,
        metadata,
      });
      sent = smsResult.status === "sent";
    }
  } else {
    await recordSosContactDelivery({
      sosId,
      contactId: contact.id,
      userId: input.userId,
      channel: "sms",
      provider: "twilio",
      status: "skipped",
      error: "Emergency contact has no phone number",
      metadata,
    });
  }

  if (contact.contact_user_id && contact.contact_user_id !== input.userId) {
    try {
      const notification = await createNotification({
        user_id: contact.contact_user_id,
        actor_id: input.userId,
        type: "emergency_contact_alert",
        title: "Emergency SOS",
        body: `${contact.full_name}, an emergency contact triggered SOS and may need help.`,
        entity_type: "sos",
        entity_id: sosId,
        data: metadata,
      });
      await recordSosContactDelivery({
        sosId,
        contactId: contact.id,
        userId: input.userId,
        recipientUserId: contact.contact_user_id,
        channel: "in_app_message",
        status: "sent",
        notificationId: notification.id,
        metadata,
      });
      return true;
    } catch (error) {
      await recordSosContactDelivery({
        sosId,
        contactId: contact.id,
        userId: input.userId,
        recipientUserId: contact.contact_user_id,
        channel: "in_app_message",
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
        metadata,
      });
    }
  }

  if (contact.email) {
    await recordSosContactDelivery({
      sosId,
      contactId: contact.id,
      userId: input.userId,
      channel: "email",
      recipientEmail: contact.email,
      status: "skipped",
      error: "External email provider is not configured",
      metadata,
    });
  }

  return sent;
}

async function notifyEmergencyContactsBestEffort(sosId: string, input: CreateSosInput): Promise<SosDeliverySummary> {
  try {
    const contacts = (await listEmergencyContacts(input.userId)).filter((contact) => contact.is_active && contact.notify_on_sos);
    let notified = 0;

    for (const contact of contacts) {
      try {
        if (await notifyEmergencyContactBestEffort(sosId, contact, input)) {
          notified += 1;
        }
      } catch (error) {
        console.warn("[sos.notifyEmergencyContactsBestEffort] contact failed:", { contactId: contact.id, error });
      }
    }

    const notification_status: ContactNotificationStatus =
      contacts.length === 0 || notified === 0 ? "failed" : notified < contacts.length ? "partial" : "success";

    return {
      emergency_contacts_count: contacts.length,
      contacts_notified: notified,
      notification_status,
    };
  } catch (error) {
    console.warn("[sos.notifyEmergencyContactsBestEffort] failed:", error);
    return { emergency_contacts_count: 0, contacts_notified: 0, notification_status: "failed" };
  }
}

async function updateSosDeliveryColumns(sosId: string, delivery: SosDeliverySummary): Promise<void> {
  try {
    const columns = await getTableColumns("sos_events");
    const updates: string[] = [];
    const values: unknown[] = [sosId];

    const add = (column: string, value: unknown) => {
      if (!columns.has(column)) return;
      values.push(value);
      updates.push(`${column} = $${values.length}`);
    };

    add("contact_count", delivery.emergency_contacts_count);
    add("notified_contact_count", delivery.contacts_notified);
    add("emergency_contacts_notified", delivery.contacts_notified);
    if (columns.has("updated_at")) updates.push("updated_at = NOW()");

    if (updates.length === 0) return;

    await pool.query(
      `UPDATE sos_events
       SET ${updates.join(", ")}
       WHERE id = $1::uuid`,
      values
    );
  } catch (error) {
    console.warn("[sos.updateSosDeliveryColumns] failed:", error);
  }
}

export async function createSosEvent(input: CreateSosInput): Promise<SosResponse> {
  const columns = await getTableColumns("sos_events");
  const insertColumns = ["latitude", "longitude", "occurred_at"];
  const values: unknown[] = [input.latitude, input.longitude, input.occurredAt];
  const placeholders = ["$1", "$2", "$3::timestamptz"];

  const addColumn = (column: string, value: unknown, cast = "") => {
    if (!columns.has(column)) return;
    values.push(value);
    insertColumns.push(column);
    placeholders.push(`$${values.length}${cast}`);
  };

  addColumn("user_id", input.userId, "::uuid");
  addColumn("activity_id", input.activityId ?? null, "::uuid");
  addColumn("message", input.message ?? null);
  addColumn("status", "created");
  if (columns.has("created_at")) {
    insertColumns.push("created_at");
    placeholders.push("NOW()");
  }
  if (columns.has("updated_at")) {
    insertColumns.push("updated_at");
    placeholders.push("NOW()");
  }

  const initialResult = await pool.query(
    `INSERT INTO sos_events (${insertColumns.join(", ")})
     VALUES (${placeholders.join(", ")})
     RETURNING ${await sosSelectSql()}`,
    values
  );

  const sosId = initialResult.rows[0].id;

  await notifyAdminsBestEffort(sosId, input);
  const delivery = await notifyEmergencyContactsBestEffort(sosId, input);
  await updateSosDeliveryColumns(sosId, delivery);

  if (columns.has("status")) {
    const nextStatus: SosStatus = delivery.contacts_notified > 0 ? "notified" : "failed";
    try {
      await updateSosStatus(input.userId, sosId, nextStatus, `Emergency contact notification status: ${delivery.notification_status}`);
    } catch (error) {
      console.warn("[sos.createSosEvent] status update failed:", error);
    }
  }

  const finalResult = await pool.query(
    `SELECT ${await sosSelectSql()}
     FROM sos_events
     WHERE id = $1::uuid
     LIMIT 1`,
    [sosId]
  );

  return formatSos(finalResult.rows[0] ?? initialResult.rows[0], delivery);
}

export async function getSosEvent(userId: string, sosId: string): Promise<SosResponse> {
  const result = await pool.query(
    `SELECT ${await sosSelectSql()}
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

export async function listMySosEvents(userId: string): Promise<SosResponse[]> {
  const columns = await getTableColumns("sos_events");
  const orderBy = columns.has("occurred_at")
    ? `occurred_at DESC${columns.has("created_at") ? ", created_at DESC" : ""}`
    : columns.has("created_at")
      ? "created_at DESC"
      : "id DESC";

  const result = await pool.query(
    `SELECT ${await sosSelectSql()}
     FROM sos_events
     WHERE user_id = $1::uuid
     ORDER BY ${orderBy}
     LIMIT 100`,
    [userId]
  );

  return result.rows.map((row) => formatSos(row));
}

export async function updateSosStatus(userId: string, sosId: string, nextStatus: SosStatus, note?: string | null): Promise<SosResponse> {
  const existing = await getSosEvent(userId, sosId);
  const allowed = allowedTransitions[existing.status] ?? [];
  if (!allowed.includes(nextStatus)) {
    throw new HttpError(400, `Invalid SOS status transition from ${existing.status} to ${nextStatus}`);
  }

  const columns = await getTableColumns("sos_events");
  const updates: string[] = [];
  const values: unknown[] = [sosId, userId];

  if (columns.has("status")) {
    values.push(nextStatus);
    updates.push(`status = $${values.length}`);
  }
  if (columns.has("status_note")) {
    values.push(note ?? null);
    updates.push(`status_note = $${values.length}`);
  }
  const timestampColumn =
    nextStatus === "acknowledged" ? "acknowledged_at" :
    nextStatus === "resolved" ? "resolved_at" :
    nextStatus === "cancelled" ? "cancelled_at" :
    nextStatus === "failed" ? "failed_at" :
    null;
  if (timestampColumn && columns.has(timestampColumn)) {
    updates.push(`${timestampColumn} = COALESCE(${timestampColumn}, NOW())`);
  }
  if (columns.has("updated_at")) {
    updates.push("updated_at = NOW()");
  }

  if (updates.length === 0) {
    return existing;
  }

  const result = await pool.query(
    `UPDATE sos_events
     SET ${updates.join(", ")}
     WHERE id = $1::uuid
       AND user_id = $2::uuid
     RETURNING ${await sosSelectSql()}`,
    values
  );

  return formatSos(result.rows[0]);
}

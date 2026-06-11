import { pool } from "../../db/pool";
import { createNotification } from "../notifications/notifications.service";

type ConversationType = "direct" | "meetup" | "trail" | "activity" | "safety";
type Queryable = {
  query: (queryText: string, values?: unknown[]) => Promise<unknown>;
};

const sharedConversationTypes = new Set<ConversationType>(["meetup", "trail"]);

export interface CreateConversationInput {
  type: ConversationType;
  participant_ids: string[];
  context_type?: string | null;
  context_id?: string | null;
  title?: string | null;
}

export interface Conversation {
  id: string;
  type: ConversationType;
  context_type: string | null;
  context_id: string | null;
  title: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  participants: Array<{
    user_id: string;
    full_name: string | null;
    avatar_url: string | null;
    last_read_at: string | null;
  }>;
  last_message: Message | null;
  unread_count: number;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  };
  content: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
}

interface ConversationRow {
  id: string;
  type: ConversationType;
  context_type: string | null;
  context_id: string | null;
  title: string | null;
  created_by: string | null;
  created_at: string | Date;
  updated_at: string | Date;
  participants: Array<{
    user_id: string;
    full_name: string | null;
    avatar_url: string | null;
    last_read_at: string | Date | null;
  }> | null;
  last_message: MessageRow | null;
  unread_count: number | string | null;
}

interface MessageRow {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_full_name: string | null;
  sender_avatar_url: string | null;
  content: string;
  metadata: Record<string, unknown> | null;
  created_at: string | Date;
  edited_at: string | Date | null;
  deleted_at: string | Date | null;
}

interface ConversationMessageNotificationRow {
  conversation_id: string;
  conversation_type: ConversationType;
  context_type: string | null;
  context_id: string | null;
  conversation_title: string | null;
  sender_profile_id: string;
  sender_user_id: string | null;
  sender_full_name: string | null;
  sender_avatar_url: string | null;
}

interface ConversationMessageRecipientRow {
  recipient_profile_id: string;
  recipient_user_id: string | null;
}

interface NotificationEntityReference {
  entityType: string | null;
  entityId: string | null;
}

export class ProfileResolutionError extends Error {
  unresolvedIds: string[];

  constructor(unresolvedIds: string[]) {
    super("One or more conversation participants could not be resolved to profiles");
    this.name = "ProfileResolutionError";
    this.unresolvedIds = unresolvedIds;
  }
}

function isSharedConversationType(type: ConversationType): boolean {
  return sharedConversationTypes.has(type);
}

function isUniqueViolation(error: unknown): error is { code: string } {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "23505";
}

function toIsoString(value: string | Date | null | undefined): string | null {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function uniqueIds(ids: string[]): string[] {
  return Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
}

function truncateMessagePreview(content: string, maxLength = 140): string {
  const normalized = content.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}...`;
}

function formatMessage(row: MessageRow): Message {
  return {
    id: row.id,
    conversation_id: row.conversation_id,
    sender_id: row.sender_id,
    sender: {
      id: row.sender_id,
      full_name: row.sender_full_name,
      avatar_url: row.sender_avatar_url,
    },
    content: row.content,
    metadata: row.metadata ?? null,
    created_at: toIsoString(row.created_at) ?? new Date().toISOString(),
    edited_at: toIsoString(row.edited_at),
    deleted_at: toIsoString(row.deleted_at),
  };
}

function formatConversation(row: ConversationRow): Conversation {
  return {
    id: row.id,
    type: row.type,
    context_type: row.context_type,
    context_id: row.context_id,
    title: row.title,
    created_by: row.created_by,
    created_at: toIsoString(row.created_at) ?? new Date().toISOString(),
    updated_at: toIsoString(row.updated_at) ?? new Date().toISOString(),
    participants: (row.participants ?? []).map((participant) => ({
      user_id: participant.user_id,
      full_name: participant.full_name,
      avatar_url: participant.avatar_url,
      last_read_at: toIsoString(participant.last_read_at),
    })),
    last_message: row.last_message ? formatMessage(row.last_message) : null,
    unread_count: Number(row.unread_count ?? 0),
  };
}

function buildConversationNotificationTitle(
  senderName: string,
  conversationType: ConversationType,
  conversationTitle: string | null
): string {
  if (conversationType === "direct") {
    return senderName;
  }

  if (conversationTitle?.trim()) {
    return `${senderName} in ${conversationTitle.trim()}`;
  }

  return `New ${conversationType} message from ${senderName}`;
}

function resolveMessageNotificationEntity(
  conversationType: ConversationType,
  contextType: string | null,
  contextId: string | null
): NotificationEntityReference {
  const candidateType = (contextType ?? conversationType).trim();

  if (
    contextId &&
    (
      candidateType === "trail" ||
      candidateType === "activity" ||
      candidateType === "meetup" ||
      candidateType === "achievement" ||
      candidateType === "challenge" ||
      candidateType === "review" ||
      candidateType === "user"
    )
  ) {
    return {
      entityType: candidateType,
      entityId: contextId,
    };
  }

  return {
    entityType: null,
    entityId: null,
  };
}

export async function getProfileIdForAuthUser(userId: string): Promise<string> {
  const result = await pool.query<{ id: string }>(
    `SELECT id
     FROM profiles
     WHERE id = $1::uuid OR user_id = $1::uuid
     LIMIT 1`,
    [userId]
  );
  const profileId = result.rows[0]?.id;

  if (!profileId) {
    throw new Error("Profile not found");
  }

  return profileId;
}

async function resolveProfileIds(userIds: string[]): Promise<{ resolvedIds: string[]; unresolvedIds: string[] }> {
  const ids = uniqueIds(userIds);
  if (ids.length === 0) {
    return { resolvedIds: [], unresolvedIds: [] };
  }

  const result = await pool.query<{ id: string; user_id: string | null }>(
    `SELECT id, user_id
     FROM profiles
     WHERE id = ANY($1::uuid[])
        OR user_id = ANY($1::uuid[])`,
    [ids]
  );

  const profileIdByInputId = new Map<string, string>();
  for (const row of result.rows) {
    profileIdByInputId.set(row.id.toLowerCase(), row.id);
    if (row.user_id) {
      profileIdByInputId.set(row.user_id.toLowerCase(), row.id);
    }
  }

  const resolvedIds: string[] = [];
  const unresolvedIds: string[] = [];
  for (const id of ids) {
    const profileId = profileIdByInputId.get(id.toLowerCase());
    if (profileId) {
      resolvedIds.push(profileId);
    } else {
      unresolvedIds.push(id);
    }
  }

  return {
    resolvedIds: uniqueIds(resolvedIds),
    unresolvedIds,
  };
}

async function assertProfileIdsExist(profileIds: string[]): Promise<void> {
  const ids = uniqueIds(profileIds);
  const result = await pool.query<{ id: string }>(
    `SELECT id
     FROM profiles
     WHERE id = ANY($1::uuid[])`,
    [ids]
  );
  const existingIds = new Set(result.rows.map((row) => row.id.toLowerCase()));
  const missingIds = ids.filter((id) => !existingIds.has(id.toLowerCase()));

  if (missingIds.length > 0) {
    throw new ProfileResolutionError(missingIds);
  }
}

async function addConversationParticipants(executor: Queryable, conversationId: string, participantIds: string[]): Promise<void> {
  for (const participantId of uniqueIds(participantIds)) {
    await executor.query(
      `INSERT INTO conversation_participants (conversation_id, user_id)
       VALUES ($1::uuid, $2::uuid)
       ON CONFLICT (conversation_id, user_id) DO NOTHING`,
      [conversationId, participantId]
    );
  }
}

async function findSharedConversation(type: ConversationType, contextId: string): Promise<string | null> {
  const result = await pool.query<{ id: string }>(
    `SELECT id
     FROM conversations
     WHERE type = $1
       AND context_id = $2::uuid
     ORDER BY created_at ASC, id ASC
     LIMIT 1`,
    [type, contextId]
  );

  return result.rows[0]?.id ?? null;
}

async function getMeetupConversationParticipantIds(meetupId: string): Promise<string[]> {
  const result = await pool.query<{ user_id: string }>(
    `SELECT DISTINCT user_id
     FROM (
       SELECT m.host_id AS user_id
       FROM meetups m
       WHERE m.id = $1::uuid
         AND m.deleted_at IS NULL

       UNION

       SELECT ma.user_id
       FROM meetup_attendees ma
       JOIN meetups m ON m.id = ma.meetup_id
       WHERE ma.meetup_id = $1::uuid
         AND ma.status IN ('joined', 'invited')
         AND m.deleted_at IS NULL

       UNION

       SELECT mi.invitee_id AS user_id
       FROM meetup_invites mi
       JOIN meetups m ON m.id = mi.meetup_id
       WHERE mi.meetup_id = $1::uuid
         AND mi.status IN ('pending', 'accepted')
         AND m.deleted_at IS NULL
     ) meetup_users`,
    [meetupId]
  );

  if (result.rows.length === 0) {
    throw new Error("Meetup not found");
  }

  return uniqueIds(result.rows.map((row) => row.user_id));
}

export async function isConversationParticipant(conversationId: string, profileId: string): Promise<boolean> {
  const result = await pool.query<{ id: string }>(
    `SELECT id
     FROM conversation_participants
     WHERE conversation_id = $1::uuid
       AND user_id = $2::uuid
     LIMIT 1`,
    [conversationId, profileId]
  );

  return Boolean(result.rows[0]);
}

async function getConversationById(conversationId: string, profileId: string): Promise<Conversation | null> {
  const result = await pool.query<ConversationRow>(
    `SELECT
       c.id,
       c.type,
       c.context_type,
       c.context_id,
       c.title,
       c.created_by,
       c.created_at,
       c.updated_at,
       COALESCE(participants.participants, '[]'::json) AS participants,
       to_json(last_message.*) AS last_message,
       COALESCE(unread.unread_count, 0)::int AS unread_count
     FROM conversations c
     JOIN conversation_participants viewer
       ON viewer.conversation_id = c.id
      AND viewer.user_id = $2::uuid
     LEFT JOIN LATERAL (
       SELECT json_agg(
         json_build_object(
           'user_id', cp.user_id,
           'full_name', p.full_name,
           'avatar_url', p.avatar_url,
           'last_read_at', cp.last_read_at
         )
         ORDER BY p.full_name NULLS LAST, cp.joined_at ASC
       ) AS participants
       FROM conversation_participants cp
       LEFT JOIN profiles p ON p.id = cp.user_id
       WHERE cp.conversation_id = c.id
     ) participants ON TRUE
     LEFT JOIN LATERAL (
       SELECT m.id, m.conversation_id, m.sender_id, sp.full_name AS sender_full_name,
              sp.avatar_url AS sender_avatar_url, m.content, COALESCE(m.metadata, '{}'::jsonb) AS metadata, m.created_at, m.edited_at, m.deleted_at
       FROM messages m
       LEFT JOIN profiles sp ON sp.id = m.sender_id
       WHERE m.conversation_id = c.id
         AND m.deleted_at IS NULL
       ORDER BY m.created_at DESC
       LIMIT 1
     ) last_message ON TRUE
     LEFT JOIN LATERAL (
       SELECT COUNT(*)::int AS unread_count
       FROM messages m
       WHERE m.conversation_id = c.id
         AND m.deleted_at IS NULL
         AND m.sender_id <> viewer.user_id
         AND (
           viewer.last_read_at IS NULL
           OR m.created_at > viewer.last_read_at
         )
     ) unread ON TRUE
     WHERE c.id = $1::uuid
     LIMIT 1`,
    [conversationId, profileId]
  );

  return result.rows[0] ? formatConversation(result.rows[0]) : null;
}

async function findDirectConversation(profileIds: string[]): Promise<string | null> {
  if (profileIds.length !== 2) {
    return null;
  }

  const result = await pool.query<{ conversation_id: string }>(
    `SELECT cp.conversation_id
     FROM conversation_participants cp
     JOIN conversations c ON c.id = cp.conversation_id
     WHERE c.type = 'direct'
       AND cp.user_id = ANY($1::uuid[])
     GROUP BY cp.conversation_id
     HAVING COUNT(DISTINCT cp.user_id) = 2
        AND (
          SELECT COUNT(*)
          FROM conversation_participants all_cp
          WHERE all_cp.conversation_id = cp.conversation_id
        ) = 2
     LIMIT 1`,
    [profileIds]
  );

  return result.rows[0]?.conversation_id ?? null;
}

export async function createConversation(userId: string, input: CreateConversationInput): Promise<Conversation> {
  const creatorProfileId = await getProfileIdForAuthUser(userId);
  const resolvedParticipants = await resolveProfileIds(input.participant_ids);

  if (resolvedParticipants.unresolvedIds.length > 0) {
    console.warn("[messages.service] Unresolved conversation participant IDs:", resolvedParticipants.unresolvedIds);
    throw new ProfileResolutionError(resolvedParticipants.unresolvedIds);
  }

  if (isSharedConversationType(input.type) && !input.context_id) {
    throw new Error(`${input.type[0].toUpperCase()}${input.type.slice(1)} conversations require a context_id`);
  }

  let participantIds = uniqueIds([creatorProfileId, ...resolvedParticipants.resolvedIds]);
  if (input.type === "meetup" && input.context_id) {
    participantIds = uniqueIds([
      ...participantIds,
      ...(await getMeetupConversationParticipantIds(input.context_id)),
    ]);
  }

  await assertProfileIdsExist(participantIds);

  if (input.type === "direct" && participantIds.length !== 2) {
    throw new Error("Direct conversations require exactly two participants");
  }

  if (participantIds.length === 0) {
    throw new Error("At least one participant is required");
  }

  const existingDirectConversationId = input.type === "direct" ? await findDirectConversation(participantIds) : null;
  if (existingDirectConversationId) {
    const existingConversation = await getConversationById(existingDirectConversationId, creatorProfileId);
    if (existingConversation) {
      return existingConversation;
    }
  }

  const existingSharedConversationId =
    isSharedConversationType(input.type) && input.context_id
      ? await findSharedConversation(input.type, input.context_id)
      : null;

  if (existingSharedConversationId) {
    await addConversationParticipants(pool, existingSharedConversationId, participantIds);
    const existingConversation = await getConversationById(existingSharedConversationId, creatorProfileId);
    if (existingConversation) {
      return existingConversation;
    }
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const conversationResult = await client.query<{ id: string }>(
      `INSERT INTO conversations (type, context_type, context_id, title, created_by, updated_at)
       VALUES ($1, $2, $3::uuid, $4, $5::uuid, NOW())
       RETURNING id`,
      [
        input.type,
        input.context_type ?? (input.type === "direct" ? null : input.type),
        input.context_id ?? null,
        input.title ?? null,
        creatorProfileId,
      ]
    );
    const conversationId = conversationResult.rows[0].id;

    await addConversationParticipants(client, conversationId, participantIds);

    await client.query("COMMIT");
    const conversation = await getConversationById(conversationId, creatorProfileId);
    if (!conversation) {
      throw new Error("Created conversation could not be loaded");
    }

    return conversation;
  } catch (error) {
    await client.query("ROLLBACK");

    if (isUniqueViolation(error) && isSharedConversationType(input.type) && input.context_id) {
      const sharedConversationId = await findSharedConversation(input.type, input.context_id);
      if (sharedConversationId) {
        await addConversationParticipants(pool, sharedConversationId, participantIds);
        const existingConversation = await getConversationById(sharedConversationId, creatorProfileId);
        if (existingConversation) {
          return existingConversation;
        }
      }
    }

    throw error;
  } finally {
    client.release();
  }
}

export async function listConversations(userId: string): Promise<Conversation[]> {
  const profileId = await getProfileIdForAuthUser(userId);
  const result = await pool.query<ConversationRow>(
    `SELECT
       c.id,
       c.type,
       c.context_type,
       c.context_id,
       c.title,
       c.created_by,
       c.created_at,
       c.updated_at,
       COALESCE(participants.participants, '[]'::json) AS participants,
       to_json(last_message.*) AS last_message,
       COALESCE(unread.unread_count, 0)::int AS unread_count
     FROM conversations c
     JOIN conversation_participants viewer
       ON viewer.conversation_id = c.id
      AND viewer.user_id = $1::uuid
     LEFT JOIN LATERAL (
       SELECT json_agg(
         json_build_object(
           'user_id', cp.user_id,
           'full_name', p.full_name,
           'avatar_url', p.avatar_url,
           'last_read_at', cp.last_read_at
         )
         ORDER BY p.full_name NULLS LAST, cp.joined_at ASC
       ) AS participants
       FROM conversation_participants cp
       LEFT JOIN profiles p ON p.id = cp.user_id
       WHERE cp.conversation_id = c.id
     ) participants ON TRUE
     LEFT JOIN LATERAL (
       SELECT m.id, m.conversation_id, m.sender_id, sp.full_name AS sender_full_name,
              sp.avatar_url AS sender_avatar_url, m.content, COALESCE(m.metadata, '{}'::jsonb) AS metadata, m.created_at, m.edited_at, m.deleted_at
       FROM messages m
       LEFT JOIN profiles sp ON sp.id = m.sender_id
       WHERE m.conversation_id = c.id
         AND m.deleted_at IS NULL
       ORDER BY m.created_at DESC
       LIMIT 1
     ) last_message ON TRUE
     LEFT JOIN LATERAL (
       SELECT COUNT(*)::int AS unread_count
       FROM messages m
       WHERE m.conversation_id = c.id
         AND m.deleted_at IS NULL
         AND m.sender_id <> viewer.user_id
         AND (
           viewer.last_read_at IS NULL
           OR m.created_at > viewer.last_read_at
         )
     ) unread ON TRUE
     ORDER BY COALESCE(last_message.created_at, c.updated_at, c.created_at) DESC`,
    [profileId]
  );

  return result.rows.map(formatConversation);
}

export async function getConversationMessages(
  userId: string,
  conversationId: string,
  limit = 50
): Promise<Message[]> {
  const profileId = await getProfileIdForAuthUser(userId);
  if (!(await isConversationParticipant(conversationId, profileId))) {
    throw new Error("Conversation not found");
  }

  const result = await pool.query<MessageRow>(
    `SELECT m.id, m.conversation_id, m.sender_id, p.full_name AS sender_full_name,
            p.avatar_url AS sender_avatar_url, m.content, COALESCE(m.metadata, '{}'::jsonb) AS metadata, m.created_at, m.edited_at, m.deleted_at
     FROM messages m
     LEFT JOIN profiles p ON p.id = m.sender_id
     WHERE m.conversation_id = $1::uuid
       AND m.deleted_at IS NULL
     ORDER BY m.created_at DESC
     LIMIT $2`,
    [conversationId, limit]
  );

  return result.rows.reverse().map(formatMessage);
}

export async function sendConversationMessage(
  userId: string,
  conversationId: string,
  content: string
): Promise<Message> {
  return sendConversationMessageWithMetadata(userId, conversationId, content, null);
}

export async function sendConversationMessageWithMetadata(
  userId: string,
  conversationId: string,
  content: string,
  metadata: Record<string, unknown> | null
): Promise<Message> {
  const profileId = await getProfileIdForAuthUser(userId);
  if (!(await isConversationParticipant(conversationId, profileId))) {
    throw new Error("Conversation not found");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query<MessageRow>(
      `INSERT INTO messages (conversation_id, sender_id, content, metadata)
       VALUES ($1::uuid, $2::uuid, $3, $4::jsonb)
       RETURNING id, conversation_id, sender_id, NULL::text AS sender_full_name,
                 NULL::text AS sender_avatar_url, content, metadata, created_at, edited_at, deleted_at`,
      [conversationId, profileId, content, JSON.stringify(metadata ?? {})]
    );
    await client.query("UPDATE conversations SET updated_at = NOW() WHERE id = $1::uuid", [conversationId]);
    await client.query(
      `UPDATE conversation_participants
       SET last_read_at = NOW()
       WHERE conversation_id = $1::uuid
         AND user_id = $2::uuid`,
      [conversationId, profileId]
    );
    await client.query("COMMIT");

    const messageResult = await pool.query<MessageRow>(
      `SELECT m.id, m.conversation_id, m.sender_id, p.full_name AS sender_full_name,
              p.avatar_url AS sender_avatar_url, m.content, COALESCE(m.metadata, '{}'::jsonb) AS metadata, m.created_at, m.edited_at, m.deleted_at
       FROM messages m
       LEFT JOIN profiles p ON p.id = m.sender_id
       WHERE m.id = $1::uuid`,
      [result.rows[0].id]
    );

    const message = formatMessage(messageResult.rows[0]);

    try {
      await createMessageNotifications(message);
    } catch (notificationError) {
      console.error("[messages.service] Failed to create message notifications:", notificationError);
    }

    return message;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getOrCreateDirectConversation(userId: string, contactUserId: string): Promise<Conversation> {
  return createConversation(userId, {
    type: "direct",
    participant_ids: [contactUserId],
  });
}

export async function markConversationRead(userId: string, conversationId: string): Promise<{ conversation_id: string; last_read_at: string; unread_count: number }> {
  const profileId = await getProfileIdForAuthUser(userId);
  const result = await pool.query<{ conversation_id: string; last_read_at: string | Date }>(
    `UPDATE conversation_participants
     SET last_read_at = NOW()
     WHERE conversation_id = $1::uuid
       AND user_id = $2::uuid
     RETURNING conversation_id, last_read_at`,
    [conversationId, profileId]
  );

  if (!result.rows[0]) {
    throw new Error("Conversation not found");
  }

  return {
    conversation_id: result.rows[0].conversation_id,
    last_read_at: toIsoString(result.rows[0].last_read_at) ?? new Date().toISOString(),
    unread_count: 0,
  };
}

async function createMessageNotifications(message: Message): Promise<void> {
  const conversationResult = await pool.query<ConversationMessageNotificationRow>(
    `SELECT
       c.id AS conversation_id,
       c.type AS conversation_type,
       c.context_type,
       c.context_id,
       c.title AS conversation_title,
       sender.id AS sender_profile_id,
       sender.user_id AS sender_user_id,
       sender.full_name AS sender_full_name,
       sender.avatar_url AS sender_avatar_url
     FROM conversations c
     JOIN profiles sender ON sender.id = $2::uuid
     WHERE c.id = $1::uuid
     LIMIT 1`,
    [message.conversation_id, message.sender_id]
  );

  const conversation = conversationResult.rows[0];
  if (!conversation) {
    return;
  }

  const recipientsResult = await pool.query<ConversationMessageRecipientRow>(
    `SELECT
       cp.user_id AS recipient_profile_id,
       recipient.user_id AS recipient_user_id
     FROM conversation_participants cp
     JOIN profiles recipient ON recipient.id = cp.user_id
     WHERE cp.conversation_id = $1::uuid
       AND cp.user_id <> $2::uuid
       AND recipient.user_id IS NOT NULL`,
    [message.conversation_id, message.sender_id]
  );

  if (recipientsResult.rows.length === 0) {
    return;
  }

  const senderName = conversation.sender_full_name?.trim() || "New message";
  const title = buildConversationNotificationTitle(
    senderName,
    conversation.conversation_type,
    conversation.conversation_title
  );
  const body = truncateMessagePreview(message.content);
  const entityReference = resolveMessageNotificationEntity(
    conversation.conversation_type,
    conversation.context_type,
    conversation.context_id
  );

  await Promise.all(
    recipientsResult.rows.map(async (recipient) => {
      if (!recipient.recipient_user_id) {
        return;
      }

      await createNotification({
        user_id: recipient.recipient_user_id,
        actor_id: conversation.sender_profile_id,
        type: "message",
        title,
        body,
        entity_type: entityReference.entityType,
        entity_id: entityReference.entityId,
        data: {
          conversation_id: conversation.conversation_id,
          conversation_type: conversation.conversation_type,
          context_type: conversation.context_type,
          context_id: conversation.context_id,
          context_title: conversation.conversation_title,
          message_id: message.id,
          sender_profile_id: conversation.sender_profile_id,
          sender_user_id: conversation.sender_user_id,
          sender_name: conversation.sender_full_name,
          sender_avatar_url: conversation.sender_avatar_url,
          notification_kind: "message",
        },
      });
    })
  );
}

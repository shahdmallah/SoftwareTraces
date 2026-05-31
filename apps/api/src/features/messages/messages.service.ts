import { pool } from "../../db/pool";

type ConversationType = "direct" | "meetup" | "trail" | "activity" | "safety";

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
  created_at: string | Date;
  edited_at: string | Date | null;
  deleted_at: string | Date | null;
}

export class ProfileResolutionError extends Error {
  unresolvedIds: string[];

  constructor(unresolvedIds: string[]) {
    super("One or more conversation participants could not be resolved to profiles");
    this.name = "ProfileResolutionError";
    this.unresolvedIds = unresolvedIds;
  }
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
              sp.avatar_url AS sender_avatar_url, m.content, m.created_at, m.edited_at, m.deleted_at
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

  const participantIds = uniqueIds([creatorProfileId, ...resolvedParticipants.resolvedIds]);
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

    for (const participantId of participantIds) {
      await client.query(
        `INSERT INTO conversation_participants (conversation_id, user_id)
         VALUES ($1::uuid, $2::uuid)
         ON CONFLICT (conversation_id, user_id) DO NOTHING`,
        [conversationId, participantId]
      );
    }

    await client.query("COMMIT");
    const conversation = await getConversationById(conversationId, creatorProfileId);
    if (!conversation) {
      throw new Error("Created conversation could not be loaded");
    }

    return conversation;
  } catch (error) {
    await client.query("ROLLBACK");
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
              sp.avatar_url AS sender_avatar_url, m.content, m.created_at, m.edited_at, m.deleted_at
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
            p.avatar_url AS sender_avatar_url, m.content, m.created_at, m.edited_at, m.deleted_at
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
  const profileId = await getProfileIdForAuthUser(userId);
  if (!(await isConversationParticipant(conversationId, profileId))) {
    throw new Error("Conversation not found");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query<MessageRow>(
      `INSERT INTO messages (conversation_id, sender_id, content)
       VALUES ($1::uuid, $2::uuid, $3)
       RETURNING id, conversation_id, sender_id, NULL::text AS sender_full_name,
                 NULL::text AS sender_avatar_url, content, created_at, edited_at, deleted_at`,
      [conversationId, profileId, content]
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
              p.avatar_url AS sender_avatar_url, m.content, m.created_at, m.edited_at, m.deleted_at
       FROM messages m
       LEFT JOIN profiles p ON p.id = m.sender_id
       WHERE m.id = $1::uuid`,
      [result.rows[0].id]
    );

    return formatMessage(messageResult.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
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

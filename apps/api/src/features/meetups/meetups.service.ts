import type { PoolClient } from "pg";
import { pool } from "../../db/pool";
import { updateUserStats } from "../achievements/achievements.service";
import type {
  CreateMeetupInput,
  JoinMeetupResult,
  LeaveMeetupResult,
  ListMeetupsFilters,
  Meetup,
  MeetupVisibility,
  PaginatedMeetups,
  ViewerMeetupStatus,
} from "./meetups.types";

type MeetupErrorCode = "NOT_FOUND" | "FORBIDDEN" | "CONFLICT" | "BAD_REQUEST";

interface PostgresErrorLike {
  code?: string;
  detail?: string;
  table?: string;
  column?: string;
  constraint?: string;
}

export class MeetupServiceError extends Error {
  public readonly code: MeetupErrorCode;

  constructor(code: MeetupErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

interface MeetupRow {
  id: string;
  trail_id: string | null;
  host_id: string;
  host_full_name: string | null;
  host_avatar_url: string | null;
  host_username: string | null;
  title: string;
  title_ar: string | null;
  note: string | null;
  note_ar: string | null;
  vibe: string | null;
  vibe_ar: string | null;
  cover_url: string | null;
  starts_at: string | Date;
  meeting_place: string | null;
  meeting_latitude: string | number | null;
  meeting_longitude: string | number | null;
  visibility: MeetupVisibility;
  max_headcount: string | number;
  people_joined: string | number;
  bring_items: string[] | null;
  invited_user_ids: string[] | null;
  viewer_status: ViewerMeetupStatus | null;
  created_at: string | Date;
  updated_at: string | Date;
}

function toNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toIsoString(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function logPostgresError(scope: string, error: unknown): void {
  if (!error || typeof error !== "object") {
    return;
  }

  const maybePgError = error as PostgresErrorLike;
  if (!maybePgError.code) {
    return;
  }

  console.error(`[${scope}] PostgreSQL error code:`, maybePgError.code);
  console.error(`[${scope}] PostgreSQL error detail:`, maybePgError.detail);
  console.error(`[${scope}] PostgreSQL error table:`, maybePgError.table);
  console.error(`[${scope}] PostgreSQL error column:`, maybePgError.column);
  console.error(`[${scope}] PostgreSQL error constraint:`, maybePgError.constraint);
}

function getSelectFields(viewerIdParam = "$1") {
  return `
    m.id,
    m.trail_id,
    m.host_id,
    p.full_name AS host_full_name,
    p.avatar_url AS host_avatar_url,
    p.username AS host_username,
    m.title,
    m.title_ar,
    m.note,
    m.note_ar,
    m.vibe,
    m.vibe_ar,
    m.cover_url,
    m.starts_at,
    m.meeting_place,
    m.meeting_latitude,
    m.meeting_longitude,
    m.visibility,
    m.max_headcount,
    m.people_joined,
    m.bring_items,
    m.created_at,
    m.updated_at,
    COALESCE(invited.invited_user_ids, ARRAY[]::uuid[]) AS invited_user_ids,
    CASE
      WHEN ${viewerIdParam}::uuid IS NOT NULL AND m.host_id = ${viewerIdParam}::uuid THEN 'host'
      WHEN viewer_attendee.status = 'joined' THEN 'joined'
      WHEN viewer_attendee.status = 'invited' OR viewer_invite.status = 'pending' THEN 'invited'
      ELSE 'none'
    END AS viewer_status
  `;
}

function getJoins(viewerIdParam = "$1") {
  return `
    LEFT JOIN profiles p ON p.id = m.host_id
    LEFT JOIN meetup_attendees viewer_attendee
      ON viewer_attendee.meetup_id = m.id
     AND viewer_attendee.user_id = ${viewerIdParam}::uuid
     AND viewer_attendee.status IN ('joined', 'invited')
    LEFT JOIN meetup_invites viewer_invite
      ON viewer_invite.meetup_id = m.id
     AND viewer_invite.invitee_id = ${viewerIdParam}::uuid
     AND viewer_invite.status = 'pending'
    LEFT JOIN LATERAL (
      SELECT array_agg(mi.invitee_id) AS invited_user_ids
      FROM meetup_invites mi
      WHERE mi.meetup_id = m.id
    ) invited ON TRUE
  `;
}

function getVisibilityClause(viewerIdParam = "$1") {
  return `
    (
      m.visibility = 'public'
      OR (
        ${viewerIdParam}::uuid IS NOT NULL
        AND (
          m.host_id = ${viewerIdParam}::uuid
          OR EXISTS (
            SELECT 1 FROM meetup_attendees ma
            WHERE ma.meetup_id = m.id
              AND ma.user_id = ${viewerIdParam}::uuid
              AND ma.status IN ('joined', 'invited')
          )
          OR EXISTS (
            SELECT 1 FROM meetup_invites mi
            WHERE mi.meetup_id = m.id
              AND mi.invitee_id = ${viewerIdParam}::uuid
              AND mi.status IN ('pending', 'accepted')
          )
          OR (
            m.visibility = 'friends'
            AND EXISTS (
              SELECT 1
              FROM user_follows f1
              JOIN user_follows f2
                ON f2.follower_id = f1.following_id
               AND f2.following_id = f1.follower_id
              WHERE f1.follower_id = ${viewerIdParam}::uuid
                AND f1.following_id = m.host_id
            )
          )
        )
      )
    )
  `;
}

function formatMeetup(row: MeetupRow): Meetup {
  console.log("[meetups.service] Formatting meetup:", row.id);
  const maxHeadcount = Number(row.max_headcount);
  const peopleJoined = Number(row.people_joined);

  return {
    id: row.id,
    trail_id: row.trail_id,
    host: {
      id: row.host_id,
      full_name: row.host_full_name ?? "Unknown hiker",
      avatar_url: row.host_avatar_url,
      username: row.host_username,
    },
    title: row.title,
    title_ar: row.title_ar,
    note: row.note,
    note_ar: row.note_ar,
    vibe: row.vibe,
    vibe_ar: row.vibe_ar,
    cover_url: row.cover_url,
    starts_at: toIsoString(row.starts_at),
    meeting_place: row.meeting_place,
    meeting_latitude: toNumber(row.meeting_latitude),
    meeting_longitude: toNumber(row.meeting_longitude),
    visibility: row.visibility,
    max_headcount: maxHeadcount,
    people_joined: peopleJoined,
    spots_left: Math.max(0, maxHeadcount - peopleJoined),
    viewer_status: row.viewer_status ?? "none",
    bring_items: row.bring_items ?? [],
    invited_user_ids: (row.invited_user_ids ?? []).map(String),
    created_at: toIsoString(row.created_at),
    updated_at: toIsoString(row.updated_at),
  };
}

async function fetchMeetupById(client: PoolClient, meetupId: string, userId: string | null): Promise<Meetup | null> {
  console.log("[meetups.service] Fetching meetup by id:", { meetupId, userId });
  const result = await client.query<MeetupRow>(
    `SELECT ${getSelectFields("$2")}
     FROM meetups m
     ${getJoins("$2")}
     WHERE m.id = $1::uuid
       AND m.deleted_at IS NULL
       AND ${getVisibilityClause("$2")}
     LIMIT 1`,
    [meetupId, userId]
  );

  return result.rows[0] ? formatMeetup(result.rows[0]) : null;
}

export async function getUserMeetupStatus(meetupId: string, userId: string): Promise<ViewerMeetupStatus> {
  console.log("[meetups.service] getUserMeetupStatus start:", { meetupId, userId });
  const result = await pool.query<{ viewer_status: ViewerMeetupStatus }>(
    `SELECT
       CASE
         WHEN m.host_id = $2::uuid THEN 'host'
         WHEN ma.status = 'joined' THEN 'joined'
         WHEN ma.status = 'invited' OR mi.status = 'pending' THEN 'invited'
         ELSE 'none'
       END AS viewer_status
     FROM meetups m
     LEFT JOIN meetup_attendees ma
       ON ma.meetup_id = m.id
      AND ma.user_id = $2::uuid
      AND ma.status IN ('joined', 'invited')
     LEFT JOIN meetup_invites mi
       ON mi.meetup_id = m.id
      AND mi.invitee_id = $2::uuid
      AND mi.status = 'pending'
     WHERE m.id = $1::uuid
     LIMIT 1`,
    [meetupId, userId]
  );

  return result.rows[0]?.viewer_status ?? "none";
}

export async function createMeetup(userId: string, input: CreateMeetupInput): Promise<Meetup> {
  console.log("[meetups.createMeetup] ========== START ==========");
  console.log("[meetups.createMeetup] userId:", userId);
  console.log("[meetups.createMeetup] input:", JSON.stringify(input, null, 2));

  try {
    console.log("[meetups.createMeetup] 1. Verifying host profile exists...");
    const userCheck = await pool.query(
      "SELECT id, full_name, avatar_url, username FROM profiles WHERE id = $1::uuid",
      [userId]
    );
    console.log("[meetups.createMeetup] 2. User check result:", userCheck.rows.length > 0 ? "FOUND" : "NOT FOUND");

    if (userCheck.rows.length === 0) {
      throw new Error(`User ${userId} not found in profiles table`);
    }

    const insertQuery = `
      INSERT INTO meetups (
        host_id,
        title,
        starts_at,
        visibility,
        max_headcount
      ) VALUES ($1::uuid, $2, $3, $4, $5)
      RETURNING id
    `;

    const insertValues = [
      userId,
      input.title,
      input.starts_at,
      input.visibility,
      input.max_headcount,
    ];

    console.log("[meetups.createMeetup] 3. Insert query:", insertQuery);
    console.log("[meetups.createMeetup] 4. Insert values:", insertValues);

    const result = await pool.query<{ id: string }>(insertQuery, insertValues);
    const meetupId = result.rows[0]?.id;
    console.log("[meetups.createMeetup] 5. Meetup insert result:", result.rows);

    if (!meetupId) {
      throw new Error("Meetup insert did not return an id");
    }

    console.log("[meetups.createMeetup] 6. Meetup created with ID:", meetupId);

    console.log("[meetups.createMeetup] 7. Fetching created meetup...");
    const meetup = await getMeetup(meetupId, userId);
    console.log("[meetups.createMeetup] 8. Updating achievement stats...");
    await updateUserStats(userId, { meetups: 1 });
    console.log("[meetups.createMeetup] 9. Returning meetup");

    return meetup;
  } catch (error) {
    console.error("[meetups.createMeetup] ERROR CAUGHT:", error);
    console.error("[meetups.createMeetup] Error type:", typeof error);
    console.error("[meetups.createMeetup] Error constructor:", error?.constructor?.name);
    console.error("[meetups.createMeetup] Error message:", error instanceof Error ? error.message : String(error));
    console.error("[meetups.createMeetup] Error stack:", error instanceof Error ? error.stack : "No stack");
    logPostgresError("meetups.createMeetup", error);
    throw error;
  }
}

export async function createMeetupFull(userId: string, input: CreateMeetupInput): Promise<Meetup> {
  console.log("[meetups.createMeetupFull] ========== START ==========");
  console.log("[meetups.createMeetupFull] userId:", userId);
  console.log("[meetups.createMeetupFull] input:", JSON.stringify(input, null, 2));
  const client = await pool.connect();

  try {
    console.log("[meetups.createMeetupFull] 1. BEGIN transaction");
    await client.query("BEGIN");

    console.log("[meetups.createMeetupFull] 2. Verifying host profile exists...");
    const userCheck = await client.query(
      "SELECT id, full_name, avatar_url, username FROM profiles WHERE id = $1::uuid",
      [userId]
    );
    console.log("[meetups.createMeetupFull] 3. User check result:", userCheck.rows.length > 0 ? "FOUND" : "NOT FOUND");

    if (userCheck.rows.length === 0) {
      throw new Error(`User ${userId} not found in profiles table`);
    }

    console.log("[meetups.createMeetupFull] 4. Inserting meetup with optional fields...");

    const meetupResult = await client.query<{ id: string }>(
      `INSERT INTO meetups (
         host_id, trail_id, title, title_ar, note, note_ar, vibe, vibe_ar,
         cover_url, starts_at, meeting_place, meeting_latitude, meeting_longitude,
         visibility, max_headcount, people_joined, bring_items
       )
       VALUES (
         $1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8,
         $9, $10, $11, $12, $13, $14, $15, 1, $16
       )
       RETURNING id`,
      [
        userId,
        input.trail_id ?? null,
        input.title,
        input.title_ar ?? null,
        input.note ?? null,
        input.note_ar ?? null,
        input.vibe ?? null,
        input.vibe_ar ?? null,
        input.cover_url ?? null,
        input.starts_at,
        input.meeting_place ?? null,
        input.meeting_latitude ?? null,
        input.meeting_longitude ?? null,
        input.visibility,
        input.max_headcount,
        input.bring_items ?? [],
      ]
    );

    const meetupId = meetupResult.rows[0]?.id;
    console.log("[meetups.createMeetupFull] 5. Meetup insert result:", meetupResult.rows);

    if (!meetupId) {
      throw new Error("Meetup insert did not return an id");
    }

    console.log("[meetups.createMeetupFull] 6. Adding host as attendee...");
    await client.query(
      `INSERT INTO meetup_attendees (meetup_id, user_id, guest_count, status)
       VALUES ($1::uuid, $2::uuid, 1, 'joined')
       ON CONFLICT (meetup_id, user_id) DO UPDATE SET
         guest_count = 1,
         status = 'joined',
         updated_at = NOW()`,
      [meetupId, userId]
    );

    const invitedUserIds = Array.from(new Set(input.invited_user_ids ?? [])).filter((id) => id !== userId);
    console.log("[meetups.createMeetupFull] 7. Sending invites to:", invitedUserIds);

    for (const inviteeId of invitedUserIds) {
      console.log("[meetups.createMeetupFull] 8. Checking invitee profile:", inviteeId);
      const userCheck = await client.query(
        "SELECT id FROM profiles WHERE id = $1::uuid",
        [inviteeId]
      );
      if (userCheck.rows.length === 0) {
        console.log(`[meetups.createMeetupFull] User ${inviteeId} not found, skipping invite`);
        continue;
      }

      console.log("[meetups.createMeetupFull] 9. Upserting invite:", inviteeId);
      await client.query(
        `INSERT INTO meetup_invites (meetup_id, inviter_id, invitee_id, status)
         VALUES ($1::uuid, $2::uuid, $3::uuid, 'pending')
         ON CONFLICT (meetup_id, invitee_id) DO UPDATE SET
           inviter_id = EXCLUDED.inviter_id,
           status = 'pending',
           updated_at = NOW()`,
        [meetupId, userId, inviteeId]
      );

      console.log("[meetups.createMeetupFull] 10. Upserting invited attendee:", inviteeId);
      await client.query(
        `INSERT INTO meetup_attendees (meetup_id, user_id, guest_count, status)
         VALUES ($1::uuid, $2::uuid, 0, 'invited')
         ON CONFLICT (meetup_id, user_id) DO UPDATE SET
           status = CASE WHEN meetup_attendees.status = 'joined' THEN meetup_attendees.status ELSE 'invited' END,
           updated_at = NOW()`,
        [meetupId, inviteeId]
      );
    }

    console.log("[meetups.createMeetupFull] 11. Fetching created meetup...");
    const meetup = await fetchMeetupById(client, meetupId, userId);
    if (!meetup) {
      throw new MeetupServiceError("NOT_FOUND", "Created meetup not found");
    }

    console.log("[meetups.createMeetupFull] 12. COMMIT transaction");
    await client.query("COMMIT");
    console.log("[meetups.createMeetupFull] createMeetupFull complete:", meetupId);
    return meetup;
  } catch (error) {
    console.error("[meetups.createMeetupFull] ERROR CAUGHT:", error);
    console.error("[meetups.createMeetupFull] Error type:", typeof error);
    console.error("[meetups.createMeetupFull] Error constructor:", error?.constructor?.name);
    console.error("[meetups.createMeetupFull] Error message:", error instanceof Error ? error.message : String(error));
    console.error("[meetups.createMeetupFull] Error stack:", error instanceof Error ? error.stack : "No stack");
    logPostgresError("meetups.createMeetupFull", error);
    console.log("[meetups.createMeetupFull] ROLLBACK transaction");
    await client.query("ROLLBACK");
    throw error;
  } finally {
    console.log("[meetups.createMeetupFull] Releasing client");
    client.release();
  }
}

export async function listMeetups(filters: ListMeetupsFilters, userId: string | null): Promise<PaginatedMeetups> {
  console.log("[meetups.service] listMeetups start:", { filters, userId });
  const offset = (filters.page - 1) * filters.limit;
  const values: unknown[] = [userId];
  const whereParts = [`m.deleted_at IS NULL`, getVisibilityClause("$1")];

  if (filters.trail_id) {
    values.push(filters.trail_id);
    whereParts.push(`m.trail_id = $${values.length}::uuid`);
  }

  try {
    console.log("[meetups.service] Counting meetups");
    const countResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM meetups m
       WHERE ${whereParts.join(" AND ")}`,
      values
    );
    const total = Number(countResult.rows[0]?.count ?? 0);

    console.log("[meetups.service] Querying meetup page");
    values.push(filters.limit, offset);
    const result = await pool.query<MeetupRow>(
      `SELECT ${getSelectFields("$1")}
       FROM meetups m
       ${getJoins("$1")}
       WHERE ${whereParts.join(" AND ")}
       ORDER BY m.starts_at ASC, m.created_at DESC
       LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values
    );

    return {
      data: result.rows.map(formatMeetup),
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total,
        pages: total === 0 ? 0 : Math.ceil(total / filters.limit),
      },
    };
  } catch (error) {
    console.error("[meetups.service] listMeetups failed:", error);
    throw error;
  }
}

export async function getMeetup(meetupId: string, userId: string | null): Promise<Meetup> {
  console.log("[meetups.service] getMeetup start:", { meetupId, userId });
  try {
    const meetup = await fetchMeetupById(pool as unknown as PoolClient, meetupId, userId);
    if (!meetup) {
      const existsResult = await pool.query(
        "SELECT id FROM meetups WHERE id = $1::uuid AND deleted_at IS NULL LIMIT 1",
        [meetupId]
      );

      if ((existsResult.rowCount ?? 0) > 0) {
        throw new MeetupServiceError("FORBIDDEN", "You do not have access to this meetup");
      }

      throw new MeetupServiceError("NOT_FOUND", "Meetup not found");
    }

    return meetup;
  } catch (error) {
    console.error("[meetups.service] getMeetup failed:", error);
    throw error;
  }
}

export async function joinMeetup(meetupId: string, userId: string, guestCount: number): Promise<JoinMeetupResult> {
  console.log("[meetups.service] joinMeetup start:", { meetupId, userId, guestCount });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    console.log("[meetups.service] Locking meetup for join");
    const meetupResult = await client.query<{
      id: string;
      host_id: string;
      max_headcount: number;
      people_joined: number;
      deleted_at: Date | null;
      visibility: MeetupVisibility;
      can_access: boolean;
    }>(
      `SELECT
         id,
         host_id,
         max_headcount,
         people_joined,
         deleted_at,
         visibility,
         (
           visibility = 'public'
           OR host_id = $2::uuid
           OR EXISTS (
             SELECT 1 FROM meetup_attendees ma
             WHERE ma.meetup_id = meetups.id
               AND ma.user_id = $2::uuid
               AND ma.status IN ('joined', 'invited')
           )
           OR EXISTS (
             SELECT 1 FROM meetup_invites mi
             WHERE mi.meetup_id = meetups.id
               AND mi.invitee_id = $2::uuid
               AND mi.status IN ('pending', 'accepted')
           )
           OR (
             visibility = 'friends'
             AND EXISTS (
               SELECT 1
               FROM user_follows f1
               JOIN user_follows f2
                 ON f2.follower_id = f1.following_id
                AND f2.following_id = f1.follower_id
               WHERE f1.follower_id = $2::uuid
                 AND f1.following_id = host_id
             )
           )
         ) AS can_access
       FROM meetups
       WHERE id = $1::uuid
       FOR UPDATE`,
      [meetupId, userId]
    );

    const meetup = meetupResult.rows[0];
    if (!meetup || meetup.deleted_at) {
      throw new MeetupServiceError("NOT_FOUND", "Meetup not found");
    }

    if (!meetup.can_access) {
      throw new MeetupServiceError("FORBIDDEN", "You do not have access to this meetup");
    }

    const existingResult = await client.query<{ guest_count: number; status: string }>(
      `SELECT guest_count, status
       FROM meetup_attendees
       WHERE meetup_id = $1::uuid AND user_id = $2::uuid
       FOR UPDATE`,
      [meetupId, userId]
    );
    const existing = existingResult.rows[0];
    const previousJoinedCount = existing?.status === "joined" ? Number(existing.guest_count) : 0;
    const newPeopleJoined = Number(meetup.people_joined) - previousJoinedCount + guestCount;

    if (newPeopleJoined > Number(meetup.max_headcount)) {
      throw new MeetupServiceError("CONFLICT", "Not enough spots left");
    }

    console.log("[meetups.service] Upserting attendee as joined");
    await client.query(
      `INSERT INTO meetup_attendees (meetup_id, user_id, guest_count, status)
       VALUES ($1::uuid, $2::uuid, $3, 'joined')
       ON CONFLICT (meetup_id, user_id) DO UPDATE SET
         guest_count = EXCLUDED.guest_count,
         status = 'joined',
         updated_at = NOW()`,
      [meetupId, userId, guestCount]
    );

    await client.query(
      `UPDATE meetup_invites
       SET status = 'accepted', updated_at = NOW()
       WHERE meetup_id = $1::uuid AND invitee_id = $2::uuid`,
      [meetupId, userId]
    );

    console.log("[meetups.service] Updating people_joined:", newPeopleJoined);
    await client.query(
      `UPDATE meetups
       SET people_joined = $2, updated_at = NOW()
       WHERE id = $1::uuid`,
      [meetupId, newPeopleJoined]
    );

    await client.query("COMMIT");
    return {
      meetup_id: meetupId,
      status: "joined",
      guest_count: guestCount,
      people_joined: newPeopleJoined,
      spots_left: Math.max(0, Number(meetup.max_headcount) - newPeopleJoined),
    };
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("[meetups.service] joinMeetup failed:", error);
    throw error;
  } finally {
    client.release();
  }
}

export async function leaveMeetup(meetupId: string, userId: string): Promise<LeaveMeetupResult> {
  console.log("[meetups.service] leaveMeetup start:", { meetupId, userId });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    console.log("[meetups.service] Locking meetup for leave");
    const meetupResult = await client.query<{
      id: string;
      host_id: string;
      max_headcount: number;
      people_joined: number;
    }>(
      `SELECT id, host_id, max_headcount, people_joined
       FROM meetups
       WHERE id = $1::uuid AND deleted_at IS NULL
       FOR UPDATE`,
      [meetupId]
    );

    const meetup = meetupResult.rows[0];
    if (!meetup) {
      throw new MeetupServiceError("NOT_FOUND", "Meetup not found");
    }

    if (meetup.host_id === userId) {
      throw new MeetupServiceError("FORBIDDEN", "Host cannot leave their own meetup");
    }

    const attendeeResult = await client.query<{ guest_count: number; status: string }>(
      `SELECT guest_count, status
       FROM meetup_attendees
       WHERE meetup_id = $1::uuid AND user_id = $2::uuid
       FOR UPDATE`,
      [meetupId, userId]
    );
    const attendee = attendeeResult.rows[0];

    if (!attendee || attendee.status !== "joined") {
      throw new MeetupServiceError("NOT_FOUND", "You are not joined to this meetup");
    }

    const newPeopleJoined = Math.max(0, Number(meetup.people_joined) - Number(attendee.guest_count));
    console.log("[meetups.service] Cancelling attendee and updating people_joined:", newPeopleJoined);
    await client.query(
      `UPDATE meetup_attendees
       SET status = 'cancelled', guest_count = 0, updated_at = NOW()
       WHERE meetup_id = $1::uuid AND user_id = $2::uuid`,
      [meetupId, userId]
    );

    await client.query(
      `UPDATE meetups
       SET people_joined = $2, updated_at = NOW()
       WHERE id = $1::uuid`,
      [meetupId, newPeopleJoined]
    );

    await client.query("COMMIT");
    return {
      people_joined: newPeopleJoined,
      spots_left: Math.max(0, Number(meetup.max_headcount) - newPeopleJoined),
    };
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("[meetups.service] leaveMeetup failed:", error);
    throw error;
  } finally {
    client.release();
  }
}

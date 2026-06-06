import { pool } from "../../db/pool";
import { createNotification } from "../notifications/notifications.service";

export type ChallengeGoalType =
  | "complete_trails"
  | "total_distance_km"
  | "complete_difficulty"
  | "join_meetups"
  | "submit_safety_reports"
  | "checkpoint_reports";

export interface ChallengeInput {
  title: string;
  description: string;
  goal_type: ChallengeGoalType;
  goal_value: number;
  goal_metadata?: Record<string, unknown>;
  start_at: string;
  end_at: string;
  reward_badge_id?: string | null;
  reward_points?: number;
  visibility?: "public" | "private";
  status?: "draft" | "published" | "archived";
}

function toNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

let challengeColumnCache: Set<string> | null = null;

async function getChallengeColumns(): Promise<Set<string>> {
  if (challengeColumnCache) return challengeColumnCache;
  const result = await pool.query<{ column_name: string }>(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'challenges'`
  );
  challengeColumnCache = new Set(result.rows.map((row) => row.column_name));
  return challengeColumnCache;
}

function formatChallenge(row: Record<string, any>): Record<string, any> {
  return {
    ...row,
    goal_value: toNumber(row.goal_value),
    reward_points: toNumber(row.reward_points),
    participant_count: row.participant_count === undefined ? undefined : toNumber(row.participant_count),
    completed_count: row.completed_count === undefined ? undefined : toNumber(row.completed_count),
    progress_value: row.progress_value === undefined ? undefined : toNumber(row.progress_value),
  };
}

export async function listAdminChallenges() {
  const result = await pool.query(
    `SELECT c.*,
            rb.name AS reward_badge_name,
            COUNT(cp.id)::int AS participant_count,
            COUNT(cp.id) FILTER (WHERE cp.status = 'completed')::int AS completed_count
     FROM challenges c
     LEFT JOIN achievements rb ON rb.id = c.reward_badge_id
     LEFT JOIN challenge_participants cp ON cp.challenge_id = c.id
     GROUP BY c.id, rb.name
     ORDER BY c.created_at DESC`
  );
  return result.rows.map(formatChallenge);
}

export async function listPublicChallenges(userId?: string | null) {
  const result = await pool.query(
    `SELECT c.*,
            rb.name AS reward_badge_name,
            cp.progress_value,
            cp.status AS participant_status,
            cp.joined_at,
            cp.completed_at
     FROM challenges c
     LEFT JOIN achievements rb ON rb.id = c.reward_badge_id
     LEFT JOIN challenge_participants cp
       ON cp.challenge_id = c.id
      AND cp.user_id = $1::uuid
     WHERE c.status = 'published'
       AND c.visibility = 'public'
       AND c.end_at >= NOW()
     ORDER BY c.start_at ASC, c.created_at DESC`,
    [userId ?? null]
  );
  return result.rows.map(formatChallenge);
}

export async function getChallenge(challengeId: string, userId?: string | null, includePrivate = false) {
  const result = await pool.query(
    `SELECT c.*,
            rb.name AS reward_badge_name,
            cp.progress_value,
            cp.status AS participant_status,
            cp.joined_at,
            cp.completed_at
     FROM challenges c
     LEFT JOIN achievements rb ON rb.id = c.reward_badge_id
     LEFT JOIN challenge_participants cp
       ON cp.challenge_id = c.id
      AND cp.user_id = $2::uuid
     WHERE c.id = $1::uuid
       AND ($3::boolean OR (c.status = 'published' AND c.visibility = 'public'))
     LIMIT 1`,
    [challengeId, userId ?? null, includePrivate]
  );
  return result.rows[0] ? formatChallenge(result.rows[0]) : null;
}

async function assertRewardBadgeExists(rewardBadgeId?: string | null): Promise<void> {
  if (!rewardBadgeId) return;
  const result = await pool.query("SELECT id FROM achievements WHERE id = $1::uuid LIMIT 1", [rewardBadgeId]);
  if (!result.rows[0]) {
    throw new Error("REWARD_BADGE_NOT_FOUND");
  }
}

export async function createChallenge(adminUserId: string, input: ChallengeInput) {
  await assertRewardBadgeExists(input.reward_badge_id);
  const columns = await getChallengeColumns();
  const insertColumns = [
    "title",
    "description",
    "goal_type",
    "goal_value",
    "start_at",
    "end_at",
    "reward_badge_id",
    "reward_points",
    "visibility",
    "status",
    "created_by",
  ];
  const values: unknown[] = [
    input.title,
    input.description,
    input.goal_type,
    input.goal_value,
    input.start_at,
    input.end_at,
    input.reward_badge_id ?? null,
    input.reward_points ?? 0,
    input.visibility ?? "public",
    input.status ?? "draft",
    adminUserId,
  ];
  const placeholders = [
    "$1",
    "$2",
    "$3",
    "$4",
    "$5::timestamptz",
    "$6::timestamptz",
    "$7::uuid",
    "$8",
    "$9",
    "$10",
    "$11::uuid",
  ];

  if (columns.has("goal_metadata")) {
    values.push(JSON.stringify(input.goal_metadata ?? {}));
    insertColumns.splice(4, 0, "goal_metadata");
    placeholders.splice(4, 0, `$${values.length}::jsonb`);
  }
  if (columns.has("published_at")) {
    insertColumns.push("published_at");
    placeholders.push("CASE WHEN $10 = 'published' THEN NOW() ELSE NULL END");
  }
  if (columns.has("archived_at")) {
    insertColumns.push("archived_at");
    placeholders.push("CASE WHEN $10 = 'archived' THEN NOW() ELSE NULL END");
  }
  if (columns.has("updated_at")) {
    insertColumns.push("updated_at");
    placeholders.push("NOW()");
  }

  const result = await pool.query(
    `INSERT INTO challenges (${insertColumns.join(", ")})
     VALUES (${placeholders.join(", ")})
     RETURNING *`,
    values
  );
  const challenge = result.rows[0];
  if (challenge.status === "published" && challenge.visibility === "public") {
    await notifyUsersAboutPublishedChallenge(challenge);
  }
  return formatChallenge(challenge);
}

export async function updateChallenge(challengeId: string, input: Partial<ChallengeInput>) {
  const current = await getChallenge(challengeId, null, true);
  if (!current) return null;
  const next = { ...current, ...input };
  await assertRewardBadgeExists(next.reward_badge_id);
  const columns = await getChallengeColumns();
  const values: unknown[] = [challengeId];
  const setParts: string[] = [];

  function addSet(column: string, value: unknown, cast = ""): void {
    values.push(value);
    setParts.push(`${column} = $${values.length}${cast}`);
  }

  addSet("title", next.title);
  addSet("description", next.description);
  addSet("goal_type", next.goal_type);
  addSet("goal_value", next.goal_value);
  if (Object.prototype.hasOwnProperty.call(input, "goal_metadata") && columns.has("goal_metadata")) {
    addSet("goal_metadata", JSON.stringify(input.goal_metadata ?? {}), "::jsonb");
  }
  addSet("start_at", next.start_at, "::timestamptz");
  addSet("end_at", next.end_at, "::timestamptz");
  addSet("reward_badge_id", next.reward_badge_id ?? null, "::uuid");
  addSet("reward_points", next.reward_points ?? 0);
  addSet("visibility", next.visibility ?? "public");
  addSet("status", next.status ?? "draft");
  if (columns.has("published_at")) {
    setParts.push(`published_at = CASE WHEN $${values.length} = 'published' THEN COALESCE(published_at, NOW()) ELSE published_at END`);
  }
  if (columns.has("archived_at")) {
    setParts.push(`archived_at = CASE WHEN $${values.length} = 'archived' THEN COALESCE(archived_at, NOW()) ELSE archived_at END`);
  }
  if (columns.has("updated_at")) {
    setParts.push("updated_at = NOW()");
  }

  const result = await pool.query(
    `UPDATE challenges
     SET ${setParts.join(",\n         ")}
     WHERE id = $1::uuid
     RETURNING *`,
    values
  );
  return formatChallenge(result.rows[0]);
}

export async function publishChallenge(challengeId: string) {
  const columns = await getChallengeColumns();
  const setParts = ["status = 'published'"];
  if (columns.has("published_at")) setParts.push("published_at = COALESCE(published_at, NOW())");
  if (columns.has("archived_at")) setParts.push("archived_at = NULL");
  if (columns.has("updated_at")) setParts.push("updated_at = NOW()");
  const result = await pool.query(
    `UPDATE challenges
     SET ${setParts.join(",\n         ")}
     WHERE id = $1::uuid
       AND status <> 'archived'
     RETURNING *`,
    [challengeId]
  );
  const challenge = result.rows[0];
  if (!challenge) return null;
  if (challenge.visibility === "public") {
    await notifyUsersAboutPublishedChallenge(challenge);
  }
  return formatChallenge(challenge);
}

export async function archiveChallenge(challengeId: string) {
  const columns = await getChallengeColumns();
  const setParts = ["status = 'archived'"];
  if (columns.has("archived_at")) setParts.push("archived_at = COALESCE(archived_at, NOW())");
  if (columns.has("updated_at")) setParts.push("updated_at = NOW()");
  const result = await pool.query(
    `UPDATE challenges
     SET ${setParts.join(",\n         ")}
     WHERE id = $1::uuid
     RETURNING *`,
    [challengeId]
  );
  return result.rows[0] ? formatChallenge(result.rows[0]) : null;
}

async function notifyUsersAboutPublishedChallenge(challenge: Record<string, any>): Promise<void> {
  const users = await pool.query<{ id: string }>(
    "SELECT user_id AS id FROM profiles ORDER BY created_at DESC LIMIT 1000"
  );
  for (const user of users.rows) {
    await createNotification({
      user_id: user.id,
      type: "challenge_created",
      title: "New challenge available",
      body: challenge.title,
      entity_type: "challenge",
      entity_id: challenge.id,
      data: {
        challenge_id: challenge.id,
        goal_type: challenge.goal_type,
        goal_value: challenge.goal_value,
      },
    });
  }
}

export async function joinChallenge(challengeId: string, userId: string) {
  const challenge = await getChallenge(challengeId, userId);
  if (!challenge) {
    throw new Error("CHALLENGE_NOT_FOUND");
  }

  const result = await pool.query(
    `INSERT INTO challenge_participants (challenge_id, user_id)
     VALUES ($1::uuid, $2::uuid)
     ON CONFLICT (challenge_id, user_id) DO NOTHING
     RETURNING *`,
    [challengeId, userId]
  );

  if (!result.rows[0]) {
    throw new Error("CHALLENGE_ALREADY_JOINED");
  }

  return recalculateParticipant(challengeId, userId);
}

export async function getMyChallenges(userId: string) {
  const result = await pool.query<{ challenge_id: string }>(
    "SELECT challenge_id FROM challenge_participants WHERE user_id = $1::uuid ORDER BY joined_at DESC",
    [userId]
  );
  for (const row of result.rows) {
    await recalculateParticipant(row.challenge_id, userId);
  }

  const refreshed = await pool.query(
    `SELECT c.*, cp.progress_value, cp.status AS participant_status, cp.joined_at, cp.completed_at,
            rb.name AS reward_badge_name
     FROM challenge_participants cp
     JOIN challenges c ON c.id = cp.challenge_id
     LEFT JOIN achievements rb ON rb.id = c.reward_badge_id
     WHERE cp.user_id = $1::uuid
     ORDER BY cp.joined_at DESC`,
    [userId]
  );
  return refreshed.rows.map(formatChallenge);
}

async function calculateProgress(challenge: Record<string, any>, userId: string): Promise<number> {
  switch (challenge.goal_type as ChallengeGoalType) {
    case "complete_trails": {
      const result = await pool.query(
        "SELECT COUNT(DISTINCT trail_id)::text AS count FROM activities WHERE user_id = $1::uuid AND status = 'completed' AND trail_id IS NOT NULL",
        [userId]
      );
      return toNumber(result.rows[0]?.count);
    }
    case "total_distance_km": {
      const result = await pool.query(
        "SELECT COALESCE(SUM(distance_km), 0) AS total FROM activities WHERE user_id = $1::uuid AND status = 'completed'",
        [userId]
      );
      return toNumber(result.rows[0]?.total);
    }
    case "complete_difficulty": {
      const difficulty = String(challenge.goal_metadata?.difficulty ?? "");
      const result = await pool.query(
        `SELECT COUNT(DISTINCT a.trail_id)::text AS count
         FROM activities a
         JOIN trails t ON t.id = a.trail_id
         WHERE a.user_id = $1::uuid
           AND a.status = 'completed'
           AND lower(t.difficulty) = lower($2)`,
        [userId, difficulty]
      );
      return toNumber(result.rows[0]?.count);
    }
    case "join_meetups": {
      const result = await pool.query(
        "SELECT COUNT(*)::text AS count FROM meetup_attendees WHERE user_id = $1::uuid AND status = 'joined'",
        [userId]
      );
      return toNumber(result.rows[0]?.count);
    }
    case "submit_safety_reports": {
      const result = await pool.query(
        "SELECT COUNT(*)::text AS count FROM safety_incidents WHERE reporter_id = $1::uuid",
        [userId]
      );
      return toNumber(result.rows[0]?.count);
    }
    case "checkpoint_reports": {
      const result = await pool.query(
        `SELECT COUNT(*)::text AS count
         FROM checkpoint_reports cr
         JOIN profiles p ON p.id = cr.reporter_id
         WHERE p.user_id = $1::uuid OR p.id = $1::uuid`,
        [userId]
      );
      return toNumber(result.rows[0]?.count);
    }
    default:
      return 0;
  }
}

async function awardChallengeBadgeIfNeeded(challenge: Record<string, any>, userId: string): Promise<void> {
  if (!challenge.reward_badge_id) return;

  const result = await pool.query(
    `INSERT INTO user_achievements (
       user_id, achievement_id, progress_current, progress_target, earned_at, source_type, source_id, updated_at
     )
     VALUES ($1::uuid, $2::uuid, $3, $3, NOW(), 'challenge', $4::uuid, NOW())
     ON CONFLICT (achievement_id, user_id)
     DO UPDATE SET
       earned_at = COALESCE(user_achievements.earned_at, NOW()),
       source_type = COALESCE(user_achievements.source_type, 'challenge'),
       source_id = COALESCE(user_achievements.source_id, $4::uuid),
       updated_at = NOW()
     RETURNING earned_at`,
    [userId, challenge.reward_badge_id, challenge.goal_value, challenge.id]
  );

  if (result.rows[0]) {
    await createNotification({
      user_id: userId,
      type: "badge_earned",
      title: "Badge earned",
      body: `You earned a badge from ${challenge.title}.`,
      entity_type: "achievement",
      entity_id: challenge.reward_badge_id,
      data: {
        challenge_id: challenge.id,
        badge_id: challenge.reward_badge_id,
      },
    });
  }
}

export async function recalculateParticipant(challengeId: string, userId: string) {
  const challenge = await getChallenge(challengeId, userId, true);
  if (!challenge) throw new Error("CHALLENGE_NOT_FOUND");
  const existingResult = await pool.query<{ status: string }>(
    "SELECT status FROM challenge_participants WHERE challenge_id = $1::uuid AND user_id = $2::uuid LIMIT 1",
    [challengeId, userId]
  );
  const wasCompleted = existingResult.rows[0]?.status === "completed";
  const progress = await calculateProgress(challenge, userId);
  const completed = progress >= toNumber(challenge.goal_value);
  const result = await pool.query(
    `UPDATE challenge_participants
     SET progress_value = $3,
         status = CASE WHEN $4::boolean THEN 'completed' ELSE status END,
         completed_at = CASE WHEN $4::boolean THEN COALESCE(completed_at, NOW()) ELSE completed_at END,
         updated_at = NOW()
     WHERE challenge_id = $1::uuid
       AND user_id = $2::uuid
     RETURNING *`,
    [challengeId, userId, progress, completed]
  );
  if (completed && !wasCompleted) {
    await awardChallengeBadgeIfNeeded(challenge, userId);
    await createNotification({
      user_id: userId,
      type: "challenge_completed",
      title: "Challenge completed",
      body: `You completed ${challenge.title}.`,
      entity_type: "challenge",
      entity_id: challenge.id,
      data: { challenge_id: challenge.id, progress_value: progress },
    });
  }
  return result.rows[0] ?? null;
}

export async function recalculateChallenge(challengeId: string) {
  const participants = await pool.query<{ user_id: string }>(
    "SELECT user_id FROM challenge_participants WHERE challenge_id = $1::uuid",
    [challengeId]
  );
  let updated = 0;
  let completed = 0;
  for (const participant of participants.rows) {
    const row = await recalculateParticipant(challengeId, participant.user_id);
    if (row) {
      updated += 1;
      if (row.status === "completed") completed += 1;
    }
  }
  return { updated, completed };
}

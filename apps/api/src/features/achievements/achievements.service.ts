import { pool } from "../../db/pool";
import { createNotification } from "../notifications/notifications.service";
import type { Achievement, AchievementWithProgress, UserAchievement } from "./achievements.types";

interface ProfileAchievementStats {
  total_distance_km: string | number | null;
  total_trails_completed: string | number | null;
  total_meetups_hosted: string | number | null;
  total_incidents_reported: string | number | null;
  total_reviews_written: string | number | null;
  total_photos_uploaded: string | number | null;
  total_meetups_joined: string | number | null;
  total_summit_count: string | number | null;
  unique_springs_visited: string[] | null;
  unique_valleys_visited: string[] | null;
  unique_heritage_sites_visited: string[] | null;
  regions_visited: string[] | null;
  region_trail_counts: Record<string, string | number> | null;
}

interface LeaderboardRow {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  total_points: string | number;
  achievements_count: string | number;
}

type UserStatsUpdate = {
  distance?: number;
  trails?: number;
  meetupsHosted?: number;
  meetups?: number;
  incidents?: number;
  reviews?: number;
  photos?: number;
  meetupsJoined?: number;
  summit?: number;
  uniqueSpring?: string;
  uniqueValley?: string;
  uniqueHeritageSite?: string;
  regionTrail?: { region: string; count?: number };
  regionVisited?: string;
};

function toNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeNonNegativeNumber(value: unknown): number {
  return Math.max(0, toNumber(value));
}

function normalizeStatsKey(value: string): string {
  return value.trim().toLowerCase();
}

function getCriteriaTarget(criteriaValue: Record<string, unknown>): number {
  return toNumber(
    criteriaValue.target ??
      criteriaValue.value ??
      criteriaValue.count ??
      criteriaValue.kilometers ??
      criteriaValue.distance ??
      criteriaValue.distance_km ??
      criteriaValue.total
  );
}

function normalizeAchievement(row: Achievement): Achievement {
  return {
    ...row,
    criteria_value: row.criteria_value ?? {},
    points: toNumber(row.points),
  };
}

export function evaluateCriteria(
  userStats: ProfileAchievementStats,
  achievement: Achievement
): { progress: number; target: number; completed: boolean } {
  console.log("[achievements.evaluateCriteria] Evaluating:", {
    achievement_id: achievement.id,
    code: achievement.code,
    criteria_type: achievement.criteria_type,
  });

  const criteriaValue = achievement.criteria_value ?? {};
  const target = getCriteriaTarget(criteriaValue);
  let current = 0;

  switch (achievement.criteria_type) {
    case "trails_count":
      current = toNumber(userStats.total_trails_completed);
      break;
    case "reviews_count":
      current = toNumber(userStats.total_reviews_written);
      break;
    case "photos_count":
      current = toNumber(userStats.total_photos_uploaded);
      break;
    case "distance_km":
      current = toNumber(userStats.total_distance_km);
      break;
    case "summits":
      current = toNumber(userStats.total_summit_count);
      break;
    case "meetups_joined":
      current = toNumber(userStats.total_meetups_joined);
      break;
    case "meetups_hosted":
      current = toNumber(userStats.total_meetups_hosted);
      break;
    case "unique_places":
      if (criteriaValue.type === "spring") {
        current = userStats.unique_springs_visited?.length ?? 0;
      } else if (criteriaValue.type === "valley") {
        current = userStats.unique_valleys_visited?.length ?? 0;
      } else if (criteriaValue.type === "heritage") {
        current = userStats.unique_heritage_sites_visited?.length ?? 0;
      }
      break;
    case "region_trails": {
      const region = normalizeStatsKey(String(criteriaValue.region ?? ""));
      current = region ? toNumber(userStats.region_trail_counts?.[region]) : 0;
      break;
    }
    case "regions_visited":
      current = userStats.regions_visited?.length ?? 0;
      break;
    default:
      current = 0;
  }

  const progress = Math.min(current, target);
  const completed = target > 0 && progress >= target;

  console.log("[achievements.evaluateCriteria] Result:", { progress, target, completed });
  return { progress, target, completed };
}

export async function getAllAchievements(userId?: string): Promise<AchievementWithProgress[]> {
  console.log("[achievements.getAllAchievements] ========== START ==========");
  console.log("[achievements.getAllAchievements] userId:", userId);

  const result = await pool.query<AchievementWithProgress>(
    `SELECT
       a.id,
       a.code,
       a.name,
       a.name_ar,
       a.description,
       a.description_ar,
       a.category,
       a.badge_icon_url,
       a.criteria_type,
       a.criteria_value,
       a.points,
       COALESCE(ua.progress_current, 0) AS progress_current,
       COALESCE(ua.progress_target, 0) AS progress_target,
       (ua.earned_at IS NOT NULL) AS earned,
       ua.earned_at
     FROM achievements a
     LEFT JOIN user_achievements ua
       ON ua.achievement_id = a.id
      AND ua.user_id = $1::uuid
     WHERE COALESCE(a.is_active, true) = true
     ORDER BY a.category ASC, a.points ASC, a.created_at ASC`,
    [userId ?? null]
  );

  console.log("[achievements.getAllAchievements] Rows:", result.rows.length);
  return result.rows.map((row) => ({
    ...normalizeAchievement(row),
    progress_current: toNumber(row.progress_current),
    progress_target: toNumber(row.progress_target),
    earned: Boolean(row.earned),
    earned_at: row.earned_at,
  }));
}

export async function getUserAchievements(userId: string): Promise<UserAchievement[]> {
  console.log("[achievements.getUserAchievements] ========== START ==========");
  console.log("[achievements.getUserAchievements] userId:", userId);

  const result = await pool.query<UserAchievement>(
    `SELECT id, user_id, achievement_id, progress_current, progress_target, earned_at
     FROM user_achievements
     WHERE user_id = $1::uuid
       AND earned_at IS NOT NULL
     ORDER BY earned_at DESC`,
    [userId]
  );

  console.log("[achievements.getUserAchievements] Rows:", result.rows.length);
  return result.rows.map((row) => ({
    ...row,
    progress_current: toNumber(row.progress_current),
    progress_target: toNumber(row.progress_target),
  }));
}

async function getUserStats(userId: string): Promise<ProfileAchievementStats | undefined> {
  const result = await pool.query<ProfileAchievementStats>(
    `SELECT
       COALESCE(total_distance_km, 0) AS total_distance_km,
       COALESCE(total_trails_completed, 0) AS total_trails_completed,
       COALESCE(total_meetups_hosted, 0) AS total_meetups_hosted,
       COALESCE(total_incidents_reported, 0) AS total_incidents_reported,
       COALESCE(total_reviews_written, 0) AS total_reviews_written,
       COALESCE(total_photos_uploaded, 0) AS total_photos_uploaded,
       COALESCE(total_meetups_joined, 0) AS total_meetups_joined,
       COALESCE(total_summit_count, 0) AS total_summit_count,
       COALESCE(unique_springs_visited, ARRAY[]::text[]) AS unique_springs_visited,
       COALESCE(unique_valleys_visited, ARRAY[]::text[]) AS unique_valleys_visited,
       COALESCE(unique_heritage_sites_visited, ARRAY[]::text[]) AS unique_heritage_sites_visited,
       COALESCE(regions_visited, ARRAY[]::text[]) AS regions_visited,
       COALESCE(region_trail_counts, '{}'::jsonb) AS region_trail_counts
     FROM profiles
     WHERE user_id = $1::uuid OR id = $1::uuid
     LIMIT 1`,
    [userId]
  );

  return result.rows[0];
}

async function createAchievementNotification(userId: string, achievement: Achievement): Promise<void> {
  try {
    console.log("[achievements.createAchievementNotification] Creating notification:", {
      userId,
      achievement_id: achievement.id,
    });

    await createNotification({
      user_id: userId,
      type: "system",
      title: "Achievement unlocked",
      body: `You earned ${achievement.name}.`,
      entity_type: "achievement",
      entity_id: achievement.id,
      data: {
        achievement_id: achievement.id,
        code: achievement.code,
        name: achievement.name,
        badge_icon_url: achievement.badge_icon_url,
        points: achievement.points,
      },
    });
  } catch (error) {
    console.error("[achievements.createAchievementNotification] Failed:", error);
  }
}

function shouldRetryDistanceAsInteger(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const code = "code" in error ? String((error as { code?: unknown }).code ?? "") : "";
  const message = "message" in error ? String((error as { message?: unknown }).message ?? "") : "";

  return code === "22P02" || code === "42804" || code === "42846" || /integer/i.test(message);
}

async function writeProfileAchievementStats(
  userId: string,
  stats: UserStatsUpdate,
  distanceKm: number,
  distanceCast: "numeric" | "int",
  regionVisitedKey: string | null,
  regionTrailKey: string | null
): Promise<void> {
  await pool.query(
    `UPDATE profiles
     SET total_distance_km = COALESCE(total_distance_km, 0) + $2::${distanceCast},
         total_trails_completed = COALESCE(total_trails_completed, 0) + $3::int,
         total_meetups_hosted = COALESCE(total_meetups_hosted, 0) + $4::int,
         total_incidents_reported = COALESCE(total_incidents_reported, 0) + $5::int,
         total_reviews_written = COALESCE(total_reviews_written, 0) + $6::int,
         total_photos_uploaded = COALESCE(total_photos_uploaded, 0) + $7::int,
         total_meetups_joined = COALESCE(total_meetups_joined, 0) + $8::int,
         total_summit_count = COALESCE(total_summit_count, 0) + $9::int,
         unique_springs_visited = CASE
           WHEN $10::text IS NULL THEN COALESCE(unique_springs_visited, ARRAY[]::text[])
           WHEN $10::text = ANY(COALESCE(unique_springs_visited, ARRAY[]::text[])) THEN COALESCE(unique_springs_visited, ARRAY[]::text[])
           ELSE array_append(COALESCE(unique_springs_visited, ARRAY[]::text[]), $10::text)
         END,
         unique_valleys_visited = CASE
           WHEN $11::text IS NULL THEN COALESCE(unique_valleys_visited, ARRAY[]::text[])
           WHEN $11::text = ANY(COALESCE(unique_valleys_visited, ARRAY[]::text[])) THEN COALESCE(unique_valleys_visited, ARRAY[]::text[])
           ELSE array_append(COALESCE(unique_valleys_visited, ARRAY[]::text[]), $11::text)
         END,
         unique_heritage_sites_visited = CASE
           WHEN $12::text IS NULL THEN COALESCE(unique_heritage_sites_visited, ARRAY[]::text[])
           WHEN $12::text = ANY(COALESCE(unique_heritage_sites_visited, ARRAY[]::text[])) THEN COALESCE(unique_heritage_sites_visited, ARRAY[]::text[])
           ELSE array_append(COALESCE(unique_heritage_sites_visited, ARRAY[]::text[]), $12::text)
         END,
         regions_visited = CASE
           WHEN $13::text IS NULL THEN COALESCE(regions_visited, ARRAY[]::text[])
           WHEN $13::text = ANY(COALESCE(regions_visited, ARRAY[]::text[])) THEN COALESCE(regions_visited, ARRAY[]::text[])
           ELSE array_append(COALESCE(regions_visited, ARRAY[]::text[]), $13::text)
         END,
         region_trail_counts = CASE
           WHEN $14::text IS NULL THEN COALESCE(region_trail_counts, '{}'::jsonb)
           ELSE jsonb_set(
             COALESCE(region_trail_counts, '{}'::jsonb),
             ARRAY[$14::text],
             to_jsonb(COALESCE((COALESCE(region_trail_counts, '{}'::jsonb)->>$14::text)::int, 0) + $15::int),
             true
           )
         END,
         updated_at = NOW()
     WHERE user_id = $1::uuid OR id = $1::uuid`,
    [
      userId,
      distanceKm,
      stats.trails ?? 0,
      stats.meetupsHosted ?? stats.meetups ?? 0,
      stats.incidents ?? 0,
      stats.reviews ?? 0,
      stats.photos ?? 0,
      stats.meetupsJoined ?? 0,
      stats.summit ?? 0,
      stats.uniqueSpring ?? null,
      stats.uniqueValley ?? null,
      stats.uniqueHeritageSite ?? null,
      regionVisitedKey,
      regionTrailKey,
      stats.regionTrail?.count ?? 1,
    ]
  );
}

export async function checkAndAwardAchievements(userId: string): Promise<Achievement[]> {
  console.log("[achievements.checkAndAwardAchievements] ========== START ==========");
  console.log("[achievements.checkAndAwardAchievements] userId:", userId);

  const [userStats, achievementsResult, progressResult] = await Promise.all([
    getUserStats(userId),
    pool.query<Achievement>(
      `SELECT id, code, name, name_ar, description, description_ar, category,
              badge_icon_url, criteria_type, criteria_value, points
       FROM achievements
       ORDER BY points ASC, created_at ASC`
    ),
    pool.query<UserAchievement>(
      `SELECT id, user_id, achievement_id, progress_current, progress_target, earned_at
       FROM user_achievements
       WHERE user_id = $1::uuid`,
      [userId]
    ),
  ]);

  if (!userStats) {
    console.log("[achievements.checkAndAwardAchievements] No profile found; nothing to award");
    return [];
  }

  const existingByAchievementId = new Map(progressResult.rows.map((row) => [row.achievement_id, row]));
  const newlyAwarded: Achievement[] = [];

  console.log("[achievements.checkAndAwardAchievements] Achievements to evaluate:", achievementsResult.rows.length);
  for (const rawAchievement of achievementsResult.rows) {
    const achievement = normalizeAchievement(rawAchievement);
    const existing = existingByAchievementId.get(achievement.id);
    const criteria = evaluateCriteria(userStats, achievement);

    console.log("[achievements.checkAndAwardAchievements] Upserting progress:", {
      achievement_id: achievement.id,
      completed: criteria.completed,
    });
    const upsertResult = await pool.query<UserAchievement>(
      `INSERT INTO user_achievements (
         user_id,
         achievement_id,
         progress_current,
         progress_target,
         earned_at
       )
       VALUES ($1::uuid, $2::uuid, $3, $4, CASE WHEN $5::boolean THEN NOW() ELSE NULL END)
       ON CONFLICT (user_id, achievement_id)
       DO UPDATE SET
         progress_current = EXCLUDED.progress_current,
         progress_target = EXCLUDED.progress_target,
         earned_at = CASE
           WHEN user_achievements.earned_at IS NULL AND $5::boolean THEN NOW()
           ELSE user_achievements.earned_at
         END
       RETURNING id, user_id, achievement_id, progress_current, progress_target, earned_at`,
      [userId, achievement.id, criteria.progress, criteria.target, criteria.completed]
    );

    if (!existing?.earned_at && upsertResult.rows[0]?.earned_at) {
      newlyAwarded.push(achievement);
      await createAchievementNotification(userId, achievement);
    }
  }

  console.log("[achievements.checkAndAwardAchievements] Newly awarded:", newlyAwarded.length);
  return newlyAwarded;
}

export async function updateUserStats(
  userId: string,
  stats: UserStatsUpdate
): Promise<void> {
  console.log("[achievements.updateUserStats] ========== START ==========");
  console.log("[achievements.updateUserStats] Params:", { userId, stats });
  const regionTrailKey = stats.regionTrail?.region ? normalizeStatsKey(stats.regionTrail.region) : null;
  const regionVisitedKey = stats.regionVisited ? normalizeStatsKey(stats.regionVisited) : null;
  const normalizedDistanceKm = normalizeNonNegativeNumber(stats.distance);

  try {
    await writeProfileAchievementStats(
      userId,
      stats,
      normalizedDistanceKm,
      "numeric",
      regionVisitedKey,
      regionTrailKey
    );
  } catch (error) {
    if (!shouldRetryDistanceAsInteger(error) || Number.isInteger(normalizedDistanceKm)) {
      throw error;
    }

    const roundedDistanceKm = Math.round(normalizedDistanceKm);
    console.warn("[achievements.updateUserStats] Retrying with integer distance increment", {
      userId,
      distance_km: normalizedDistanceKm,
      rounded_distance_km: roundedDistanceKm,
    });

    await writeProfileAchievementStats(
      userId,
      stats,
      roundedDistanceKm,
      "int",
      regionVisitedKey,
      regionTrailKey
    );
  }

  console.log("[achievements.updateUserStats] Stats updated; checking achievements");
  await checkAndAwardAchievements(userId);
}

export async function getLeaderboard(
  limit = 20
): Promise<{ user_id: string; full_name: string; avatar_url: string; total_points: number; achievements_count: number }[]> {
  console.log("[achievements.getLeaderboard] ========== START ==========");
  console.log("[achievements.getLeaderboard] limit:", limit);

  const result = await pool.query<LeaderboardRow>(
    `SELECT
       ua.user_id,
       COALESCE(p.full_name, 'Unknown hiker') AS full_name,
       p.avatar_url,
       COALESCE(SUM(a.points), 0) AS total_points,
       COUNT(ua.id) AS achievements_count
     FROM user_achievements ua
     JOIN achievements a ON a.id = ua.achievement_id
     LEFT JOIN profiles p ON p.user_id = ua.user_id OR p.id = ua.user_id
     WHERE ua.earned_at IS NOT NULL
     GROUP BY ua.user_id, p.full_name, p.avatar_url
     HAVING COUNT(ua.id) > 0
     ORDER BY total_points DESC, achievements_count DESC
     LIMIT $1`,
    [limit]
  );

  console.log("[achievements.getLeaderboard] Rows:", result.rows.length);
  return result.rows.map((row) => ({
    user_id: row.user_id,
    full_name: row.full_name ?? "Unknown hiker",
    avatar_url: row.avatar_url ?? "",
    total_points: toNumber(row.total_points),
    achievements_count: toNumber(row.achievements_count),
  }));
}

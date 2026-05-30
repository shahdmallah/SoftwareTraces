import { pool } from "../../db/pool";
import { createNotification } from "../notifications/notifications.service";
import type { Achievement, AchievementWithProgress, UserAchievement } from "./achievements.types";

interface ProfileAchievementStats {
  total_distance_km: string | number | null;
  total_trails_completed: string | number | null;
  total_meetups_hosted: string | number | null;
  total_incidents_reported: string | number | null;
  total_reviews_written: string | number | null;
}

interface LeaderboardRow {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  total_points: string | number;
  achievements_count: string | number;
}

function toNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getCriteriaTarget(criteriaValue: Record<string, unknown>): number {
  return toNumber(
    criteriaValue.target ??
      criteriaValue.value ??
      criteriaValue.count ??
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

function statForCriteria(userStats: ProfileAchievementStats, achievement: Achievement): number {
  const criteriaType = achievement.criteria_type.toLowerCase();

  if (criteriaType.includes("distance")) {
    return toNumber(userStats.total_distance_km);
  }

  if (criteriaType.includes("trail")) {
    return toNumber(userStats.total_trails_completed);
  }

  if (criteriaType.includes("meetup") || criteriaType.includes("host")) {
    return toNumber(userStats.total_meetups_hosted);
  }

  if (criteriaType.includes("incident") || criteriaType.includes("safety")) {
    return toNumber(userStats.total_incidents_reported);
  }

  if (criteriaType.includes("review")) {
    return toNumber(userStats.total_reviews_written);
  }

  const statKey = String(
    achievement.criteria_value.stat ??
      achievement.criteria_value.field ??
      achievement.criteria_value.profile_stat ??
      ""
  );

  return toNumber((userStats as unknown as Record<string, unknown>)[statKey]);
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

  const target = getCriteriaTarget(achievement.criteria_value);
  const progress = statForCriteria(userStats, achievement);
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

export async function checkAndAwardAchievements(userId: string): Promise<Achievement[]> {
  console.log("[achievements.checkAndAwardAchievements] ========== START ==========");
  console.log("[achievements.checkAndAwardAchievements] userId:", userId);

  const [profileResult, achievementsResult, progressResult] = await Promise.all([
    pool.query<ProfileAchievementStats>(
      `SELECT
         COALESCE(total_distance_km, 0) AS total_distance_km,
         COALESCE(total_trails_completed, 0) AS total_trails_completed,
         COALESCE(total_meetups_hosted, 0) AS total_meetups_hosted,
         COALESCE(total_incidents_reported, 0) AS total_incidents_reported,
         COALESCE(total_reviews_written, 0) AS total_reviews_written
       FROM profiles
       WHERE user_id = $1::uuid OR id = $1::uuid
       LIMIT 1`,
      [userId]
    ),
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

  const userStats = profileResult.rows[0];
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

    if (existing) {
      console.log("[achievements.checkAndAwardAchievements] Updating progress:", {
        achievement_id: achievement.id,
        user_achievement_id: existing.id,
        completed: criteria.completed,
      });
      const updateResult = await pool.query<UserAchievement>(
        `UPDATE user_achievements
         SET progress_current = $3,
             progress_target = $4,
             earned_at = CASE
               WHEN earned_at IS NULL AND $5::boolean THEN NOW()
               ELSE earned_at
             END,
             updated_at = NOW()
         WHERE id = $1::uuid
           AND user_id = $2::uuid
         RETURNING id, user_id, achievement_id, progress_current, progress_target, earned_at`,
        [existing.id, userId, criteria.progress, criteria.target, criteria.completed]
      );

      if (!existing.earned_at && updateResult.rows[0]?.earned_at) {
        newlyAwarded.push(achievement);
        await createAchievementNotification(userId, achievement);
      }

      continue;
    }

    console.log("[achievements.checkAndAwardAchievements] Inserting progress:", {
      achievement_id: achievement.id,
      completed: criteria.completed,
    });
    const insertResult = await pool.query<UserAchievement>(
      `INSERT INTO user_achievements (
         user_id,
         achievement_id,
         progress_current,
         progress_target,
         earned_at
       )
       VALUES ($1::uuid, $2::uuid, $3, $4, CASE WHEN $5::boolean THEN NOW() ELSE NULL END)
       RETURNING id, user_id, achievement_id, progress_current, progress_target, earned_at`,
      [userId, achievement.id, criteria.progress, criteria.target, criteria.completed]
    );

    if (insertResult.rows[0]?.earned_at) {
      newlyAwarded.push(achievement);
      await createAchievementNotification(userId, achievement);
    }
  }

  console.log("[achievements.checkAndAwardAchievements] Newly awarded:", newlyAwarded.length);
  return newlyAwarded;
}

export async function updateUserStats(
  userId: string,
  stats: { distance?: number; trails?: number; meetups?: number; incidents?: number; reviews?: number }
): Promise<void> {
  console.log("[achievements.updateUserStats] ========== START ==========");
  console.log("[achievements.updateUserStats] Params:", { userId, stats });

  await pool.query(
    `UPDATE profiles
     SET total_distance_km = COALESCE(total_distance_km, 0) + $2,
         total_trails_completed = COALESCE(total_trails_completed, 0) + $3::int,
         total_meetups_hosted = COALESCE(total_meetups_hosted, 0) + $4::int,
         total_incidents_reported = COALESCE(total_incidents_reported, 0) + $5::int,
         total_reviews_written = COALESCE(total_reviews_written, 0) + $6::int,
         updated_at = NOW()
     WHERE user_id = $1::uuid OR id = $1::uuid`,
    [
      userId,
      stats.distance ?? 0,
      stats.trails ?? 0,
      stats.meetups ?? 0,
      stats.incidents ?? 0,
      stats.reviews ?? 0,
    ]
  );

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

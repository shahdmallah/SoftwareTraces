import type { Request, Response } from "express";
import { pool } from "../../db/pool";
import { requireAuth } from "../../middleware/auth";
import { evaluateAchievements } from "../../services/achievementService";

export async function getAchievements(_req: Request, res: Response): Promise<void> {
  const result = await pool.query("SELECT * FROM achievements ORDER BY points ASC");
  res.json({ data: result.rows });
}

export async function getUserAchievements(req: Request, res: Response): Promise<void> {
  const result = await pool.query(
    `
    SELECT ua.*, a.code, a.name, a.description, a.icon, a.points
    FROM user_achievements ua
    JOIN achievements a ON a.id = ua.achievement_id
    WHERE ua.user_id = $1
    ORDER BY ua.unlocked_at DESC
    `,
    [req.params.userId]
  );
  res.json({ data: result.rows });
}

export async function checkAchievements(req: Request, res: Response): Promise<void> {
  const auth = requireAuth(req);
  const [available, existing, profile] = await Promise.all([
    pool.query("SELECT * FROM achievements ORDER BY points ASC"),
    pool.query("SELECT * FROM user_achievements WHERE user_id = $1", [auth.sub]),
    pool.query("SELECT total_activities, total_elevation_gain_m FROM profiles WHERE user_id = $1", [auth.sub])
  ]);

  const unlocks = evaluateAchievements(available.rows, existing.rows, {
    totalActivities: profile.rows[0]?.total_activities ?? 0,
    totalElevationGainM: Number(profile.rows[0]?.total_elevation_gain_m ?? 0)
  });

  for (const achievement of unlocks) {
    await pool.query(
      "INSERT INTO user_achievements (achievement_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [achievement.id, auth.sub]
    );
  }

  res.json({ data: unlocks });
}

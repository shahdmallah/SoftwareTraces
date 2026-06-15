import type { Request, Response } from "express";
import { requireAuth } from "../../middleware/auth";
import {
  checkAndAwardAchievements,
  getAllAchievements,
  getLeaderboard as getLeaderboardService,
  getUserAchievements as getUserAchievementsService,
} from "./achievements.service";

function getRequestId(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] : (value ?? "");
}

export async function getAchievements(req: Request, res: Response): Promise<void> {
  console.log("[achievements.controller.getAchievements] ========== START ==========");
  const userId = req.auth?.sub;
  console.log("[achievements.controller.getAchievements] optional userId:", userId);

  const achievements = await getAllAchievements(userId);
  res.json({ data: achievements });
}

export async function getUserAchievements(req: Request, res: Response): Promise<void> {
  console.log("[achievements.controller.getUserAchievements] ========== START ==========");
  const userId = getRequestId(req.params.userId);
  console.log("[achievements.controller.getUserAchievements] userId:", userId);

  const achievements = await getUserAchievementsService(userId);
  res.json({ data: achievements });
}

export async function getMyAchievements(req: Request, res: Response): Promise<void> {
  console.log("[achievements.controller.getMyAchievements] ========== START ==========");
  const auth = requireAuth(req);
  console.log("[achievements.controller.getMyAchievements] userId:", auth.sub);

  const achievements = await getAllAchievements(auth.sub);
  res.json({ data: achievements });
}

export async function getLeaderboard(req: Request, res: Response): Promise<void> {
  console.log("[achievements.controller.getLeaderboard] ========== START ==========");
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  console.log("[achievements.controller.getLeaderboard] limit:", limit);

  const leaderboard = await getLeaderboardService(limit);
  res.json({ data: leaderboard });
}

export async function checkAchievements(req: Request, res: Response): Promise<void> {
  console.log("[achievements.controller.checkAchievements] ========== START ==========");
  const auth = requireAuth(req);
  console.log("[achievements.controller.checkAchievements] userId:", auth.sub);

  const awarded = await checkAndAwardAchievements(auth.sub);
  res.json({ data: awarded });
}

import type { Request, Response } from "express";
import { requireAuth } from "../../middleware/auth";
import { getAllAchievements } from "../achievements/achievements.service";

export async function getBadges(_req: Request, res: Response): Promise<void> {
  const badges = await getAllAchievements();
  res.json({
    data: badges.map((badge) => ({
      ...badge,
      badge_id: badge.id,
      icon_url: badge.badge_icon_url,
    })),
  });
}

export async function getMyBadges(req: Request, res: Response): Promise<void> {
  const auth = requireAuth(req);
  const badges = await getAllAchievements(auth.sub);
  res.json({
    data: badges
      .filter((badge) => badge.earned)
      .map((badge) => ({
        ...badge,
        badge_id: badge.id,
        icon_url: badge.badge_icon_url,
      })),
  });
}

import type { Achievement, UserAchievement } from "@traces/shared-types";

export interface AchievementEvaluationInput {
  totalActivities: number;
  totalElevationGainM: number;
}

/**
 * Evaluates which achievements should unlock for the user snapshot.
 */
export function evaluateAchievements(
  available: Achievement[],
  existing: UserAchievement[],
  input: AchievementEvaluationInput
): Achievement[] {
  const unlocked = new Set(existing.map((item) => item.achievementId));

  return available.filter((achievement) => {
    if (unlocked.has(achievement.id)) {
      return false;
    }

    switch (achievement.code) {
      case "FIRST_STEPS":
        return input.totalActivities >= 1;
      case "CLIMBER":
        return input.totalElevationGainM >= 1000;
      case "EXPLORER":
        return input.totalActivities >= 10;
      default:
        return false;
    }
  });
}

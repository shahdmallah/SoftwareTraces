export interface Achievement {
  id: string;
  code: string;
  name: string;
  name_ar: string | null;
  description: string;
  description_ar: string | null;
  category: string;
  badge_icon_url: string | null;
  criteria_type: string;
  criteria_value: Record<string, unknown>;
  points: number;
}

export interface UserAchievement {
  id: string;
  user_id: string;
  achievement_id: string;
  progress_current: number;
  progress_target: number;
  earned_at: string | null;
}

export interface AchievementWithProgress extends Achievement {
  progress_current: number;
  progress_target: number;
  earned: boolean;
  earned_at: string | null;
}

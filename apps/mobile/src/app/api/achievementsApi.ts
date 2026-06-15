import { apiRequest } from './client';

type Envelope<T> = {
  data: T;
};

export type Achievement = {
  id: string;
  code?: string;
  name?: string;
  name_ar?: string | null;
  title?: string;
  description?: string | null;
  description_ar?: string | null;
  category?: string | null;
  badge_icon_url?: string | null;
  criteria_type?: string | null;
  criteria_value?: Record<string, unknown> | null;
  points?: number;
  progress_current?: number;
  progress_target?: number;
  earned?: boolean;
  earned_at?: string | null;
};

export type UserAchievement = Achievement & {
  earned_at?: string | null;
  progress?: number;
};

export type LeaderboardEntry = {
  user_id: string;
  full_name: string;
  avatar_url: string;
  total_points: number;
  achievements_count: number;
};

export async function getAchievements() {
  const response = await apiRequest<Envelope<Achievement[]>>('/api/achievements');
  return response.data;
}

export async function getUserAchievements(userId: string) {
  const response = await apiRequest<Envelope<UserAchievement[]>>(`/api/achievements/users/${userId}`);
  return response.data;
}

export async function getMyAchievements() {
  const response = await apiRequest<Envelope<UserAchievement[]>>('/api/achievements/me');
  return response.data;
}

export async function checkAchievements() {
  const response = await apiRequest<Envelope<UserAchievement[]>>('/api/achievements/check', {
    method: 'POST',
  });
  return response.data;
}

export async function getLeaderboard(limit = 20) {
  const response = await apiRequest<Envelope<LeaderboardEntry[]>>('/api/achievements/leaderboard', {}, { limit });
  return response.data;
}

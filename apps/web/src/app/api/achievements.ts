import { apiRequest } from './client';

type Envelope<T> = { data: T; pagination?: unknown };

export type Achievement = {
  id: string;
  code: string;
  name: string;
  name_ar?: string | null;
  description?: string | null;
  description_ar?: string | null;
  category?: string | null;
  badge_icon_url?: string | null;
  points: number;
  earned?: boolean;
  earned_at?: string | null;
};

export async function getAchievements() {
  const response = await apiRequest<Envelope<Achievement[]>>('/api/achievements');
  return response.data;
}

export async function getMyAchievements() {
  const response = await apiRequest<Envelope<Achievement[]>>('/api/achievements/me');
  return response.data;
}

export type LeaderboardEntry = {
  user_id: string;
  full_name: string;
  avatar_url: string;
  total_points: number;
  achievements_count: number;
};

export async function getLeaderboard(limit = 20) {
  const response = await apiRequest<Envelope<LeaderboardEntry[]>>('/api/achievements/leaderboard', {}, { limit });
  return response.data;
}

export async function checkAchievements() {
  const response = await apiRequest<Envelope<Achievement[]>>('/api/achievements/check', { method: 'POST' });
  return response.data;
}

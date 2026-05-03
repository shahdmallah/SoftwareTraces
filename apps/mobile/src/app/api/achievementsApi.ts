import { apiRequest } from './client';

type Envelope<T> = {
  data: T;
};

export type Achievement = {
  id: string;
  name?: string;
  title?: string;
  description?: string | null;
  points?: number;
};

export type UserAchievement = Achievement & {
  earned_at?: string | null;
  progress?: number;
};

export async function getAchievements() {
  const response = await apiRequest<Envelope<Achievement[]>>('/api/achievements');
  return response.data;
}

export async function getUserAchievements(userId: string) {
  const response = await apiRequest<Envelope<UserAchievement[]>>(`/api/achievements/users/${userId}/achievements`);
  return response.data;
}

export async function checkAchievements() {
  const response = await apiRequest<Envelope<UserAchievement[]>>('/api/achievements/check', {
    method: 'POST',
  });
  return response.data;
}

import { apiRequest } from './client';

type Envelope<T> = { data: T };

export type Badge = {
  id: string;
  badge_id?: string;
  code?: string;
  name?: string;
  name_ar?: string | null;
  description?: string | null;
  badge_icon_url?: string | null;
  icon_url?: string | null;
  points?: number;
  earned?: boolean;
  earned_at?: string | null;
};

export async function getBadges() {
  const response = await apiRequest<Envelope<Badge[]>>('/api/badges');
  return response.data;
}

export async function getMyBadges() {
  const response = await apiRequest<Envelope<Badge[]>>('/api/badges/me');
  return response.data;
}

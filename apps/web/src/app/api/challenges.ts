import { apiRequest } from './client';

type Envelope<T> = { data: T };

export type Challenge = {
  id: string;
  title: string;
  description: string;
  goal_type: string;
  goal_value: number;
  start_at: string;
  end_at: string;
  participant_count?: number;
  progress_value?: number;
  participant_status?: string | null;
};

export async function listChallenges() {
  const response = await apiRequest<Envelope<Challenge[]>>('/api/challenges');
  return response.data;
}

export async function getMyChallenges() {
  const response = await apiRequest<Envelope<Challenge[]>>('/api/challenges/me');
  return response.data;
}

export async function getChallenge(id: string) {
  const response = await apiRequest<Envelope<Challenge>>(`/api/challenges/${id}`);
  return response.data;
}

export async function joinChallenge(id: string) {
  const response = await apiRequest<Envelope<unknown>>(`/api/challenges/${id}/join`, { method: 'POST' });
  return response.data;
}

import { apiRequest } from './client';

type Envelope<T> = {
  data: T;
};

export type ChallengeGoalType =
  | 'complete_trails'
  | 'total_distance_km'
  | 'complete_difficulty'
  | 'join_meetups'
  | 'submit_safety_reports'
  | 'checkpoint_reports';

export type Challenge = {
  id: string;
  title: string;
  description: string;
  goal_type: ChallengeGoalType;
  goal_value: number;
  goal_metadata?: Record<string, unknown> | null;
  start_at: string;
  end_at: string;
  reward_badge_id?: string | null;
  reward_badge_name?: string | null;
  reward_points?: number;
  visibility?: 'public' | 'private';
  status?: 'draft' | 'published' | 'archived';
  participant_count?: number;
  completed_count?: number;
  progress_value?: number;
  participant_status?: 'joined' | 'completed' | string | null;
  joined_at?: string | null;
  completed_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

export async function listChallenges() {
  const response = await apiRequest<Envelope<Challenge[]>>('/api/challenges');
  return response.data;
}

export async function getMyChallenges() {
  const response = await apiRequest<Envelope<Challenge[]>>('/api/challenges/me');
  return response.data;
}

export async function getChallenge(challengeId: string) {
  const response = await apiRequest<Envelope<Challenge>>(`/api/challenges/${challengeId}`);
  return response.data;
}

export async function joinChallenge(challengeId: string) {
  const response = await apiRequest<Envelope<unknown>>(`/api/challenges/${challengeId}/join`, {
    method: 'POST',
  });
  return response.data;
}

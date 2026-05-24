import { apiRequest } from './client';

type Envelope<T> = {
  data: T;
};

export type NavigationSession = {
  id: string;
  trail_id: string;
  started_at: string;
  status: string;
  instruction?: string;
};

export type NavigationPositionResult = {
  session_id: string;
  off_track: boolean;
  deviation_meters: number;
  progress: number;
  progress_percent: number;
  milestones: string[];
  instruction: string;
};

export type NavigationEndResult = {
  id: string;
  trail_id: string;
  started_at: string;
  ended_at: string;
  status: string;
  off_trail_count: number;
  total_off_trail_duration_seconds: number;
};

export async function startNavigationSession(trailId: string) {
  const response = await apiRequest<Envelope<NavigationSession>>('/api/navigation/start', {
    method: 'POST',
    body: JSON.stringify({ trail_id: trailId }),
  });
  return response.data;
}

export async function checkNavigationPosition(
  sessionId: string,
  payload: {
    latitude: number;
    longitude: number;
    heading?: number | null;
    timestamp?: string;
  },
) {
  const response = await apiRequest<Envelope<NavigationPositionResult>>(`/api/navigation/${sessionId}/location`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return response.data;
}

export async function endNavigationSession(sessionId: string) {
  const response = await apiRequest<Envelope<NavigationEndResult>>(`/api/navigation/${sessionId}/end`, {
    method: 'POST',
  });
  return response.data;
}

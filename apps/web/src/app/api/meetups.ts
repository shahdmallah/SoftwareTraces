import { apiRequest } from './client';

type Envelope<T> = { data: T };

export type Meetup = {
  id: string;
  title: string;
  description?: string | null;
  trail_id?: string | null;
  trail_name?: string | null;
  scheduled_at: string;
  participant_count?: number;
  is_joined?: boolean;
};

export async function listMeetups(params: { page?: number; limit?: number } = {}) {
  const response = await apiRequest<Envelope<Meetup[]>>('/api/meetups', {}, params);
  return response.data;
}

export async function getMeetup(id: string) {
  const response = await apiRequest<Envelope<Meetup>>(`/api/meetups/${id}`);
  return response.data;
}

export async function createMeetup(payload: Record<string, unknown>) {
  const response = await apiRequest<Envelope<Meetup>>('/api/meetups', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return response.data;
}

export async function joinMeetup(id: string) {
  const response = await apiRequest<Envelope<unknown>>(`/api/meetups/${id}/join`, { method: 'POST' });
  return response.data;
}

export async function leaveMeetup(id: string) {
  const response = await apiRequest<Envelope<unknown>>(`/api/meetups/${id}/join`, { method: 'DELETE' });
  return response.data;
}

import { apiRequest } from './client';

export type MeetupVisibility = 'public' | 'private' | 'friends';
export type ViewerMeetupStatus = 'host' | 'joined' | 'invited' | 'none';

export type MeetupHost = {
  id: string;
  full_name: string;
  avatar_url: string | null;
  username?: string | null;
};

export type Meetup = {
  id: string;
  trail_id: string | null;
  host: MeetupHost;
  title: string;
  title_ar?: string | null;
  note: string | null;
  note_ar?: string | null;
  vibe: string | null;
  vibe_ar?: string | null;
  cover_url: string | null;
  starts_at: string;
  meeting_place: string | null;
  meeting_latitude: number | null;
  meeting_longitude: number | null;
  visibility: MeetupVisibility;
  max_headcount: number;
  people_joined: number;
  spots_left: number;
  viewer_status: ViewerMeetupStatus;
  bring_items: string[];
  invited_user_ids?: string[];
  created_at: string;
  updated_at: string;
};

export type CreateMeetupInput = {
  trail_id?: string | null;
  title: string;
  title_ar?: string | null;
  note?: string | null;
  note_ar?: string | null;
  vibe?: string | null;
  vibe_ar?: string | null;
  cover_url?: string | null;
  starts_at: string;
  meeting_place?: string | null;
  meeting_latitude?: number | null;
  meeting_longitude?: number | null;
  visibility: MeetupVisibility;
  max_headcount: number;
  bring_items?: string[];
  invited_user_ids?: string[];
};

export type JoinMeetupResult = {
  meetup_id: string;
  status: 'joined';
  guest_count: number;
  people_joined: number;
  spots_left: number;
};

export type LeaveMeetupResult = {
  people_joined: number;
  spots_left: number;
};

type MeetupEnvelope<T> = {
  data: T;
};

export type ListMeetupsResponse = {
  data: Meetup[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
};

export async function listMeetups(params: { page?: number; limit?: number; trail_id?: string | null } = {}) {
  return apiRequest<ListMeetupsResponse>('/api/meetups', {}, params);
}

export async function getMeetup(meetupId: string) {
  const response = await apiRequest<MeetupEnvelope<Meetup>>(`/api/meetups/${meetupId}`);
  return response.data;
}

export async function createMeetup(input: CreateMeetupInput) {
  const response = await apiRequest<MeetupEnvelope<Meetup>>('/api/meetups', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return response.data;
}

export async function joinMeetup(meetupId: string, guestCount = 0) {
  const response = await apiRequest<MeetupEnvelope<JoinMeetupResult>>(`/api/meetups/${meetupId}/join`, {
    method: 'POST',
    body: JSON.stringify({ guest_count: guestCount }),
  });
  return response.data;
}

export async function leaveMeetup(meetupId: string) {
  const response = await apiRequest<MeetupEnvelope<LeaveMeetupResult>>(`/api/meetups/${meetupId}/join`, {
    method: 'DELETE',
  });
  return response.data;
}

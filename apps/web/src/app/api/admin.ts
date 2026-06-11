import { apiRequest } from './client';

export type AdminRecord = Record<string, unknown> & {
  id?: string;
  _id?: string;
  challenge_id?: string;
  badge_id?: string;
  location_id?: string;
  incident_id?: string;
  report_id?: string;
  event_id?: string;
};

export type AdminDashboard = Record<string, unknown>;

export type AdminUsersPage = {
  users: AdminRecord[];
  page: number;
  limit: number;
  total: number;
  pages: number;
};

export type ChallengePayload = {
  title: string;
  description: string;
  goal_type:
    | 'complete_trails'
    | 'total_distance_km'
    | 'complete_difficulty'
    | 'join_meetups'
    | 'submit_safety_reports'
    | 'checkpoint_reports';
  goal_value: number;
  goal_metadata: Record<string, unknown> | null;
  start_at: string;
  end_at: string;
  visibility: 'public' | 'private';
  status: 'draft' | 'published' | 'archived';
  reward_badge_id: string | null;
  reward_points: number;
};

// Fixed: criteria_value is a JSON object (not number); added name_ar, description_ar
export type BadgePayload = {
  code: string;
  name: string;
  name_ar?: string | null;
  description: string;
  description_ar?: string | null;
  badge_icon_url?: string | null;
  category: string;
  criteria_type: string;
  criteria_value: Record<string, unknown>;
  points: number;
  is_active: boolean;
};

export type IncidentModerationPayload = {
  moderation_status: 'pending' | 'approved' | 'verified' | 'rejected' | 'hidden';
  moderation_note: string | null;
};

// Fixed: removed `source` (not in backend schema); added `operating_hours`
export type DangerousLocationPayload = {
  name: string;
  name_ar: string | null;
  location_type: string;
  latitude: number;
  longitude: number;
  danger_radius_meters?: number;
  risk_level?: string;
  operating_hours?: string | null;
  description?: string | null;
  description_ar?: string | null;
  is_active?: boolean;
};

function unwrapEntity<T>(payload: unknown): T {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}

function unwrapList<T extends AdminRecord>(payload: unknown, preferredKey: string): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (!payload || typeof payload !== 'object') return [];

  const record = payload as Record<string, unknown>;
  const candidateKeys = [
    preferredKey,
    'items',
    'data',
    'results',
    'rows',
    'logs',
    'reports',
    'events',
    'incidents',
    'locations',
    'badges',
    'challenges',
    'users',
  ];

  for (const key of candidateKeys) {
    const value = record[key];
    if (Array.isArray(value)) return value as T[];
  }

  return [];
}

export function getAdminId(item: AdminRecord | null | undefined) {
  if (!item) return '';
  return String(
    item.id ??
      item._id ??
      item.challenge_id ??
      item.badge_id ??
      item.location_id ??
      item.incident_id ??
      item.report_id ??
      item.event_id ??
      '',
  );
}

export async function getAdminDashboard() {
  const response = await apiRequest<{ data: AdminDashboard }>('/api/admin/dashboard');
  return response.data;
}

export async function getAdminUsers(query?: { q?: string; page?: number; limit?: number }) {
  const response = await apiRequest<{ data: AdminUsersPage }>('/api/admin/users', {}, query);
  return response.data;
}

export async function getAdminChallenges() {
  const response = await apiRequest<unknown>('/api/admin/challenges');
  return unwrapList<AdminRecord>(response, 'challenges');
}

export async function createAdminChallenge(payload: ChallengePayload) {
  const response = await apiRequest<unknown>('/api/admin/challenges', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return unwrapEntity<AdminRecord>(response);
}

export async function getAdminChallenge(id: string) {
  const response = await apiRequest<unknown>(`/api/admin/challenges/${id}`);
  return unwrapEntity<AdminRecord>(response);
}

export async function updateAdminChallenge(id: string, payload: ChallengePayload) {
  const response = await apiRequest<unknown>(`/api/admin/challenges/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  return unwrapEntity<AdminRecord>(response);
}

export async function deleteAdminChallenge(id: string) {
  const response = await apiRequest<unknown>(`/api/admin/challenges/${id}`, { method: 'DELETE' });
  return unwrapEntity<AdminRecord>(response);
}

export async function publishAdminChallenge(id: string) {
  const response = await apiRequest<unknown>(`/api/admin/challenges/${id}/publish`, { method: 'POST' });
  return unwrapEntity<AdminRecord>(response);
}

export async function archiveAdminChallenge(id: string) {
  const response = await apiRequest<unknown>(`/api/admin/challenges/${id}/archive`, { method: 'POST' });
  return unwrapEntity<AdminRecord>(response);
}

export async function recalculateAdminChallenge(id: string) {
  const response = await apiRequest<unknown>(`/api/admin/challenges/${id}/recalculate`, { method: 'POST' });
  return unwrapEntity<AdminRecord>(response);
}

export async function getAdminBadges() {
  const response = await apiRequest<unknown>('/api/admin/badges');
  return unwrapList<AdminRecord>(response, 'badges');
}

export async function createAdminBadge(payload: BadgePayload) {
  const response = await apiRequest<unknown>('/api/admin/badges', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return unwrapEntity<AdminRecord>(response);
}

export async function getAdminBadge(id: string) {
  const response = await apiRequest<unknown>(`/api/admin/badges/${id}`);
  return unwrapEntity<AdminRecord>(response);
}

export async function updateAdminBadge(id: string, payload: BadgePayload) {
  const response = await apiRequest<unknown>(`/api/admin/badges/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  return unwrapEntity<AdminRecord>(response);
}

export async function deleteAdminBadge(id: string) {
  const response = await apiRequest<unknown>(`/api/admin/badges/${id}`, { method: 'DELETE' });
  return unwrapEntity<AdminRecord>(response);
}

// Fixed: accepts optional status filter matching backend ?status= query param
export async function getAdminIncidents(status?: string) {
  const query = status ? { status } : undefined;
  const response = await apiRequest<unknown>('/api/admin/incidents', {}, query);
  return unwrapList<AdminRecord>(response, 'incidents');
}

export async function updateIncidentModeration(id: string, payload: IncidentModerationPayload) {
  const response = await apiRequest<unknown>(`/api/admin/incidents/${id}/moderation`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  return unwrapEntity<AdminRecord>(response);
}

export async function getAdminDangerousLocations() {
  const response = await apiRequest<unknown>('/api/admin/dangerous-locations');
  return unwrapList<AdminRecord>(response, 'locations');
}

export async function createAdminDangerousLocation(payload: DangerousLocationPayload) {
  const response = await apiRequest<unknown>('/api/admin/dangerous-locations', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return unwrapEntity<AdminRecord>(response);
}

export async function updateAdminDangerousLocation(id: string, payload: DangerousLocationPayload) {
  const response = await apiRequest<unknown>(`/api/admin/dangerous-locations/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  return unwrapEntity<AdminRecord>(response);
}

export async function deleteAdminDangerousLocation(id: string) {
  const response = await apiRequest<unknown>(`/api/admin/dangerous-locations/${id}`, { method: 'DELETE' });
  return unwrapEntity<AdminRecord>(response);
}

export async function getAdminCheckpointReports(query?: Record<string, string>) {
  const response = await apiRequest<unknown>('/api/admin/checkpoint-reports', {}, query);
  return unwrapList<AdminRecord>(response, 'reports');
}

export async function getAdminSosEvents(query?: Record<string, string>) {
  const response = await apiRequest<unknown>('/api/admin/sos-events', {}, query);
  return unwrapList<AdminRecord>(response, 'events');
}

export async function getAdminOchaLogs() {
  const response = await apiRequest<unknown>('/api/admin/ocha/logs');
  return unwrapList<AdminRecord>(response, 'logs');
}

export async function fetchAdminOcha() {
  const response = await apiRequest<unknown>('/api/admin/ocha/fetch', { method: 'POST' });
  return unwrapEntity<AdminRecord>(response);
}

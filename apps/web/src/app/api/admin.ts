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

export type ChallengePayload = {
  title: string;
  description: string;
  goal_type: string;
  goal_value: number;
  goal_metadata: Record<string, unknown> | null;
  start_at: string | null;
  end_at: string | null;
  visibility: string;
  status: string;
  reward_badge_id: string | null;
  reward_points: number;
};

export type BadgePayload = {
  code: string;
  name: string;
  description: string;
  badge_icon_url: string | null;
  category: string;
  criteria_type: string;
  criteria_value: number;
  points: number;
  is_active: boolean;
};

export type IncidentModerationPayload = {
  moderation_status: 'pending' | 'approved' | 'rejected' | 'hidden';
  moderation_note: string | null;
};

export type DangerousLocationPayload = {
  name: string;
  name_ar: string | null;
  location_type: string;
  latitude: number;
  longitude: number;
  danger_radius_meters: number;
  risk_level: string;
  description: string;
  description_ar: string | null;
  source: string;
  is_active: boolean;
};

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
  return apiRequest<AdminDashboard>('/api/admin/dashboard');
}

export async function getAdminChallenges() {
  const response = await apiRequest<unknown>('/api/admin/challenges');
  return unwrapList<AdminRecord>(response, 'challenges');
}

export async function createAdminChallenge(payload: ChallengePayload) {
  return apiRequest<AdminRecord>('/api/admin/challenges', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getAdminChallenge(id: string) {
  return apiRequest<AdminRecord>(`/api/admin/challenges/${id}`);
}

export async function updateAdminChallenge(id: string, payload: ChallengePayload) {
  return apiRequest<AdminRecord>(`/api/admin/challenges/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteAdminChallenge(id: string) {
  return apiRequest<AdminRecord>(`/api/admin/challenges/${id}`, { method: 'DELETE' });
}

export async function publishAdminChallenge(id: string) {
  return apiRequest<AdminRecord>(`/api/admin/challenges/${id}/publish`, { method: 'POST' });
}

export async function archiveAdminChallenge(id: string) {
  return apiRequest<AdminRecord>(`/api/admin/challenges/${id}/archive`, { method: 'POST' });
}

export async function recalculateAdminChallenge(id: string) {
  return apiRequest<AdminRecord>(`/api/admin/challenges/${id}/recalculate`, { method: 'POST' });
}

export async function getAdminBadges() {
  const response = await apiRequest<unknown>('/api/admin/badges');
  return unwrapList<AdminRecord>(response, 'badges');
}

export async function createAdminBadge(payload: BadgePayload) {
  return apiRequest<AdminRecord>('/api/admin/badges', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getAdminBadge(id: string) {
  return apiRequest<AdminRecord>(`/api/admin/badges/${id}`);
}

export async function updateAdminBadge(id: string, payload: BadgePayload) {
  return apiRequest<AdminRecord>(`/api/admin/badges/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteAdminBadge(id: string) {
  return apiRequest<AdminRecord>(`/api/admin/badges/${id}`, { method: 'DELETE' });
}

export async function getAdminIncidents() {
  const response = await apiRequest<unknown>('/api/admin/incidents');
  return unwrapList<AdminRecord>(response, 'incidents');
}

export async function updateIncidentModeration(id: string, payload: IncidentModerationPayload) {
  return apiRequest<AdminRecord>(`/api/admin/incidents/${id}/moderation`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function getAdminDangerousLocations() {
  const response = await apiRequest<unknown>('/api/admin/dangerous-locations');
  return unwrapList<AdminRecord>(response, 'locations');
}

export async function createAdminDangerousLocation(payload: DangerousLocationPayload) {
  return apiRequest<AdminRecord>('/api/admin/dangerous-locations', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateAdminDangerousLocation(id: string, payload: DangerousLocationPayload) {
  return apiRequest<AdminRecord>(`/api/admin/dangerous-locations/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteAdminDangerousLocation(id: string) {
  return apiRequest<AdminRecord>(`/api/admin/dangerous-locations/${id}`, { method: 'DELETE' });
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
  return apiRequest<AdminRecord>('/api/admin/ocha/fetch', { method: 'POST' });
}

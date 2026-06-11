import { apiRequest } from './client';

type Envelope<T> = { data: T };

export type SafetySeverity = 'critical' | 'high' | 'medium' | 'low';

export type IncidentType =
  | 'settler_attack'
  | 'road_block'
  | 'military_checkpoint'
  | 'flying_checkpoint'
  | 'harassment'
  | 'land_confiscation'
  | 'tree_uprooting'
  | 'settler_presence'
  | 'military_raid'
  | 'other';

export type NearbySafetyAlert = {
  id: string;
  kind: 'location' | 'incident';
  name?: string;
  incident_type?: IncidentType | string;
  severity?: SafetySeverity | string;
  risk_level?: string;
  latitude: number;
  longitude: number;
  distance_meters: number;
  headline?: string | null;
  description?: string | null;
  location_type?: string;
  trust_level?: string;
  verification_label?: string;
  confirmation_label?: string;
  dispute_label?: string;
  confirmations_count?: number;
  disputes_count?: number;
};

export type TrailSafety = {
  safety_score: number;
  risk_level: string;
  nearest_settlement: { name: string; distance_meters: number } | null;
  nearest_checkpoint: { name: string; distance_meters: number } | null;
  incident_count_48h: number;
  warnings: string[];
  cached?: boolean;
};

export type ReportedIncident = {
  id: string;
  moderation_status: string;
  confirmations_count: number;
  disputes_count: number;
  community_confidence_score?: number;
  trust_level: string;
  verification_label?: string;
};

export const INCIDENT_TYPES: Array<{ value: IncidentType; label: string }> = [
  { value: 'settler_attack', label: 'Settler attack' },
  { value: 'road_block', label: 'Road block' },
  { value: 'military_checkpoint', label: 'Military checkpoint' },
  { value: 'flying_checkpoint', label: 'Flying checkpoint' },
  { value: 'harassment', label: 'Harassment' },
  { value: 'land_confiscation', label: 'Land confiscation' },
  { value: 'tree_uprooting', label: 'Tree uprooting' },
  { value: 'settler_presence', label: 'Settler presence' },
  { value: 'military_raid', label: 'Military raid' },
  { value: 'other', label: 'Other' },
];

export const SEVERITY_OPTIONS: Array<{ value: SafetySeverity; label: string }> = [
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

export function alertTitle(alert: NearbySafetyAlert) {
  if (alert.kind === 'location') {
    return alert.name ?? 'Danger zone';
  }
  return alert.headline?.trim() || String(alert.incident_type ?? 'Incident').replace(/_/g, ' ');
}

export async function getNearbySafetyAlerts(params: { lat: number; lng: number; radius?: number; trail_id?: string }) {
  const response = await apiRequest<Envelope<NearbySafetyAlert[]>>('/api/safety/nearby-alerts', {}, params);
  return response.data;
}

export async function getTrailSafety(trailId: string) {
  const response = await apiRequest<Envelope<TrailSafety>>(`/api/safety/trails/${trailId}/safety`);
  return response.data;
}

export async function reportSafetyIncident(payload: {
  incident_type: IncidentType | string;
  severity: SafetySeverity | string;
  latitude: number;
  longitude: number;
  location_name?: string;
  description?: string;
}) {
  const response = await apiRequest<Envelope<ReportedIncident>>('/api/safety/report-incident', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return response.data;
}

export async function submitIncidentFeedback(
  incidentId: string,
  payload: { action: 'confirm' | 'dispute' | 'note'; comment?: string },
) {
  const response = await apiRequest<Envelope<{ incident: { confirmations_count: number; disputes_count: number } }>>(
    `/api/safety/incidents/${incidentId}/feedback`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
  return response.data;
}

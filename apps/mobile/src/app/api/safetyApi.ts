import { apiRequest } from './client';

export type SafetySeverity = 'critical' | 'high' | 'medium' | 'low';
export type TrailRiskLevel = 'safe' | 'caution' | 'dangerous' | 'avoid';
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

export type NearbySafetyAlert =
  | {
      id: string;
      kind: 'location';
      name: string;
      name_ar?: string | null;
      location_type: string;
      latitude: number;
      longitude: number;
      danger_radius_meters?: number;
      distance_meters: number;
      risk_level: SafetySeverity;
    }
  | {
      id: string;
      kind: 'incident';
      incident_type: IncidentType;
      severity: SafetySeverity;
      latitude: number;
      longitude: number;
      distance_meters: number;
      description?: string | null;
      headline?: string | null;
      source?: string;
      source_name?: string | null;
      source_url?: string | null;
      reported_at?: string;
      expires_at?: string;
    };

export type TrailSafety = {
  safety_score: number;
  risk_level: TrailRiskLevel;
  nearest_settlement: { name: string; distance_meters: number } | null;
  nearest_checkpoint: { name: string; distance_meters: number } | null;
  incident_count_48h: number;
  warnings: string[];
  cached?: boolean;
};

type Envelope<T> = { data: T };

export function getRiskColor(level?: SafetySeverity | TrailRiskLevel | string) {
  switch (level) {
    case 'critical':
    case 'avoid':
      return '#8B0000';
    case 'high':
    case 'dangerous':
      return '#FF0000';
    case 'medium':
    case 'caution':
      return '#FFA500';
    case 'low':
      return '#D4A843';
    case 'safe':
      return '#1E7A46';
    default:
      return '#8A7A6A';
  }
}

export function getSafetyBand(score: number) {
  if (score >= 80) return { label: 'Safe', color: '#1E7A46' };
  if (score >= 60) return { label: 'Caution', color: '#D4A843' };
  if (score >= 40) return { label: 'Dangerous', color: '#E87522' };
  return { label: 'Avoid', color: '#8B0000' };
}

export function formatSafetyDistance(meters: number | null | undefined) {
  const value = Number(meters);
  if (!Number.isFinite(value)) return 'unknown distance';
  if (value >= 1000) return `${(value / 1000).toFixed(1)} km`;
  return `${Math.round(value)} m`;
}

export function safetyAlertTitle(alert: NearbySafetyAlert) {
  if (alert.kind === 'location') {
    return alert.name;
  }

  return alert.headline?.trim() || alert.incident_type.replace(/_/g, ' ');
}

export function safetyAlertWarning(alert: NearbySafetyAlert) {
  const distance = formatSafetyDistance(alert.distance_meters);

  if (alert.kind === 'location') {
    return `${alert.name} ${alert.location_type.replace(/_/g, ' ')} ${distance} away. Exercise caution.`;
  }

  return `${alert.incident_type.replace(/_/g, ' ')} reported ${distance} away.`;
}

export async function getNearbySafetyAlerts(params: { lat: number; lng: number; radius?: number }) {
  const response = await apiRequest<Envelope<NearbySafetyAlert[]>>('/api/safety/nearby-alerts', {}, params);
  return response.data;
}

export async function getTrailSafety(trailId: string) {
  const response = await apiRequest<Envelope<TrailSafety>>(`/api/safety/trails/${trailId}/safety`);
  return response.data;
}

export async function reportIncident(payload: {
  incident_type: IncidentType;
  severity: SafetySeverity;
  latitude: number;
  longitude: number;
  location_name?: string;
  description?: string;
}) {
  return apiRequest<Envelope<{ id: string }>>('/api/safety/report-incident', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

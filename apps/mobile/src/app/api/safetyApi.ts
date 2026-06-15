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
  recent_incidents: TrailSafetyIncident[];
  cached?: boolean;
};

export type TrailSafetyIncident = {
  id: string;
  incident_type: IncidentType;
  severity: SafetySeverity;
  headline?: string | null;
  description?: string | null;
  source?: string;
  source_name?: string | null;
  source_url?: string | null;
  reported_at?: string | null;
  expires_at?: string | null;
  distance_meters: number;
  moderation_status?: string | null;
  confirmations_count: number;
  disputes_count: number;
  community_confidence_score: number;
  trust_level?: string;
  verification_label: string;
  confirmation_label: string;
  dispute_label: string;
};

type Envelope<T> = { data: T };

export type CheckpointStatus = 'open' | 'slow' | 'closed';

export type RouteLineGeometry = {
  type: 'LineString';
  coordinates: [number, number][];
  source?: string;
};

export type CheckpointReport = {
  id?: string;
  checkpoint_id?: string;
  status: CheckpointStatus;
  wait_minutes: number;
  notes?: string | null;
  created_at?: string | null;
  expires_at?: string | null;
};

export type CheckpointRouteSuggestion = {
  id: string;
  checkpoint_id: string;
  waypoint: {
    latitude: number;
    longitude: number;
    name?: string | null;
  };
  notes?: string | null;
  comparison: {
    original_distance_km: number | null;
    original_duration_minutes: number | null;
    suggested_distance_km: number | null;
    suggested_duration_minutes: number | null;
    extra_distance_km: number | null;
    extra_time_minutes: number | null;
  };
  route_geometry?: RouteLineGeometry | unknown;
  created_at?: string | null;
  expires_at?: string | null;
  status?: string;
  route_available?: boolean;
  original_route_available?: boolean;
};

export type TrailAccessDangerZone = {
  id: string;
  name: string;
  name_ar?: string | null;
  location_type: string;
  risk_level: SafetySeverity | string;
  latitude?: number | null;
  longitude?: number | null;
  distance_from_start_km?: number | null;
  distance_from_route_meters?: number | null;
  checkpoint_status?: CheckpointStatus | null;
  latest_report?: CheckpointReport | null;
  recent_reports?: CheckpointReport[];
  suggested_routes?: CheckpointRouteSuggestion[];
  alternatives?: Array<{
    id: string;
    waypoint_name?: string | null;
    waypoint_lat?: number | null;
    waypoint_lng?: number | null;
    extra_distance_km?: number | null;
    extra_time_minutes?: number | null;
    notes?: string | null;
  }>;
  warning?: string | null;
  warning_en?: string | null;
  warning_ar?: string | null;
};

export type TrailAccess = {
  trailhead: {
    latitude: number;
    longitude: number;
    name?: string | null;
    name_ar?: string | null;
    parking_notes?: string | null;
    parking_notes_ar?: string | null;
    access_notes?: string | null;
    access_notes_ar?: string | null;
  };
  driving_route: {
    available: boolean;
    distance_km: number | null;
    duration_minutes: number | null;
    geometry: RouteLineGeometry;
    warning?: string | null;
  };
  danger_zones: TrailAccessDangerZone[];
  access_risk_level: 'clear' | 'attention' | 'caution' | 'dangerous' | string;
  safety_tips: string[];
};

export type TrailAlternativeRoute = {
  route_available: boolean;
  warning?: string | null;
  waypoint?: {
    name?: string | null;
    latitude: number;
    longitude: number;
    notes?: string | null;
  };
  driving_route?: {
    distance_km: number | null;
    duration_minutes: number | null;
    geometry: RouteLineGeometry;
  };
  extra_distance_km?: number | null;
  extra_time_minutes?: number | null;
  alternative?: CheckpointRouteSuggestion;
};

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
  return {
    ...response.data,
    warnings: response.data.warnings ?? [],
    recent_incidents: response.data.recent_incidents ?? [],
  };
}

export async function getTrailAccess(trailId: string, params: { from_lat: number; from_lng: number }) {
  const response = await apiRequest<Envelope<TrailAccess>>(`/api/trails/${trailId}/access`, {}, params);
  return response.data;
}

export type SetTrailAccessInput = {
  latitude: number;
  longitude: number;
  name?: string;
  name_ar?: string;
  parking_notes?: string;
  parking_notes_ar?: string;
  access_notes?: string;
  access_notes_ar?: string;
};

export async function setTrailAccess(trailId: string, payload: SetTrailAccessInput) {
  const response = await apiRequest<Envelope<TrailAccess>>(`/api/trails/${trailId}/access`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return response.data;
}

export async function getTrailAlternativeRoute(
  trailId: string,
  params: { checkpoint_id: string; from_lat: number; from_lng: number },
) {
  const response = await apiRequest<Envelope<TrailAlternativeRoute>>(`/api/trails/${trailId}/access/avoid`, {}, params);
  return response.data;
}

export async function reportCheckpointStatus(
  checkpointId: string,
  payload: { status: CheckpointStatus; wait_minutes: number; notes?: string },
) {
  const response = await apiRequest<Envelope<CheckpointReport>>(`/api/safety/checkpoints/${checkpointId}/report`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return response.data;
}

export async function suggestCheckpointRoute(
  checkpointId: string,
  payload: {
    from_lat: number;
    from_lng: number;
    trailhead_lat: number;
    trailhead_lng: number;
    waypoint_lat: number;
    waypoint_lng: number;
    waypoint_name?: string;
    notes?: string;
  },
) {
  const response = await apiRequest<Envelope<CheckpointRouteSuggestion>>(`/api/safety/checkpoints/${checkpointId}/suggest-route`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return response.data;
}

export async function getCheckpointSuggestedRoutes(checkpointId: string) {
  const response = await apiRequest<Envelope<CheckpointRouteSuggestion[]>>(`/api/safety/checkpoints/${checkpointId}/suggested-routes`);
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

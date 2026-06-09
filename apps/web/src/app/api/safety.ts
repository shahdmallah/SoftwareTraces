import { apiRequest } from './client';

type Envelope<T> = { data: T };

export type NearbySafetyAlert = {
  id: string;
  kind: 'location' | 'incident';
  name?: string;
  incident_type?: string;
  severity?: string;
  risk_level?: string;
  latitude: number;
  longitude: number;
  distance_meters: number;
  headline?: string | null;
  description?: string | null;
};

export type TrailSafety = {
  safety_score: number;
  risk_level: string;
  nearest_settlement: { name: string; distance_meters: number } | null;
  nearest_checkpoint: { name: string; distance_meters: number } | null;
  incident_count_48h: number;
  warnings: string[];
};

export async function getNearbySafetyAlerts(params: { lat: number; lng: number; radius?: number }) {
  const response = await apiRequest<Envelope<NearbySafetyAlert[]>>('/api/safety/nearby-alerts', {}, params);
  return response.data;
}

export async function getTrailSafety(trailId: string) {
  const response = await apiRequest<Envelope<TrailSafety>>(`/api/safety/trails/${trailId}/safety`);
  return response.data;
}

export async function reportSafetyIncident(payload: {
  incident_type: string;
  severity: string;
  latitude: number;
  longitude: number;
  location_name?: string;
  description?: string;
}) {
  const response = await apiRequest<Envelope<{ id: string; moderation_status?: string }>>('/api/safety/report-incident', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return response.data;
}

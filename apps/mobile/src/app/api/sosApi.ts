import { apiRequest } from './client';

type Envelope<T> = {
  data: T;
};

export type SosAlert = {
  id: string;
  user_id?: string;
  activity_id?: string | null;
  latitude?: number;
  longitude?: number;
  message?: string | null;
  status: string;
  status_note?: string | null;
  contact_count?: number;
  notified_contact_count?: number;
  occurred_at: string;
  acknowledged_at?: string | null;
  resolved_at?: string | null;
  cancelled_at?: string | null;
  failed_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type EmergencyContact = {
  id: string;
  user_id: string;
  contact_user_id: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  relationship: string | null;
  priority: number;
  notify_by_sms: boolean;
  notify_by_email: boolean;
  notify_by_push: boolean;
  notify_on_sos: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export async function sendSosAlert(payload: {
  latitude: number;
  longitude: number;
  activityId?: string | null;
  message?: string;
  occurredAt?: string;
}) {
  const response = await apiRequest<Envelope<SosAlert>>('/api/sos', {
    method: 'POST',
    body: JSON.stringify({
      latitude: payload.latitude,
      longitude: payload.longitude,
      activity_id: payload.activityId ?? undefined,
      message: payload.message?.trim() || undefined,
      occurred_at: payload.occurredAt ?? new Date().toISOString(),
    }),
  });

  return response.data;
}

export async function getMySosAlerts() {
  const response = await apiRequest<Envelope<SosAlert[]>>('/api/sos/my');
  return response.data;
}

export async function getSosAlert(id: string) {
  const response = await apiRequest<Envelope<SosAlert>>(`/api/sos/${id}`);
  return response.data;
}

export async function updateSosStatus(id: string, payload: { status: string; note?: string | null }) {
  const response = await apiRequest<Envelope<SosAlert>>(`/api/sos/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({
      status: payload.status,
      note: payload.note?.trim() || undefined,
    }),
  });
  return response.data;
}

export async function getEmergencyContacts() {
  const response = await apiRequest<Envelope<EmergencyContact[]>>('/api/sos/contacts');
  return response.data;
}

export async function createEmergencyContact(payload: {
  name: string;
  contact_user_id?: string | null;
  phone?: string | null;
  email?: string | null;
  relationship?: string | null;
  priority?: number;
  notify_by_sms?: boolean;
  notify_by_email?: boolean;
  notify_by_push?: boolean;
  notify_on_sos?: boolean;
}) {
  const response = await apiRequest<Envelope<EmergencyContact>>('/api/sos/contacts', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return response.data;
}

export async function updateEmergencyContact(id: string, payload: Partial<{
  name: string;
  contact_user_id: string | null;
  phone: string | null;
  email: string | null;
  relationship: string | null;
  priority: number;
  notify_by_sms: boolean;
  notify_by_email: boolean;
  notify_by_push: boolean;
  notify_on_sos: boolean;
  is_active: boolean;
}>) {
  const response = await apiRequest<Envelope<EmergencyContact>>(`/api/sos/contacts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  return response.data;
}

export async function deleteEmergencyContact(id: string) {
  return apiRequest<void>(`/api/sos/contacts/${id}`, { method: 'DELETE' });
}

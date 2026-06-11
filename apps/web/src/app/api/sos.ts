import { apiRequest } from './client';

type Envelope<T> = { data: T };

export type SosStatus =
  | 'created'
  | 'notifying'
  | 'notified'
  | 'acknowledged'
  | 'resolved'
  | 'cancelled'
  | 'failed';

export type EmergencyContact = {
  id: string;
  user_id?: string;
  full_name: string;
  name: string;
  phone: string | null;
  email?: string | null;
  relationship?: string | null;
  is_primary?: boolean;
  is_active?: boolean;
  contact_user_id?: string | null;
  notify_on_sos?: boolean;
  created_at?: string;
  updated_at?: string | null;
};

export type SosAlert = {
  id: string;
  user_id?: string;
  activity_id?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  message?: string | null;
  status: SosStatus | string;
  status_note?: string | null;
  occurred_at?: string;
  contact_count?: number;
  notified_contact_count?: number;
  emergency_contacts_count?: number;
  contacts_notified?: number;
  notification_status?: 'success' | 'partial' | 'failed';
  created_at: string;
  updated_at?: string | null;
};

export type CreateSosResult = {
  sos_event: SosAlert;
  emergency_contacts_count: number;
  contacts_notified: number;
  notification_status: 'success' | 'partial' | 'failed';
};

export async function createSos(payload: {
  latitude: number;
  longitude: number;
  activity_id?: string;
  message?: string;
  occurred_at?: string;
}) {
  const response = await apiRequest<Envelope<CreateSosResult>>('/api/sos', {
    method: 'POST',
    body: JSON.stringify({
      latitude: payload.latitude,
      longitude: payload.longitude,
      activity_id: payload.activity_id,
      message: payload.message?.trim() || undefined,
      occurred_at: payload.occurred_at ?? new Date().toISOString(),
    }),
  });
  return response.data;
}

export async function getMySosEvents() {
  const response = await apiRequest<Envelope<SosAlert[]>>('/api/sos/my');
  return response.data;
}

export async function getSosEvent(id: string) {
  const response = await apiRequest<Envelope<SosAlert>>(`/api/sos/${id}`);
  return response.data;
}

export async function updateSosStatus(id: string, payload: { status: SosStatus; note?: string }) {
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

type EmergencyContactPayload = {
  full_name?: string;
  name?: string;
  phone?: string | null;
  email?: string | null;
  relationship?: string | null;
  is_primary?: boolean;
  notify_on_sos?: boolean;
};

function normalizeEmergencyContactPayload(payload: EmergencyContactPayload) {
  const fullName = (payload.full_name ?? payload.name ?? '').trim();

  return {
    full_name: fullName,
    name: fullName,
    phone: payload.phone ?? null,
    email: payload.email ?? null,
    relationship: payload.relationship ?? null,
    is_primary: payload.is_primary,
    notify_on_sos: payload.notify_on_sos,
  };
}

export async function addEmergencyContact(payload: {
  full_name?: string;
  name?: string;
  phone?: string | null;
  email?: string | null;
  relationship?: string | null;
  is_primary?: boolean;
  notify_on_sos?: boolean;
}) {
  const body = normalizeEmergencyContactPayload(payload);
  const response = await apiRequest<Envelope<EmergencyContact>>('/api/sos/contacts', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return response.data;
}

export async function updateEmergencyContact(
  id: string,
  payload: Partial<{
    full_name: string;
    name: string;
    phone: string | null;
    email: string | null;
    relationship: string | null;
    is_primary: boolean;
    notify_on_sos: boolean;
    is_active: boolean;
  }>,
) {
  const normalizedPayload =
    payload.full_name != null || payload.name != null
      ? {
          ...payload,
          ...normalizeEmergencyContactPayload(payload),
        }
      : {
          ...payload,
          phone: payload.phone ?? null,
          email: payload.email ?? null,
          relationship: payload.relationship ?? null,
        };

  const response = await apiRequest<Envelope<EmergencyContact>>(`/api/sos/contacts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(normalizedPayload),
  });
  return response.data;
}

export async function deleteEmergencyContact(id: string) {
  return apiRequest(`/api/sos/contacts/${id}`, { method: 'DELETE' });
}

export function contactDisplayName(contact: EmergencyContact) {
  return contact.full_name || contact.name || 'Contact';
}

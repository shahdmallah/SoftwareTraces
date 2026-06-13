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
  emergency_contacts_count?: number;
  contacts_notified?: number;
  notification_status?: 'success' | 'partial' | 'failed';
  occurred_at: string;
  acknowledged_at?: string | null;
  resolved_at?: string | null;
  cancelled_at?: string | null;
  failed_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type SosCreateResult = {
  sos_event: SosAlert;
  emergency_contacts_count: number;
  contacts_notified: number;
  notification_status: 'success' | 'partial' | 'failed';
};

export type EmergencyContact = {
  id: string;
  user_id: string;
  contact_user_id: string | null;
  full_name?: string;
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
  const response = await apiRequest<Envelope<SosCreateResult>>('/api/sos', {
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

type EmergencyContactPayload = {
  full_name?: string;
  name?: string;
  contact_user_id?: string | null;
  phone?: string | null;
  email?: string | null;
  relationship?: string | null;
  priority?: number;
  notify_by_sms?: boolean;
  notify_by_email?: boolean;
  notify_by_push?: boolean;
  notify_on_sos?: boolean;
  is_active?: boolean;
};

function normalizeEmergencyContactPayload(payload: EmergencyContactPayload) {
  const fullName = (payload.full_name ?? payload.name ?? '').trim();

  return {
    full_name: fullName,
    name: fullName,
    contact_user_id: payload.contact_user_id ?? null,
    phone: payload.phone ?? null,
    email: payload.email ?? null,
    relationship: payload.relationship ?? null,
    priority: payload.priority,
    notify_by_sms: payload.notify_by_sms,
    notify_by_email: payload.notify_by_email,
    notify_by_push: payload.notify_by_push,
    notify_on_sos: payload.notify_on_sos,
    is_active: payload.is_active,
  };
}

export async function createEmergencyContact(payload: {
  full_name?: string;
  name?: string;
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
  const body = normalizeEmergencyContactPayload(payload);
  const response = await apiRequest<Envelope<EmergencyContact>>('/api/sos/contacts', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return response.data;
}

export async function updateEmergencyContact(id: string, payload: Partial<{
  full_name: string;
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
  const body: Record<string, unknown> = {};

  if (payload.full_name != null || payload.name != null) {
    const fullName = (payload.full_name ?? payload.name ?? '').trim();
    body.full_name = fullName;
    body.name = fullName;
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'contact_user_id')) {
    body.contact_user_id = payload.contact_user_id ?? null;
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'phone')) {
    body.phone = payload.phone ?? null;
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'email')) {
    body.email = payload.email ?? null;
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'relationship')) {
    body.relationship = payload.relationship ?? null;
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'priority')) {
    body.priority = payload.priority;
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'notify_by_sms')) {
    body.notify_by_sms = payload.notify_by_sms;
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'notify_by_email')) {
    body.notify_by_email = payload.notify_by_email;
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'notify_by_push')) {
    body.notify_by_push = payload.notify_by_push;
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'notify_on_sos')) {
    body.notify_on_sos = payload.notify_on_sos;
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'is_active')) {
    body.is_active = payload.is_active;
  }

  const response = await apiRequest<Envelope<EmergencyContact>>(`/api/sos/contacts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  return response.data;
}

export async function deleteEmergencyContact(id: string) {
  return apiRequest<void>(`/api/sos/contacts/${id}`, { method: 'DELETE' });
}

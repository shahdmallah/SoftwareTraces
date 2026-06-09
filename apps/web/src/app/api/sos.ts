import { apiRequest } from './client';

type Envelope<T> = { data: T };

export type EmergencyContact = {
  id: string;
  name: string;
  phone: string;
  relationship?: string | null;
  is_primary?: boolean;
};

export type SosAlert = {
  id: string;
  status: string;
  latitude?: number | null;
  longitude?: number | null;
  message?: string | null;
  created_at: string;
};

export async function createSos(payload: Record<string, unknown>) {
  const response = await apiRequest<Envelope<SosAlert>>('/api/sos', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return response.data;
}

export async function getMySosEvents() {
  const response = await apiRequest<Envelope<SosAlert[]>>('/api/sos/my');
  return response.data;
}

export async function getEmergencyContacts() {
  const response = await apiRequest<Envelope<EmergencyContact[]>>('/api/sos/contacts');
  return response.data;
}

export async function addEmergencyContact(payload: { name: string; phone: string; relationship?: string; is_primary?: boolean }) {
  const response = await apiRequest<Envelope<EmergencyContact>>('/api/sos/contacts', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return response.data;
}

export async function deleteEmergencyContact(id: string) {
  return apiRequest(`/api/sos/contacts/${id}`, { method: 'DELETE' });
}

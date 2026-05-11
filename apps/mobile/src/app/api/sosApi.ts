import { apiRequest } from './client';

type Envelope<T> = {
  data: T;
};

export type SosAlert = {
  id: string;
  status: string;
  occurred_at: string;
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

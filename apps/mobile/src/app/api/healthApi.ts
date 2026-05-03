import { apiRequest } from './client';

export type HealthStatus = {
  ok?: boolean;
  status?: string;
  [key: string]: unknown;
};

export function getHealth() {
  return apiRequest<HealthStatus>('/api/health');
}

export function getDatabaseHealth() {
  return apiRequest<HealthStatus>('/api/health/db');
}

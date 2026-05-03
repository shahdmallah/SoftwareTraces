import { apiRequest } from './client';

export type ElevationDebugResponse = {
  [key: string]: unknown;
};

export function getElevationDebug(lat: number, lng: number) {
  return apiRequest<ElevationDebugResponse>(`/api/debug/elevation/${lat}/${lng}`);
}

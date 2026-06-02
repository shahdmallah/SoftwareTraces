import axios from "axios";
import type { AuthSession, LoginRequest, RegisterRequest, Trail } from "@traces/shared-types";
import { useAuthStore } from "../../../features/auth/store/authStore";
import type { OfflineMapBundle } from "../offline/storage";

export interface DuplicateTrailCheckRequest {
  name?: string;
  coordinates: [number, number][];
  distance?: number;
  visibility?: "public" | "private";
}

export interface DuplicateTrailMatch {
  trail_id: string;
  name: string;
  similarity_score: number;
  reason: string;
  reasons: string[];
  start_distance_meters: number | null;
  end_distance_meters: number | null;
  length_difference_percent: number | null;
  bounding_box_overlap_percent: number | null;
  name_similarity: number | null;
}

export interface DuplicateTrailWarning {
  has_similar_trails: boolean;
  message: string | null;
  matches: DuplicateTrailMatch[];
}

const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000/api",
  timeout: 15000
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().session?.tokens.accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * Authenticates an existing user.
 */
export async function login(payload: LoginRequest): Promise<AuthSession> {
  const response = await api.post<{ data: AuthSession }>("/auth/login", payload);
  return response.data.data;
}

/**
 * Registers a new user.
 */
export async function register(payload: RegisterRequest): Promise<AuthSession> {
  const response = await api.post<{ data: AuthSession }>("/auth/register", payload);
  return response.data.data;
}

/**
 * Fetches trails near a location.
 */
export async function getNearbyTrails(lat: number, lng: number): Promise<Trail[]> {
  const response = await api.get<{ data: Trail[] }>("/trails/nearby", {
    params: { lat, lng, radius: 15000 }
  });
  return response.data.data;
}

export async function getTrailOfflineBundle(trailId: string): Promise<OfflineMapBundle> {
  const response = await api.get<{ data: OfflineMapBundle }>(`/offline/trails/${trailId}/bundle`);
  return response.data.data;
}

export async function checkDuplicateTrail(payload: DuplicateTrailCheckRequest): Promise<DuplicateTrailWarning> {
  const response = await api.post<DuplicateTrailWarning>("/trails/check-duplicate", payload);
  return response.data;
}

export default api;

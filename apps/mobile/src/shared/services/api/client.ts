import axios from "axios";
import type { AuthSession, LoginRequest, RegisterRequest, Trail } from "@traces/shared-types";
import { useAuthStore } from "../../../features/auth/store/authStore";

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

export default api;
